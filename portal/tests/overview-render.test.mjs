import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const realRequire = createRequire(import.meta.url)
function compile(file) {
  const source = readFileSync(new URL('../src/' + file, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {compilerOptions: {module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, jsx:ts.JsxEmit.ReactJSX}}).outputText
  const module = {exports:{}}
  vm.runInNewContext(compiled, {module, exports:module.exports, require: name => name === './operation-summary' ? compile('operation-summary.ts') : realRequire(name)})
  return module.exports
}
const Overview=compile('VicoOverview.tsx').default
const fixture = {
  project:{name:'Obra de teste local',city:'Viçosa',budget:1000,spent:120,committed:80},
  tasks:[
    {id:1,title:'Validar projeto técnico',priority:'critica',status:'pending',required:true,client_action:false,stage_key:'projeto',discipline:'engenharia'},
    {id:2,title:'Escolher revestimento',priority:'alta',status:'pending',required:true,client_action:true,stage_key:'projeto',discipline:'cliente'}
  ],
  stages:[{key:'projeto',title:'Projeto',applicable:2,done:0,progress:0}],photos:[],events:[]
}
const render=(data,staff)=>renderToStaticMarkup(React.createElement(Overview,{b:data,staff,openStage:()=>{},openCopilot:()=>{},setView:()=>{}}))
test('staff overview renders recorded priorities without invented metrics',()=>{
  const html=render(fixture,true)
  assert.match(html,/CENTRAL DA OBRA/)
  assert.match(html,/Validar projeto técnico/)
  assert.match(html,/Não equivale ao avanço físico da obra/)
  assert.match(html,/Sem medição estruturada/)
  assert.doesNotMatch(html,/Déficit previsto|dias de atraso/)
})
test('client overview shows their pending actions and no technical priority',()=>{
  const html=render(fixture,false)
  assert.match(html,/MINHA OBRA/)
  assert.match(html,/Escolher revestimento/)
  assert.doesNotMatch(html,/Validar projeto técnico/)
})
test('overview safely renders empty data and escaped user text',()=>{
  const html=render({...fixture,project:{...fixture.project,name:'<script>alert(1)</script>'},tasks:[],stages:[]},true)
  assert.match(html,/Nenhum item pendente/)
  assert.match(html,/&lt;script&gt;/)
  assert.doesNotMatch(html,/<script>/)
  assert.match(html,/Nenhum acontecimento registrado/)
})
