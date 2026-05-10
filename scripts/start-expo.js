#!/usr/bin/env node

const { spawn, spawnSync } = require('child_process')
const path = require('path')

const START_ARGS = process.argv.slice(2)
let lastStatus = 0
const expoCliPath = resolveExpoCli()

if (!START_ARGS.includes('--web')) {
  const usesDevClient = START_ARGS.includes('--dev-client')
  console.log(
    usesDevClient
      ? '[start] Smartphone: apri GarageMoto Development Build.'
      : '[start] Attenzione: per smartphone questa app richiede la development build, non Expo Go.',
  )
}

run('node', ['scripts/expo-install-health.js'])

if (lastStatus !== 0) {
  console.log('[start] Dipendenze incomplete: eseguo reset completo da lockfile.')
  run('node', ['scripts/reset-workspace.js'])
  if (lastStatus !== 0) {
    process.exit(lastStatus)
  }
}

runExpoStart(process.execPath, [expoCliPath, 'start', ...START_ARGS])

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  })

  lastStatus = result.status ?? 1
}

function runExpoStart(command, args) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  })

  child.on('exit', (code) => {
    process.exit(code ?? 1)
  })

  child.on('error', (error) => {
    console.error('[start] expo start failed:', error)
    process.exit(1)
  })
}

function resolveExpoCli() {
  try {
    return require.resolve('expo/bin/cli', { paths: [process.cwd()] })
  } catch {
    return path.join(process.cwd(), 'node_modules', 'expo', 'bin', 'cli')
  }
}
