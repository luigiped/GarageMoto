#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = process.cwd()
const SHOULD_FIX = process.argv.includes('--fix')
const NPM_CACHE_DIR = '/private/tmp/garagemoto-npm-cache'

const CHECKS = [
  {
    pkg: '@expo/config',
    version: '12.0.13',
    file: 'node_modules/@expo/config/build/index.js',
  },
  {
    pkg: '@expo/config-plugins',
    version: '54.0.4',
    file: 'node_modules/@expo/config-plugins/build/index.js',
  },
  {
    pkg: '@expo/config-plugins',
    version: '54.0.4',
    file: 'node_modules/@expo/config-plugins/build/android/Permissions.js',
  },
  {
    pkg: '@expo/json-file',
    version: '10.0.14',
    file: 'node_modules/@expo/json-file/build/JsonFile.js',
  },
  {
    pkg: '@expo/plist',
    version: '0.4.8',
    file: 'node_modules/@expo/plist/build/index.js',
  },
  {
    pkg: '@expo/prebuild-config',
    version: '54.0.8',
    file: 'node_modules/@expo/prebuild-config/build/index.js',
  },
  {
    pkg: '@expo/spawn-async',
    version: '1.7.2',
    file: 'node_modules/@expo/spawn-async/build/spawnAsync.js',
  },
  {
    pkg: '@expo/vector-icons',
    version: '15.1.1',
    file: 'node_modules/@expo/vector-icons/build/IconsLazy.js',
  },
  {
    pkg: 'ajv',
    version: '8.20.0',
    file: 'node_modules/ajv/dist/compile/rules.js',
  },
  {
    pkg: '@0no-co/graphql.web',
    version: '1.2.0',
    file: 'node_modules/@0no-co/graphql.web/dist/graphql.web.js',
  },
]

const missing = CHECKS.filter((check) => !fs.existsSync(path.join(ROOT, check.file)))

if (missing.length === 0) {
  console.log('[deps] Expo install health: ok')
  process.exit(0)
}

console.error('[deps] Expo install health: missing runtime files')
for (const item of missing) {
  console.error(`- ${item.file}`)
}

if (!SHOULD_FIX) {
  console.error('[deps] Run: npm run deps:repair')
  process.exit(1)
}

const packagesToRepair = new Map()
for (const item of missing) {
  packagesToRepair.set(item.pkg, item.version)
}

for (const pkg of packagesToRepair.keys()) {
  const dir = path.join(ROOT, 'node_modules', ...pkg.split('/'))
  fs.rmSync(dir, { recursive: true, force: true })
}

const installArgs = [
  'install',
  '--no-save',
  '--no-fund',
  '--no-audit',
  '--cache',
  NPM_CACHE_DIR,
  ...Array.from(packagesToRepair.entries()).map(([pkg, version]) => `${pkg}@${version}`),
]

console.log(`[deps] Repairing packages: ${Array.from(packagesToRepair.keys()).join(', ')}`)

const result = spawnSync('npm', installArgs, {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const stillMissing = CHECKS.filter((check) => !fs.existsSync(path.join(ROOT, check.file)))
if (stillMissing.length > 0) {
  console.error('[deps] Repair incomplete. Missing after reinstall:')
  for (const item of stillMissing) {
    console.error(`- ${item.file}`)
  }
  process.exit(1)
}

console.log('[deps] Repair completed successfully')
