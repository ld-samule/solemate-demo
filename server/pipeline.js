import crypto from 'node:crypto'
import { executeNode, callAnthropic } from './executor.js'
import { gatherFacts, simulateOrderPlacement, simulateRefundProcessing } from './simulate.js'
import { FALLBACK_CONFIGS, GRAPH_KEY, JUDGE_THRESHOLD, MAX_TURNS, PRODUCT_CATALOG } from './constants.js'

/**
 * Full router → subagent pipeline.
 *
 * @param {object} params
 * @param {object} params.aiClient           LDAIClient
 * @param {object} params.ldClient           LD server-side client
 * @param {string} params.anthropicApiKey
 * @param {Array}  params.messages           conversation history
 * @param {string} params.userKey
 * @param {string} params.reasoningId
 * @param {Function} params.emitReasoning    (reasoningId, event) => void
 * @param {Map}    params.pendingApprovals   in-memory map for HITL
 * @param {string} [params.triggerUrl]
 * @param {object} [params.triggerState]     { fired: boolean }
 */
export async function handleChat({
  aiClient,
  ldClient,
  anthropicApiKey,
  messages,
  userKey,
  reasoningId,
  emitReasoning,
  pendingApprovals,
  triggerUrl,
  triggerState,
}) {
  const context = { kind: 'user', key: userKey }
  const trimmed = messages.slice(-MAX_TURNS)

  // ------------------------------------------------------------------
  // STEP 1: Router — classify intent
  // ------------------------------------------------------------------
  const lastUserMsg = trimmed.filter((m) => m.role === 'user').pop()?.content || ''

  const routerResult = await executeNode({
    aiClient, anthropicApiKey,
    configKey: 'solemate-router',
    context,
    fallback: FALLBACK_CONFIGS.router,
    messages: [{ role: 'user', content: lastUserMsg }],
    emitReasoning,
    reasoningId,
    mode: 'agent',
  })

  let intent = 'info'
  try {
    const parsed = JSON.parse(routerResult.text || '{}')
    if (parsed.intent === 'action') intent = 'action'
  } catch {
    console.warn('[Pipeline] Router did not return valid JSON, defaulting to info')
  }

  emitReasoning(reasoningId, {
    node: 'solemate-router', status: 'success',
    timestamp: Date.now(),
    detail: `Classified as: ${intent}`,
  })

  // ------------------------------------------------------------------
  // INFO BRANCH — existing chatbot completion + judge + escalation
  // ------------------------------------------------------------------
  if (intent === 'info') {
    return handleInfoBranch({
      aiClient, ldClient, anthropicApiKey,
      context, trimmed, reasoningId, emitReasoning,
      triggerUrl, triggerState,
    })
  }

  // ------------------------------------------------------------------
  // ACTION BRANCH — orchestrator → researcher → reviewer → implementer
  // ------------------------------------------------------------------
  return handleActionBranch({
    aiClient, ldClient, anthropicApiKey,
    context, trimmed, lastUserMsg, reasoningId, emitReasoning,
    pendingApprovals,
  })
}

