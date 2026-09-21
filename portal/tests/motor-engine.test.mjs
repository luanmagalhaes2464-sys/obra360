import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMotorState, ganttWindow, wouldCreateCycle } from '../lib/motor-engine.mjs'

const tasks = [
  {id:1,title:'Fundação',status:'done',priority:'alta',task_order:1,planned_start:'2026-09-01',planned_end:'2026-09-05'},
  {id:2,title:'Estrutura',status:'pending',priority:'critica',task_order:2,planned_start:'2026-09-06',planned_end:'2026-09-12'},
  {id:3,title:'Alvenaria',status:'pending',priority:'normal',task_order:3,planned_start:'2026-09-13',planned_end:'2026-09-20'},
]

test('motor releases only activities with completed predecessors and no blockers', () => {
  const dependencies = [
    {predecessor_id:1,successor_id:2},
    {predecessor_id:2,successor_id:3},
  ]
  const state = buildMotorState(tasks, dependencies, [], new Date('2026-09-10T12:00:00Z'))
  assert.equal(state.activities.find(item => item.id === 2).readiness, 'ready')
  assert.equal(state.activities.find(item => item.id === 3).readiness, 'waiting')
  assert.deepEqual(state.nextActions.map(item => item.id), [2])
})

test('active blockers override dependency readiness and resolved blockers do not', () => {
  const active = buildMotorState(tasks, [], [{id:9,activity_id:2,status:'active',title:'Concreto não confirmado'}])
  assert.equal(active.activities.find(item => item.id === 2).readiness, 'blocked')
  const resolved = buildMotorState(tasks, [], [{id:9,activity_id:2,status:'resolved',title:'Concreto confirmado'}])
  assert.equal(resolved.activities.find(item => item.id === 2).readiness, 'ready')
})

test('dependency graph rejects self links and cycles', () => {
  const dependencies = [{predecessor_id:1,successor_id:2},{predecessor_id:2,successor_id:3}]
  assert.equal(wouldCreateCycle(dependencies,3,1),true)
  assert.equal(wouldCreateCycle(dependencies,2,2),true)
  assert.equal(wouldCreateCycle(dependencies,1,3),false)
})

test('gantt window uses the first and last planned date', () => {
  assert.deepEqual(ganttWindow(tasks),{start:'2026-09-01',end:'2026-09-20',days:20})
  assert.equal(ganttWindow([{id:1}]),null)
})
