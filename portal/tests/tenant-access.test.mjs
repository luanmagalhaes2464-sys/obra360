import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const files=['server-v3.mjs','server-proxy-v4.mjs','lib/motor-routes.mjs','lib/field-routes.mjs','lib/governance-routes.mjs','lib/workforce-routes.mjs','lib/reporting-routes.mjs','lib/municipal-routes.mjs','lib/intelligence-routes.mjs']

test('client company membership never grants access to every project',async()=>{
  for(const file of files){
    const source=await readFile(new URL(`../${file}`,import.meta.url),'utf8')
    assert.doesNotMatch(source,/WHERE p\.id=\$1 AND \(cu\.user_id IS NOT NULL OR pm\.user_id IS NOT NULL\)/,file)
    assert.match(source,/cu\.role<>'client'/,file)
  }
})

test('project listing keeps clients scoped to explicit membership',async()=>{
  const source=await readFile(new URL('../server-v3.mjs',import.meta.url),'utf8')
  assert.match(source,/\$2='team'.+cu\.role<>'client'.+pm\.user_id IS NOT NULL/)
})
