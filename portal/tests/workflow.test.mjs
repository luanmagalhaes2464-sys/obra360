import test from 'node:test'
import assert from 'node:assert/strict'
import { STAGES, buildWorkflow } from '../workflow-v3.mjs'

for (const kind of ['casa_nova', 'predio_residencial', 'comercial_novo', 'reforma', 'ampliacao']) {
  test(`workflow ${kind}: codes, stages and ordering remain valid`, () => {
    const tasks = buildWorkflow({ kind })
    const stages = new Set(STAGES.map(stage => stage.key))
    assert.ok(tasks.length > 0)
    assert.equal(new Set(tasks.map(task => task.code)).size, tasks.length)
    tasks.forEach((task, index) => {
      assert.ok(stages.has(task.stage_key), task.code)
      assert.equal(task.task_order, index + 1)
      assert.ok(task.title)
    })
  })
}

test('workflow does not mutate its input and returns independent task objects', () => {
  const profile = Object.freeze({ kind: 'casa_nova', floors: 2, workAtHeight: true })
  const first = buildWorkflow(profile)
  const second = buildWorkflow(profile)
  assert.deepEqual(first, second)
  first[0].title = 'changed locally'
  assert.notEqual(first[0].title, second[0].title)
})
