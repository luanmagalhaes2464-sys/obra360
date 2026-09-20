import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const activeFiles = [
  '../src/main.tsx',
  '../src/AppOSV5.tsx',
  '../src/VicoOverview.tsx',
  '../server-proxy-v5.mjs',
  '../server-proxy-v4.mjs',
  '../server-launcher-safe-v2.mjs',
  '../server-launcher-safe.mjs',
  '../server-v3.mjs',
]

test('active application uses the VIÇO identity consistently', () => {
  const source = activeFiles
    .map(file => readFileSync(new URL(file, import.meta.url), 'utf8'))
    .join('\n')

  assert.doesNotMatch(source, /Matinho|TecnoMata (Engenharia|Gateway)|Obra360 voz natural|Obra360 OS v3 ativo/)
  assert.match(source, /VIÇO/)
})
