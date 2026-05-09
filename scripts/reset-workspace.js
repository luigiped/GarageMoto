#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = process.cwd()
const NPM_CACHE_DIR = '/private/tmp/garagemoto-npm-cache'

const DIRS_TO_REMOVE = [
  'node_modules',
  '.expo',
]

const FILES_TO_KEEP = [
  'package-lock.json',
]

console.log('[reset] GarageMoto workspace reset')
console.log(`[reset] Root: ${ROOT}`)

for (const relativePath of DIRS_TO_REMOVE) {
  const target = path.join(ROOT, relativePath)
  if (fs.existsSync(target)) {
    console.log(`[reset] Removing ${relativePath}`)
    fs.rmSync(target, { recursive: true, force: true })
  }
}

for (const name of fs.readdirSync(ROOT)) {
  if (!name.endsWith('.bak')) {
    continue
  }

  const target = path.join(ROOT, name)
  console.log(`[reset] Removing backup ${name}`)
  fs.rmSync(target, { recursive: true, force: true })
}

for (const keep of FILES_TO_KEEP) {
  if (!fs.existsSync(path.join(ROOT, keep))) {
    console.error(`[reset] Missing required file: ${keep}`)
    process.exit(1)
  }
}

const hasValidLockfile = isValidJsonFile(path.join(ROOT, 'package-lock.json'))

if (!hasValidLockfile) {
  console.log('[reset] package-lock.json non valido: uso npm install per rigenerarlo')
}

const installArgs = hasValidLockfile
  ? ['ci', '--no-fund', '--no-audit', '--cache', NPM_CACHE_DIR]
  : ['install', '--no-fund', '--no-audit', '--cache', NPM_CACHE_DIR]

const install = spawnSync(
  'npm',
  installArgs,
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  },
)

if (install.status !== 0) {
  process.exit(install.status ?? 1)
}

const verify = spawnSync(
  'node',
  ['scripts/expo-install-health.js'],
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  },
)

if (verify.status !== 0) {
  console.error('[reset] Install completed but doctor still reports missing runtime files.')
  process.exit(verify.status ?? 1)
}

console.log('[reset] Workspace rebuild completed successfully')
console.log('[reset] Next command: npm run start:dev-client')

function isValidJsonFile(filePath) {
  try {
    JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return true
  } catch {
    return false
  }
}
