import fs from 'fs/promises'

const sourcePath = new URL('./server-v3.mjs', import.meta.url)
const legacyLauncherPath = new URL('./server-launcher.mjs', import.meta.url)
const runtimePath = new URL('./.server-v3-runtime.mjs', import.meta.url)

let source = await fs.readFile(sourcePath, 'utf8')
const legacy = await fs.readFile(legacyLauncherPath, 'utf8')

const before = "completed_by=CASE WHEN $1='done' THEN $2 ELSE NULL END"
const after = "completed_by=CASE WHEN $1='done' THEN $2::integer ELSE NULL END"
if (!source.includes(before) && !source.includes(after)) throw new Error('Não foi possível localizar completed_by.')
source = source.replace(before, after)

function extractBlock(text, startMarker, endMarker) {
  const startAt = text.indexOf(startMarker)
  if (startAt < 0) throw new Error('Bloco de agentes não encontrado: ' + startMarker)
  const bodyStart = startAt + startMarker.length
  const endAt = text.indexOf(endMarker, bodyStart)
  if (endAt < 0) throw new Error('Fim do bloco de agentes não encontrado.')
  return text.slice(bodyStart, endAt).replace(/`\s*$/, '')
}

const migrationAnchor = 'CREATE INDEX IF NOT EXISTS idx_os_tasks_project_stage'
if (!source.includes(migrationAnchor)) throw new Error('Ponto de migração dos agentes não encontrado.')
const agentTables = extractBlock(
  legacy,
  'const agentTables = String.raw`',
  "\nsource = source.replace(migrationAnchor, agentTables + migrationAnchor)"
)
source = source.replace(migrationAnchor, agentTables + migrationAnchor)

const anchor = "const dist=path.join(__dirname,'dist');"
if (!source.includes(anchor)) throw new Error('Ponto de injeção dos agentes não encontrado.')
const agentRoutes = extractBlock(
  legacy,
  'const agentRoutes = String.raw`',
  "\n\nsource = source.replace(anchor, agentRoutes + '\\n' + anchor)"
)
source = source.replace(anchor, agentRoutes + '\n' + anchor)

await fs.writeFile(runtimePath, source, 'utf8')
await import('./.server-v3-runtime.mjs')