// =====================================================================
// INFO BRANCH
// =====================================================================
async function handleInfoBranch({
  aiClient, ldClient, anthropicApiKey,
  context, trimmed, reasoningId, emitReasoning,
  triggerUrl, triggerState,
}) {
  emitReasoning(reasoningId, {
    node: 'solemate-chatbot', status: 'active',
    timestamp: Date.now(), detail: 'Generating response',
  })

  let config
  let variationKey = null
  let hasJudge = false
  if (!aiClient || !ldClient) {
    config = { ...FALLBACK_CONFIGS.chatbot, tracker: null }
  } else {
    try {
      config = await aiClient.completionConfig('solemate-chatbot', context, FALLBACK_CONFIGS.chatbot, {})
      const rawValue = await ldClient.variation('solemate-chatbot', context, null)
      variationKey = rawValue?._ldMeta?.variationKey || null
      hasJudge = rawValue?.judgeConfiguration?.judges?.length > 0
    } catch {
      config = { ...FALLBACK_CONFIGS.chatbot, tracker: null }
    }
  }

  if (!config.enabled) {
    return { reply: 'The SoleMate assistant is temporarily unavailable.', reasoningId }
  }

  const systemPrompt =
    config.messages?.find((m) => m.role === 'system')?.content ||
    FALLBACK_CONFIGS.chatbot.messages[0].content
  const modelName = config.model?.name || 'claude-sonnet-4-6'
  const maxTokens = config.model?.parameters?.max_tokens || config.model?.parameters?.maxTokens || 1024
  const { tracker } = config

  const start = Date.now()
  console.log(`[Pipeline] solemate-chatbot — model: ${modelName}, maxTokens: ${maxTokens}`)

  const { response, data } = await callAnthropic(anthropicApiKey, modelName, maxTokens, systemPrompt, trimmed)

  if (!response.ok) {
    console.error(`[Pipeline] Chatbot error (${response.status}):`, data.error?.message)
    tracker?.trackError(GRAPH_KEY)
    emitReasoning(reasoningId, {
      node: 'solemate-chatbot', status: 'warn',
      timestamp: Date.now(), detail: `Model error: ${data.error?.message}`,
    })
    return { error: data.error?.message || 'Claude API error', reasoningId }
  }

  tracker?.trackSuccess(GRAPH_KEY)
  tracker?.trackDuration(Date.now() - start, GRAPH_KEY)
  if (data.usage) {
    tracker?.trackTokens({
      input: data.usage.input_tokens,
      output: data.usage.output_tokens,
      total: data.usage.input_tokens + data.usage.output_tokens,
    }, GRAPH_KEY)
  }

  const chatbotReply = data.content?.[0]?.text || "Sorry, I couldn't process that."

  emitReasoning(reasoningId, {
    node: 'solemate-chatbot', status: 'success',
    timestamp: Date.now(), detail: chatbotReply.slice(0, 80),
  })

  // Trigger detection (preserved from original)
  if (variationKey === 'linked-in-transformer' && triggerUrl && triggerState && !triggerState.fired) {
    triggerState.fired = true
    setTimeout(async () => {
      try { await fetch(triggerUrl, { method: 'POST' }) } catch { /* ignore */ }
    }, 5000)
  }

  // HITL check (legacy path — in case chatbot variation still uses [AWAITING_APPROVAL])
  if (chatbotReply.includes('[AWAITING_APPROVAL]')) {
    const stripped = chatbotReply.replace(/\[AWAITING_APPROVAL\]\s*/g, '').trim()
    return {
      reply: stripped, reasoningId,
      pendingApproval: { orderSummary: stripped },
      judge: null, escalated: false,
    }
  }

  // Judge evaluation
  let reply = chatbotReply
  let judgeInfo = null
  let escalated = false
  let blockedReply

  if (hasJudge) {
    const judgeResult = await runJudge(anthropicApiKey, trimmed, chatbotReply, reasoningId, emitReasoning)
    judgeInfo = judgeResult

    if (judgeResult && judgeResult.score < JUDGE_THRESHOLD) {
      emitReasoning(reasoningId, {
        node: 'solemate-scope-judge', status: 'warn',
        timestamp: Date.now(), detail: 'Below threshold — escalating',
      })

      const escalatedContext = { ...context, escalationLevel: 1 }
      const safeConfig = await aiClient.completionConfig('solemate-chatbot', escalatedContext, FALLBACK_CONFIGS.chatbot, {})
      const safeSystem = safeConfig.messages?.find((m) => m.role === 'system')?.content || FALLBACK_CONFIGS.chatbot.messages[0].content
      const safeModel = safeConfig.model?.name || 'claude-sonnet-4-6'
      const safeMaxTokens = safeConfig.model?.parameters?.max_tokens || 1024

      const safeResult = await callAnthropic(anthropicApiKey, safeModel, safeMaxTokens, safeSystem, trimmed)
      if (safeResult.response.ok) {
        reply = safeResult.data.content?.[0]?.text || chatbotReply
        blockedReply = chatbotReply
        escalated = true
        emitReasoning(reasoningId, {
          node: 'solemate-chatbot', status: 'success',
          timestamp: Date.now(), detail: 'Safe response served',
        })
      }
    }
  }

  // Brand agent refinement
  const branded = await runBrandAgent(aiClient, anthropicApiKey, context, reply, reasoningId, emitReasoning)

  return {
    reply: branded || reply,
    reasoningId,
    judge: judgeInfo,
    escalated,
    blockedReply,
  }
}

