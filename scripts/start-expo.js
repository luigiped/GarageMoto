#!/usr/bin/env node

const { spawnSync } = require('child_process')

const START_ARGS = process.argv.slice(2)
let lastStatus = 0

run('node', ['scripts/expo-install-health.js'])

if (lastStatus !== 0) {
  console.log('[start] Dipendenze incomplete: eseguo reset completo da lockfile.')
  run('node', ['scripts/reset-workspace.js'])
  if (lastStatus !== 0) {
    process.exit(lastStatus)
  }
}

run('expo', ['start', ...START_ARGS])
process.exit(lastStatus)

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  })

  lastStatus = result.status ?? 1
}
