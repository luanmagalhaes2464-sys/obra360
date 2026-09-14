import fs from 'fs/promises'

const sourcePath = new URL('./server-v3.mjs', import.meta.url)
const runtimePath = new URL('./.server-v3-runtime.mjs', import.meta.url)

let source = await fs.readFile(sourcePath, 'utf8')

const before = "completed_by=CASE WHEN $1='done' THEN $2 ELSE NULL END"
const after = "completed_by=CASE WHEN $1='done' THEN $2::integer ELSE NULL END"

if (!source.includes(before) && !source.includes(after)) {
  throw new Error('Não foi possível localizar a atualização de completed_by para aplicar o hotfix.')
}

source = source.replace(before, after)
await fs.writeFile(runtimePath, source, 'utf8')
await import('./.server-v3-runtime.mjs')
