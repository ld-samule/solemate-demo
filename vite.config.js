import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function anthropicProxy() {
  let apiKey = ''

  return {
    name: 'anthropic-proxy',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '')
      apiKey = env.ANTHROPIC_API_KEY || ''
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
        const body = Buffer.concat(chunks).toString()

        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body,
          })

          const data = await response.text()
          res.writeHead(response.status, { 'Content-Type': 'application/json' })
          res.end(data)
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

function ldTriggerProxy() {
  let triggerUrl = ''

  return {
    name: 'ld-trigger-proxy',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '')
      triggerUrl = env.LD_TRIGGER_URL || ''
    },
    configureServer(server) {
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
          console.log(`[LD Trigger] Fired → ${response.status}`)
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
  plugins: [react(), tailwindcss(), anthropicProxy(), ldTriggerProxy()],
})
