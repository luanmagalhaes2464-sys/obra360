import test from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/operation-summary.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { pendingActions, checklistProgress } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
const task = (id, props = {}) => ({id, title: 'item', priority: 'normal', status: 'pending', required: false, client_action: false, stage_key: 'estrutura', discipline: 'engenharia', ...props})

test('actions sort by recorded priority, required flag and stable id', () => {
  const items = [task(1), task(2,{required:true}), task(3,{priority:'critica'}), task(4,{status:'done'}), task(5,{status:'na'})]
  assert.deepEqual(pendingActions(items).map(t=>t.id), [3,2,1])
  assert.deepEqual(items.map(t=>t.id), [1,2,3,4,5])
})
test('client actions exclude technical and completed items', () => {
  assert.deepEqual(pendingActions([task(1),task(2,{client_action:true}),task(3,{client_action:true,status:'done'})],true).map(t=>t.id),[2])
})
test('checklist excludes not-applicable and handles empty denominator', () => {
  assert.deepEqual(checklistProgress([task(1,{status:'done'}),task(2),task(3,{status:'na'})]),{applicable:2,done:1,percent:50})
  assert.deepEqual(checklistProgress([]),{applicable:0,done:0,percent:0})
  assert.equal(checklistProgress([task(1,{status:'na'})]).percent,0)
})
test('active bundle no longer imports competing branding scripts', () => {
  const entry=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8')
  assert.ok(!entry.includes("import './tecnomata-brand'"))
  assert.ok(!entry.includes("import './ui-refinements'"))
  const voice=readFileSync(new URL('../src/voice-conversation-stable.ts',import.meta.url),'utf8')
  assert.ok(!voice.includes('shouldAutoApply'))
  assert.ok(voice.includes('awaitingVoiceConfirmation = true'))
})
