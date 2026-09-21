import test from 'node:test'
import assert from 'node:assert/strict'
import { MOTOR_SCHEMA_SQL, MOTOR_MIGRATION_VERSION } from '../lib/motor-schema.mjs'

test('motor migration is additive and versioned', () => {
  assert.match(MOTOR_MIGRATION_VERSION,/motor-01/)
  assert.doesNotMatch(MOTOR_SCHEMA_SQL,/(^|;)\s*(DROP|TRUNCATE|DELETE\s+FROM)\b/i)
  for (const table of ['companies','company_users','activity_dependencies','blockers','workers','teams','allocations','daily_reports','productivity_records','safety_requirements','activity_safety_requirements','documents','document_versions']) {
    assert.match(MOTOR_SCHEMA_SQL,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`))
  }
})

test('activity evolution preserves os_tasks and adds planning fields', () => {
  assert.match(MOTOR_SCHEMA_SQL,/ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS planned_start/)
  assert.match(MOTOR_SCHEMA_SQL,/ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS percent_complete/)
  assert.doesNotMatch(MOTOR_SCHEMA_SQL,/CREATE TABLE IF NOT EXISTS activities\b/)
})
