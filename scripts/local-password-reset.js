#!/usr/bin/env node

const http = require('http')
const fs = require('fs')
const path = require('path')
const { URLSearchParams } = require('url')
const { createClient } = require('@supabase/supabase-js')
const WebSocket = require('ws')

const ROOT = path.resolve(__dirname, '..')
const PORT = Number(process.env.PORT || 54323)
const HOST = '127.0.0.1'
const REDIRECT_URL = `http://localhost:${PORT}/reset-password`

loadEnvFile(path.join(ROOT, '.env.local'))

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  realtime: {
    transport: WebSocket,
  },
})

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)

    if (req.method === 'GET' && url.pathname === '/') {
      sendHtml(res, requestPage())
      return
    }

    if (req.method === 'POST' && url.pathname === '/request') {
      const body = await readBody(req)
      const email = String(body.email || '').trim().toLowerCase()

      if (!email) {
        sendHtml(res, requestPage('Inserisci una email valida.'))
        return
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: REDIRECT_URL,
      })

      if (error) {
        sendHtml(res, requestPage(`Errore Supabase: ${escapeHtml(error.message)}`))
        return
      }

      sendHtml(res, requestPage(`Link inviato a ${escapeHtml(email)}. Apri la mail su questo Mac.`))
      return
    }

    if (req.method === 'GET' && url.pathname === '/reset-password') {
      sendHtml(res, resetPage())
      return
    }

    if (req.method === 'POST' && url.pathname === '/update') {
      const body = await readJson(req)
      const password = String(body.password || '')
      const accessToken = String(body.accessToken || '')
      const refreshToken = String(body.refreshToken || '')
      const code = String(body.code || '')

      if (password.length < 6) {
        sendJson(res, 400, { error: 'La password deve essere di almeno 6 caratteri.' })
        return
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          sendJson(res, 400, { error: error.message })
          return
        }
      } else {
        if (!accessToken || !refreshToken) {
          sendJson(res, 400, { error: 'Token di reset mancanti. Richiedi un nuovo link.' })
          return
        }

        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (error) {
          sendJson(res, 400, { error: error.message })
          return
        }
      }

      const { error } = await supabase.auth.updateUser({ password })
      await supabase.auth.signOut().catch(() => undefined)

      if (error) {
        sendJson(res, 400, { error: error.message })
        return
      }

      sendJson(res, 200, { ok: true })
      return
    }

    res.writeHead(404)
    res.end('Not found')
  } catch (error) {
    console.error('[local-password-reset]', error)
    res.writeHead(500)
    res.end('Internal server error')
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Local password reset helper running: http://localhost:${PORT}`)
  console.log(`Supabase redirect URL to allow: ${REDIRECT_URL}`)
})

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const index = trimmed.indexOf('=')
    if (index === -1) {
      continue
    }

    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    value = value.replace(/^['"]|['"]$/g, '')

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function requestPage(message = '') {
  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GarageMoto Reset Password Locale</title>
  ${styles()}
</head>
<body>
  <main>
    <h1>GarageMoto</h1>
    <h2>Reset password locale</h2>
    ${message ? `<p class="message">${message}</p>` : ''}
    <form method="post" action="/request">
      <label>Email account</label>
      <input name="email" type="email" autocomplete="email" required autofocus>
      <button type="submit">Invia link reset</button>
    </form>
    <p class="hint">Il link deve aprire <code>${escapeHtml(REDIRECT_URL)}</code>. Non serve l'app sul telefono.</p>
  </main>
</body>
</html>`
}

function resetPage() {
  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nuova password GarageMoto</title>
  ${styles()}
</head>
<body>
  <main>
    <h1>GarageMoto</h1>
    <h2>Nuova password</h2>
    <p id="status" class="message">Link letto. Inserisci la nuova password.</p>
    <form id="reset-form">
      <label>Nuova password</label>
      <input id="password" type="password" autocomplete="new-password" minlength="6" required autofocus>
      <label>Conferma password</label>
      <input id="confirm" type="password" autocomplete="new-password" minlength="6" required>
      <button type="submit">Aggiorna password</button>
    </form>
    <p class="hint">Dopo il successo puoi tornare ad accedere dall'app con la nuova password.</p>
  </main>
  <script>
    const statusEl = document.getElementById('status')
    const form = document.getElementById('reset-form')
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    const accessToken = hash.get('access_token') || query.get('access_token') || ''
    const refreshToken = hash.get('refresh_token') || query.get('refresh_token') || ''
    const code = query.get('code') || hash.get('code') || ''

    if (!code && (!accessToken || !refreshToken)) {
      statusEl.textContent = 'Token di reset mancanti. Richiedi un nuovo link dalla pagina iniziale.'
      statusEl.className = 'message error'
      form.querySelector('button').disabled = true
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const password = document.getElementById('password').value
      const confirm = document.getElementById('confirm').value

      if (password !== confirm) {
        statusEl.textContent = 'Le password non coincidono.'
        statusEl.className = 'message error'
        return
      }

      statusEl.textContent = 'Aggiornamento password in corso...'
      statusEl.className = 'message'

      const response = await fetch('/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, accessToken, refreshToken, code }),
      })
      const result = await response.json()

      if (!response.ok) {
        statusEl.textContent = result.error || 'Aggiornamento non riuscito.'
        statusEl.className = 'message error'
        return
      }

      statusEl.textContent = 'Password aggiornata correttamente. Ora accedi dall’app con la nuova password.'
      statusEl.className = 'message success'
      form.reset()
      form.querySelector('button').disabled = true
    })
  </script>
</body>
</html>`
}

function styles() {
  return `<style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #06080f; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(92vw, 420px); }
    h1 { margin: 0 0 8px; font-size: 32px; }
    h2 { margin: 0 0 24px; color: rgba(255,255,255,.72); font-size: 18px; font-weight: 500; }
    label { display: block; margin: 16px 0 6px; color: rgba(255,255,255,.72); font-size: 14px; }
    input { box-sizing: border-box; width: 100%; padding: 14px 16px; border: 1px solid rgba(255,255,255,.14); border-radius: 12px; background: rgba(14,24,42,.72); color: #fff; font-size: 16px; }
    button { width: 100%; margin-top: 18px; padding: 15px 16px; border: 0; border-radius: 12px; background: #1971c2; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .55; cursor: default; }
    code { color: #74b0ff; }
    .message { padding: 12px 14px; border: 1px solid rgba(6,182,212,.28); border-radius: 12px; background: rgba(6,182,212,.12); line-height: 1.35; }
    .message.error { border-color: rgba(255,69,58,.35); background: rgba(255,69,58,.12); color: #ffb4ae; }
    .message.success { border-color: rgba(48,209,88,.35); background: rgba(48,209,88,.12); color: #baffc9; }
    .hint { margin-top: 18px; color: rgba(255,255,255,.58); line-height: 1.45; font-size: 14px; }
  </style>`
}

function sendHtml(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(html)
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

async function readBody(req) {
  const raw = await readRawBody(req)
  return Object.fromEntries(new URLSearchParams(raw))
}

async function readJson(req) {
  const raw = await readRawBody(req)
  return raw ? JSON.parse(raw) : {}
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