// =====================================================================
// ACTION BRANCH
// =====================================================================
async function handleActionBranch({
  aiClient, ldClient, anthropicApiKey,
  context, trimmed, lastUserMsg, reasoningId, emitReasoning,
  pendingApprovals,
}) {
  // Step 2: Orchestrator — generate dispatch plan
  const orchestratorResult = await executeNode({
    aiClient, anthropicApiKey,
    configKey: 'solemate-task-orchestrator',
    context,
    fallback: FALLBACK_CONFIGS.orchestrator,
    messages: [{ role: 'user', content: lastUserMsg }],
    emitReasoning, reasoningId,
    mode: 'agent',
  })

  let plan
  try {
    const raw = orchestratorResult.text || ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const cleaned = jsonMatch ? jsonMatch[0] : raw.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    plan = JSON.parse(cleaned)
  } catch {
    console.error('[Pipeline] Orchestrator did not return valid JSON:', orchestratorResult.text?.slice(0, 200))
    emitReasoning(reasoningId, {
      node: 'solemate-task-orchestrator', status: 'warn',
      timestamp: Date.now(), detail: 'Could not parse dispatch plan — falling back to info branch',
    })
    return handleInfoBranch({
      aiClient, ldClient, anthropicApiKey,
      context, trimmed, reasoningId, emitReasoning,
      triggerUrl: null, triggerState: null,
    })
  }

  console.log(`[Pipeline] Dispatch plan:`, JSON.stringify(plan))

  // Step 3: Researcher — gather facts
  const facts = gatherFacts(plan)
  const factsForResearcher = JSON.stringify({ plan, simulatedResults: facts }, null, 2)

  const researcherResult = await executeNode({
    aiClient, anthropicApiKey,
    configKey: 'solemate-researcher',
    context,
    fallback: FALLBACK_CONFIGS.researcher,
    messages: [{ role: 'user', content: `Dispatch plan and simulated tool results:\n${factsForResearcher}` }],
    emitReasoning, reasoningId,
    mode: 'agent',
  })

  // For read-only actions, skip reviewer/implementer entirely
  if (!plan.dispatch?.reviewer) {
    const branded = await runBrandAgent(aiClient, anthropicApiKey, context, researcherResult.text, reasoningId, emitReasoning)
    return { reply: branded || researcherResult.text, reasoningId }
  }

  // Step 4: Reviewer — evaluate and approve/decline
  const reviewerContext = {
    kind: 'multi',
    user: { key: context.key },
    action: {
      key: `${context.key}-${reasoningId}`,
      action_type: plan.action_type,
      quantity: plan.quantity || 1,
    },
  }

  const reviewerResult = await executeNode({
    aiClient, anthropicApiKey,
    configKey: 'solemate-reviewer',
    context: reviewerContext,
    fallback: FALLBACK_CONFIGS.reviewer,
    messages: [{
      role: 'user',
      content: `Action: ${plan.action_type}\nResearcher findings:\n${researcherResult.text}\n\nEvaluate and approve or decline.`,
    }],
    emitReasoning, reasoningId,
    mode: 'agent',
  })

  const reviewerText = reviewerResult.text || ''
  console.log('[Pipeline] Reviewer response:', reviewerText.slice(0, 300))

  // Detect HITL gate
  if (reviewerText.includes('[AWAITING_APPROVAL]')) {
    console.log('[Pipeline] HITL marker detected — pausing for human approval')
    const stripped = reviewerText.replace(/\[AWAITING_APPROVAL\]\s*/g, '').trim()

    emitReasoning(reasoningId, {
      node: 'solemate-reviewer', status: 'awaiting_approval',
      timestamp: Date.now(), detail: 'Waiting for human approval',
    })

    pendingApprovals.set(reasoningId, {
      orderSummary: stripped,
      plan,
      facts,
      researcherFindings: researcherResult.text,
    })

    const branded = await runBrandAgent(aiClient, anthropicApiKey, context, stripped, reasoningId, emitReasoning)

    return {
      reply: branded || stripped,
      reasoningId,
      pendingApproval: {
        orderSummary: branded || stripped,
        facts,
        plan,
      },
    }
  }

  // Detect approval — check for the marker or approval language from the reviewer
  const isApproved = reviewerText.includes('[APPROVED]') ||
    /\bapproved\b/i.test(reviewerText) ||
    /\bapproval summary\b/i.test(reviewerText)

  // Detect explicit decline signals
  const isDeclined = /\bdecline[ds]?\b/i.test(reviewerText) &&
    !isApproved

  if (!isApproved || isDeclined) {
    console.log('[Pipeline] Reviewer declined — no approval marker found')
    emitReasoning(reasoningId, {
      node: 'solemate-reviewer', status: 'blocked',
      timestamp: Date.now(), detail: 'Action declined',
    })
    const branded = await runBrandAgent(aiClient, anthropicApiKey, context, reviewerText, reasoningId, emitReasoning)
    return { reply: branded || reviewerText, reasoningId }
  }

  console.log('[Pipeline] Reviewer approved — proceeding to implementer')

  // Step 5: Implementer — execute the approved action
  return executeImplementer({
    aiClient, ldClient, anthropicApiKey,
    context, plan, reviewerText, reasoningId, emitReasoning,
    isAutonomous: true,
  })
}

