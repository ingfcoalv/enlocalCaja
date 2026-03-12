import { build } from 'esbuild'
import { cpSync, rmSync, mkdirSync, existsSync, realpathSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// External: electron (runtime), native addons, and packages with instanceof issues in bundles
const externals = [
  'electron',
  'electron-updater',
  'serialport',
  '@serialport/parser-readline',
  'sharp',
  'pg',
  'pg-pool',
  'pg-protocol',
  'pg-types',
  'drizzle-orm',
]

const sharedOptions = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: externals,
  sourcemap: true,
  minify: false,
  resolveExtensions: ['.ts', '.js', '.json'],
}

// Clean previous build
if (existsSync('dist/electron')) rmSync('dist/electron', { recursive: true })

// Bundle main process
await build({
  ...sharedOptions,
  entryPoints: ['electron/main.ts'],
  outfile: 'dist/electron/electron/main.js',
})

// Bundle preload script
await build({
  ...sharedOptions,
  entryPoints: ['electron/preload.ts'],
  outfile: 'dist/electron/electron/preload.js',
})

console.log('[esbuild] Electron main + preload bundled successfully')

// ─── Copy launcher HTML ───
mkdirSync('dist/electron/electron/launcher', { recursive: true })
cpSync('electron/launcher/launcher.html', 'dist/electron/electron/launcher/launcher.html')
console.log('[esbuild] Copied launcher.html')

// ─── Copy modules to dist/electron/node_modules/ ───
const rootModules = resolve('../../node_modules')
const vendorDir = 'dist/electron/node_modules'

// Native modules (binary)
const nativeModules = [
  'sharp',
  '@img/sharp-win32-x64',
]

// JS modules that must NOT be bundled (instanceof/class issues)
const externalJsModules = [
  'electron-updater',
  'pg',
  'pg-pool',
  'pg-protocol',
  'pg-types',
  'pg-cloudflare',
  'pg-connection-string',
  'pg-int8',
  'pgpass',
  'pg-numeric',
  'postgres-array',
  'postgres-bytea',
  'postgres-date',
  'postgres-interval',
  'postgres-range',
  'obuf',
  'packet-reader',
  'buffer-writer',
  'split2',
  'drizzle-orm',
]

const allModules = [...nativeModules, ...externalJsModules]

for (const mod of allModules) {
  const src = resolve(rootModules, mod)
  if (existsSync(src)) {
    const dst = resolve(vendorDir, mod)
    mkdirSync(resolve(dst, '..'), { recursive: true })
    const realSrc = realpathSync(src)
    cpSync(realSrc, dst, { recursive: true })
    console.log(`[esbuild] Copied module: ${mod}`)
  } else {
    // Try .pnpm hoisted path
    const pnpmSrc = resolve(rootModules, '.pnpm', 'node_modules', mod)
    if (existsSync(pnpmSrc)) {
      const dst = resolve(vendorDir, mod)
      mkdirSync(resolve(dst, '..'), { recursive: true })
      const realSrc = realpathSync(pnpmSrc)
      cpSync(realSrc, dst, { recursive: true })
      console.log(`[esbuild] Copied module (pnpm): ${mod}`)
    } else {
      console.warn(`[esbuild] WARN: ${mod} not found — skipping`)
    }
  }
}

// ─── Stripped package.json for electron-builder ───
const depEntries = {}
for (const mod of allModules) {
  depEntries[mod] = '*'
}
depEntries['electron-updater'] = '^6.0.0'
writeFileSync('dist/electron/package.json', JSON.stringify({
  name: '@enlocal/caja',
  version: '1.6.0',
  description: 'enLocal Caja - Punto de Venta',
  author: 'todoEnLocal <soporte@todoenlocal.com>',
  main: 'electron/main.js',
  dependencies: depEntries,
}, null, 2))

// ─── Copy webapp ───
if (existsSync('webapp/dist')) {
  cpSync('webapp/dist', 'dist/electron/webapp/dist', { recursive: true })
  console.log('[esbuild] Copied webapp/dist')
} else {
  console.warn('[esbuild] WARN: webapp/dist not found — run "cd webapp && vite build" first')
}

console.log('[esbuild] Build complete')
