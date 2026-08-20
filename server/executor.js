import { GRAPH_KEY } from './constants.js'

async function callAnthropic(apiKey, modelName, maxTokens, systemOrInstructions, messages) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: maxTokens,
      system: systemOrInstructions,
      messages,
    }),
  })
  const data = await response.json()
  return { response, data }
}

function extractParams(config, fallback) {
  if (config.instructions !== undefined) {
    return {
      systemOrInstructions: config.instructions || fallback.instructions || '',
      modelName: config.model?.name || fallback.model?.name || 'claude-sonnet-4-6',
      maxTokens: config.model?.parameters?.max_tokens || config.model?.parameters?.maxTokens || 512,
    }
  }
  const systemPrompt = config.messages?.find((m) => m.role === 'system')?.content ||
    fallback.messages?.[0]?.content || ''
  return {
    systemOrInstructions: systemPrompt,
    modelName: config.model?.name || fallback.model?.name || 'claude-sonnet-4-6',
    maxTokens: config.model?.parameters?.max_tokens || config.model?.parameters?.maxTokens || 1024,
  }
}

/**
 * Generic agent/completion execution. Works for any LD config — agent-mode
 * (instructions) or completion-mode (messages). Adding a new subagent means
 * adding a config in LD and calling this function, not writing new code.
 */
export async function executeNode({
  aiClient,
  anthropicApiKey,
  configKey,
  context,
  fallback,
  messages,
  emitReasoning,
  reasoningId,
  mode = 'agent',
}) {
  const node = configKey
  const start = Date.now()

  emitReasoning(reasoningId, { node, status: 'active', timestamp: start, detail: `Evaluating ${configKey}` })

  let config
  if (!aiClient) {
    config = { ...fallback, tracker: null }
  } else {
    try {
      if (mode === 'agent') {
        config = await aiClient.agentConfig(configKey, context, fallback, {})
      } else {
        config = await aiClient.completionConfig(configKey, context, fallback, {})
      }
    } catch (err) {
      console.error(`[Executor] Config eval failed for ${configKey}:`, err.message)
      emitReasoning(reasoningId, { node, status: 'warn', timestamp: Date.now(), detail: `Config error: ${err.message}` })
      config = { ...fallback, tracker: null }
    }
  }

  if (!config.enabled) {
    emitReasoning(reasoningId, { node, status: 'blocked', timestamp: Date.now(), detail: 'Config disabled' })
    return { text: null, config, error: 'Config disabled' }
  }

  const { systemOrInstructions, modelName, maxTokens } = extractParams(config, fallback)
  const { tracker } = config

  console.log(`[Executor] ${configKey} — model: ${modelName}, maxTokens: ${maxTokens}`)

  const { response, data } = await callAnthropic(anthropicApiKey, modelName, maxTokens, systemOrInstructions, messages)

  if (!response.ok) {
    const errMsg = data.error?.message || 'Anthropic API error'
    console.error(`[Executor] ${configKey} error (${response.status}):`, errMsg)
    tracker?.trackError(GRAPH_KEY)
    emitReasoning(reasoningId, { node, status: 'warn', timestamp: Date.now(), detail: `Model error: ${errMsg}` })
    return { text: null, config, error: errMsg }
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

  const text = data.content?.[0]?.text || ''
  emitReasoning(reasoningId, { node, status: 'success', timestamp: Date.now(), detail: text.slice(0, 80) })

  return { text, config, tracker }
}

export { callAnthropic, extractParams }