/**
 * Runs the implementer + optional autonomous judge + brand agent.
 * Also called from the /api/approve handler after human approval.
 */
export async function executeImplementer({
  aiClient, ldClient, anthropicApiKey,
  context, plan, reviewerText, reasoningId, emitReasoning,
  isAutonomous = false,
}) {
  const executionOutcome = plan.action_type === 'return'
    ? simulateRefundProcessing()
    : simulateOrderPlacement(plan.parameters?.product, plan.quantity || 1, plan.parameters?.size || '10')

  const implementerResult = await executeNode({
    aiClient, anthropicApiKey,
    configKey: 'solemate-implementer',
    context,
    fallback: FALLBACK_CONFIGS.implementer,
    messages: [{
      role: 'user',
      content: `Reviewer approval:\n${reviewerText}\n\nExecution result:\n${JSON.stringify(executionOutcome)}\n\nReport the outcome to the customer.`,
    }],
    emitReasoning, reasoningId,
    mode: 'agent',
  })

  // Autonomous-mode judge — the sole unguarded path
  if (isAutonomous) {
    const judgeResult = await runJudge(
      anthropicApiKey, [], implementerResult.text, reasoningId, emitReasoning,
    )
    if (judgeResult && judgeResult.score < JUDGE_THRESHOLD) {
      emitReasoning(reasoningId, {
        node: 'solemate-scope-judge', status: 'warn',
        timestamp: Date.now(),
        detail: `Autonomous judge flagged (${judgeResult.score.toFixed(2)}) — using safe fallback`,
      })
      const safeReply = plan.action_type === 'return'
        ? "We've received your return request. You'll receive an email confirmation shortly with next steps."
        : "Your order has been received and is being processed. Check your email for confirmation details."
      const branded = await runBrandAgent(aiClient, anthropicApiKey, context, safeReply, reasoningId, emitReasoning)
      return { reply: branded || safeReply, reasoningId }
    }
  }

  const branded = await runBrandAgent(aiClient, anthropicApiKey, context, implementerResult.text, reasoningId, emitReasoning)
  return { reply: branded || implementerResult.text, reasoningId }
}

// =====================================================================
// JUDGE
// =====================================================================
async function runJudge(anthropicApiKey, messages, assistantResponse, reasoningId, emitReasoning) {
  emitReasoning(reasoningId, {
    node: 'solemate-scope-judge', status: 'active',
    timestamp: Date.now(), detail: 'Evaluating response',
  })

  try {
    const latestUser = (Array.isArray(messages) ? messages : []).filter((m) => m.role === 'user').pop()?.content || ''
    const judgePrompt =
      FALLBACK_CONFIGS.judge.messages[0].content +
      '\n\nUser message: ' + latestUser +
      '\n\nAssistant response: ' + assistantResponse +
      '\n\nRespond with ONLY valid JSON: {"score": <number 0.0-1.0>, "reasoning": "<one sentence>"}'

    const { response, data } = await callAnthropic(
      anthropicApiKey, 'claude-sonnet-4-6', 200,
      'You are a scoring judge. Respond with ONLY valid JSON.',
      [{ role: 'user', content: judgePrompt }],
    )

    if (!response.ok) return null

    const judgeText = data.content?.[0]?.text || ''
    const jsonMatch = judgeText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    const score = typeof parsed.score === 'number' ? parsed.score : 1.0
    const reasoning = parsed.reasoning || ''

    emitReasoning(reasoningId, {
      node: 'solemate-scope-judge', status: score < JUDGE_THRESHOLD ? 'warn' : 'success',
      timestamp: Date.now(), detail: `Score: ${score.toFixed(2)} — ${reasoning}`,
    })

    return { score, reasoning }
  } catch (err) {
    console.error('[Pipeline] Judge error:', err.message)
    emitReasoning(reasoningId, {
      node: 'solemate-scope-judge', status: 'warn',
      timestamp: Date.now(), detail: `Judge error: ${err.message}`,
    })
    return null
  }
}

// =====================================================================
// BRAND AGENT
// =====================================================================
async function runBrandAgent(aiClient, anthropicApiKey, context, draftResponse, reasoningId, emitReasoning) {
  if (!draftResponse) return draftResponse

  const result = await executeNode({
    aiClient, anthropicApiKey,
    configKey: 'solemate-brand-agent',
    context,
    fallback: FALLBACK_CONFIGS.brandAgent,
    messages: [{ role: 'user', content: `Rewrite this draft response to match SoleMate brand voice:\n\n${draftResponse}` }],
    emitReasoning, reasoningId,
    mode: 'completion',
  })

  return result.text || draftResponse
}
