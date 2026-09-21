import test from 'node:test'
import assert from 'node:assert/strict'
import {workingDays,requiredCrew,capacityRows} from '../lib/capacity-engine.mjs'
test('capacity uses working days and remaining quantity',()=>{assert.equal(workingDays('2026-09-21','2026-09-25'),5);assert.equal(requiredCrew({planned_quantity:100,actual_quantity:20,planned_productivity:4,planned_start:'2026-09-21',planned_end:'2026-09-25'}),4)})
test('capacity exposes missing inputs instead of inventing a number',()=>{assert.equal(requiredCrew({planned_quantity:100,planned_start:'2026-09-21',planned_end:'2026-09-25'}),null)})
test('capacity compares demand with workers of the same trade',()=>{const rows=capacityRows([{id:1,status:'pending',workforce_trade:'Pedreiro',planned_quantity:100,actual_quantity:20,planned_productivity:4,planned_start:'2026-09-21',planned_end:'2026-09-25'}],[{trade:'Pedreiro',active:true,availability_status:'available'},{trade:'Pedreiro',active:true,availability_status:'unavailable'}]);assert.equal(rows[0].required_people,4);assert.equal(rows[0].available_people,1);assert.equal(rows[0].status_capacity,'deficit')})
