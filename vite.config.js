import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { init } from '@launchdarkly/node-server-sdk'
import { initAi } from '@launchdarkly/server-sdk-ai'

const MAX_TURNS = 20

const FALLBACK_CONFIG = {
  enabled: true,
  model: { name: 'claude-sonnet-4-20250514', parameters: { max_tokens: 300 } },
  messages: [
    {
      role: 'system',
      content:
        'You are a friendly, knowledgeable shopping assistant for SoleMate, a premium online shoe store. ' +
        'Keep responses concise — 2-3 sentences max. Be enthusiastic but not pushy. ' +
        'If asked about topics unrelated to shoes or SoleMate, politely redirect.',
    },
  ],
}

function solemateBackend() {
  let anthropicApiKey = ''
  let triggerUrl = ''
  let aiClientPromise = null
  let triggerFired = false

  return {
    name: 'solemate-backend',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '')
      anthropicApiKey = env.ANTHROPIC_API_KEY || ''
      triggerUrl = env.LD_TRIGGER_URL || ''
      const sdkKey = env.LD_SERVER_SDK_KEY || ''

      if (sdkKey) {
        aiClientPromise = (async () => {
          try {
            const ldClient = init(sdkKey)
            await ldClient.waitForInitialization({ timeout: 10 })
            console.log('[LD Server] AI SDK initialized')
            return initAi(ldClient)
          } catch (err) {
            console.error('[LD Server] Failed to initialize:', err.message)
            return null
          }
        })()
      } else {
        console.warn('[LD Server] LD_SERVER_SDK_KEY not set — using fallback config')
      }
    },
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405)
          res.end('Method not allowed')
          return
        }

        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const body = JSON.parse(Buffer.concat(chunks).toString())
        const { messages = [], userKey = 'solemate-anonymous' } = body
        const context = { kind: 'user', key: userKey }

        let config = { ...FALLBACK_CONFIG, tracker: null }

        if (aiClientPromise) {
          const aiClient = await aiClientPromise
          if (aiClient) {
            try {
              config = await aiClient.completionConfig(
                'solemate-chatbot',
                context,
                FALLBACK_CONFIG,
                {},
              )
            } catch (err) {
              console.error('[LD Server] completionConfig failed:', err.message)
            }
          }
        }

        if (!config.enabled) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ reply: 'The SoleMate assistant is temporarily unavailable.' }))
          return
        }

        const systemPrompt =
          config.messages?.find((m) => m.role === 'system')?.content ||
          FALLBACK_CONFIG.messages[0].content
        const modelName = config.model?.name || FALLBACK_CONFIG.model.name
        const maxTokens =
          config.model?.parameters?.max_tokens ||
          config.model?.parameters?.maxTokens ||
          300
        const trimmedMessages = messages.slice(-MAX_TURNS)
        const { tracker } = config

        const start = Date.now()

        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': anthropicApiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: modelName,
              max_tokens: maxTokens,
              system: systemPrompt,
              messages: trimmedMessages,
            }),
          })

          const data = await response.json()

          if (!response.ok) {
            tracker?.trackError()
            res.writeHead(response.status, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: data.error?.message || 'Claude API error' }))
            return
          }

          tracker?.trackSuccess()
          tracker?.trackDuration(Date.now() - start)
          if (data.usage) {
            tracker?.trackTokens({
              input: data.usage.input_tokens,
              output: data.usage.output_tokens,
              total: data.usage.input_tokens + data.usage.output_tokens,
            })
          }

          const reply = data.content?.[0]?.text || "Sorry, I couldn't process that."

          const variationKey = config._ldMeta?.variationKey
          if (variationKey === 'linked-in-transformer' && triggerUrl && !triggerFired) {
            triggerFired = true
            console.log('[LD Trigger] linked-in-transformer detected — firing in 5s')
            setTimeout(async () => {
              try {
                const triggerRes = await fetch(triggerUrl, { method: 'POST' })
                console.log(`[LD Trigger] Fired → ${triggerRes.status}`)
              } catch (err) {
                console.error('[LD Trigger] Error:', err.message)
              }
            }, 5000)
          }

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ reply }))
        } catch (err) {
          tracker?.trackError()
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      })

      server.middlewares.use('/api/trigger', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405)
          res.end('Method not allowed')
          return
        }
        if (!triggerUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'LD_TRIGGER_URL not configured in .env' }))
          return
        }
        try {
          const response = await fetch(triggerUrl, { method: 'POST' })
          const data = await response.text()
          console.log(`[LD Trigger] Manual fire → ${response.status}`)
          res.writeHead(response.status, { 'Content-Type': 'application/json' })
          res.end(data || JSON.stringify({ ok: response.ok }))
        } catch (err) {
          console.error('[LD Trigger] Error:', err.message)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), solemateBackend()],
})
