import crypto from 'node:crypto'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { init } from '@launchdarkly/node-server-sdk'
import { initAi } from '@launchdarkly/server-sdk-ai'
import { handleChat, executeImplementer } from './server/pipeline.js'

function solemateBackend() {
  let anthropicApiKey = ''
  let triggerUrl = ''
  let ldClientsPromise = null
  const triggerState = { fired: false }
  const reasoningStreams = new Map()
  const pendingApprovals = new Map()

  function emitReasoning(reasoningId, event) {
    const sseRes = reasoningStreams.get(reasoningId)
    if (!sseRes) return
    try {
      sseRes.write(`data: ${JSON.stringify(event)}\n\n`)
    } catch { /* client disconnected */ }
  }

  return {
    name: 'solemate-backend',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '')
      anthropicApiKey = env.ANTHROPIC_API_KEY || ''
      triggerUrl = env.LD_TRIGGER_URL || ''
      const sdkKey = env.LD_SERVER_SDK_KEY || ''

      if (sdkKey) {
        ldClientsPromise = (async () => {
          try {
            const ldClient = init(sdkKey)
            await ldClient.waitForInitialization({ timeout: 10 })
            console.log('[LD Server] AI SDK initialized')
            return { ldClient, aiClient: initAi(ldClient) }
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
      // --- SSE reasoning stream with heartbeat ---
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        if (!url.pathname.startsWith('/api/reasoning')) return next()
        if (req.method !== 'GET') {
          res.writeHead(405)
          res.end('Method not allowed')
          return
        }
        const id = url.searchParams.get('id')
        if (!id) {
          res.writeHead(400)
          res.end('Missing id parameter')
          return
        }
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        })
        res.write('\n')
        reasoningStreams.set(id, res)

        const heartbeat = setInterval(() => {
          try { res.write(':heartbeat\n\n') } catch { clearInterval(heartbeat) }
        }, 15000)

        req.on('close', () => {
          clearInterval(heartbeat)
          reasoningStreams.delete(id)
        })
      })

      // --- Chat handler: delegates to pipeline ---
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405)
          res.end('Method not allowed')
          return
        }

        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const body = JSON.parse(Buffer.concat(chunks).toString())
        const { messages = [], userKey = 'solemate-anonymous', reasoningId: clientReasoningId } = body
        const reasoningId = clientReasoningId || crypto.randomUUID()

        await new Promise((r) => setTimeout(r, 50))

        const clients = ldClientsPromise ? await ldClientsPromise : null

        if (!clients) {
          console.warn('[LD Server] LD client unavailable — running with fallback configs')
        }

        try {
          const result = await handleChat({
            aiClient: clients?.aiClient || null,
            ldClient: clients?.ldClient || null,
            anthropicApiKey,
            messages,
            userKey,
            reasoningId,
            emitReasoning,
            pendingApprovals,
            triggerUrl,
            triggerState,
          })

          const statusCode = result.error ? 500 : 200
          res.writeHead(statusCode, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))
        } catch (err) {
          console.error('[LD Server] Unhandled chat error:', err)
          emitReasoning(reasoningId, {
            node: 'pipeline', status: 'warn',
            timestamp: Date.now(), detail: err.message,
          })
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message, reasoningId }))
        }
      })

      // --- HITL approval: runs remaining pipeline after approval ---
      server.middlewares.use('/api/approve', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405)
          res.end('Method not allowed')
          return
        }

        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const body = JSON.parse(Buffer.concat(chunks).toString())
        const { reasoningId, approved } = body

        const pending = pendingApprovals.get(reasoningId)
        if (!pending) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'No pending approval found for this reasoningId' }))
          return
        }

        pendingApprovals.delete(reasoningId)
        const clients = ldClientsPromise ? await ldClientsPromise : null

        if (approved) {
          emitReasoning(reasoningId, {
            node: 'solemate-reviewer', status: 'success',
            timestamp: Date.now(), detail: 'Human approved',
          })

          if (clients) {
            try {
              const context = { kind: 'user', key: 'solemate-anonymous' }
              const result = await executeImplementer({
                aiClient: clients.aiClient,
                ldClient: clients.ldClient,
                anthropicApiKey,
                context,
                plan: pending.plan,
                reviewerText: pending.orderSummary,
                reasoningId,
                emitReasoning,
                isAutonomous: false,
              })
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ confirmed: true, reply: result.reply }))
            } catch (err) {
              console.error('[LD Server] Post-approval error:', err)
              const orderId = 'SM-' + crypto.randomUUID().slice(0, 8).toUpperCase()
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ confirmed: true, orderId }))
            }
          } else {
            const orderId = 'SM-' + crypto.randomUUID().slice(0, 8).toUpperCase()
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ confirmed: true, orderId }))
          }
        } else {
          emitReasoning(reasoningId, {
            node: 'solemate-reviewer', status: 'blocked',
            timestamp: Date.now(), detail: 'Human declined',
          })
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ confirmed: false }))
        }
      })

      // --- Manual trigger (unchanged) ---
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
