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
let agentRoutes = extractBlock(
  legacy,
  'const agentRoutes = String.raw`',
  "\n\nsource = source.replace(anchor, agentRoutes + '\\n' + anchor)"
)

const oldFinance = "  if(/(quanto|gasto|gastou|orcamento|orçamento|custo|finance)/.test(text.toLowerCase()))return 'Orçamento registrado: '+agentMoney(b.project.budget)+'. Realizado: '+agentMoney(b.project.spent)+'. Comprometido: '+agentMoney(b.project.committed)+'.'"
const betterAnswers = `  if(/(quanto tempo|quando termina|quando vai terminar|prazo|previsao de termino|previsao de conclusao|data de entrega|terminar a obra|concluir a obra)/.test(low)){
    const end=b.project.planned_end_date
    if(!end)return 'Ainda não tenho uma data prevista de conclusão cadastrada para esta obra. Então eu prefiro não inventar quanto tempo falta. Se você cadastrar a previsão de entrega, eu passo a acompanhar esse prazo com você.'
    const target=new Date(String(end).slice(0,10)+'T12:00:00'),days=Math.ceil((target.getTime()-Date.now())/86400000),label=target.toLocaleDateString('pt-BR')
    if(days>1)return 'Pelo prazo cadastrado, faltam cerca de '+days+' dias até a previsão de conclusão, em '+label+'. Essa é a data planejada no sistema e pode mudar conforme o andamento real.'
    if(days===1)return 'Pelo prazo cadastrado, a previsão de conclusão é amanhã, em '+label+'.'
    if(days===0)return 'Pelo prazo cadastrado, a previsão de conclusão é hoje, '+label+'.'
    return 'A data prevista de conclusão cadastrada era '+label+', que já passou. Vale revisar o cronograma antes de eu te dar uma nova previsão.'
  }
  if(/(gasto|gastou|orcamento|orçamento|custo|financeiro|financeira|valor da obra|quanto ja gast|quanto já gast)/.test(text.toLowerCase()))return 'Hoje o orçamento cadastrado é '+agentMoney(b.project.budget)+'. Já foram realizados '+agentMoney(b.project.spent)+' e há '+agentMoney(b.project.committed)+' comprometidos.'`
if (agentRoutes.includes(oldFinance)) agentRoutes = agentRoutes.replace(oldFinance, betterAnswers)

const oldReturn = "  return {summary:transcript.trim(),action,suggestions,safety,nextStep:next?.title||'',answer,createLabel,confidence:suggestions.length?Math.max(...suggestions.map(s=>s.confidence||0)):70,mode:'grounded'}"
const newReturn = "  return {summary:transcript.trim(),action,suggestions:action==='query'?[]:suggestions,safety,nextStep:next?.title||'',answer,createLabel,confidence:suggestions.length?Math.max(...suggestions.map(s=>s.confidence||0)):70,mode:'grounded'}"
if (agentRoutes.includes(oldReturn)) agentRoutes = agentRoutes.replace(oldReturn, newReturn)

const oldContext = "    const context='PROJETO: '+b.project.name+'\\nPROGRESSO: '+b.summary.progress+'%\\nPRÓXIMA AÇÃO: '+(b.summary.nextTask?.title||'nenhuma')+'\\nTAREFAS:\\n'+taskList+'\\n\\nCOMANDO/RELATO:\\n'+transcript"
const newContext = "    const context='PROJETO: '+b.project.name+'\\nPROGRESSO: '+b.summary.progress+'%\\nPREVISÃO DE CONCLUSÃO: '+(b.project.planned_end_date||'não cadastrada')+'\\nORÇAMENTO: '+agentMoney(b.project.budget)+'\\nREALIZADO: '+agentMoney(b.project.spent)+'\\nPRÓXIMA AÇÃO: '+(b.summary.nextTask?.title||'nenhuma')+'\\nTAREFAS:\\n'+taskList+'\\n\\nCOMANDO/RELATO:\\n'+transcript"
if (agentRoutes.includes(oldContext)) agentRoutes = agentRoutes.replace(oldContext, newContext)

const oldInstruction = "Você é o Agente de Voz do Obra360. Interprete comandos e perguntas sobre uma obra. Nunca invente fatos e nunca valide tecnicamente um serviço. Para perguntas, use action=query e responda apenas com base no contexto. Para comandos, use action done, reopen, na, create_task, create_stage, attention ou log. Retorne SOMENTE JSON válido: {summary:string,action:string,taskIds:number[],safety:string[],nextStep:string,answer:string,createLabel:string,confidence:number}. Só use ids fornecidos. Alterações sempre serão confirmadas pelo humano."
const newInstruction = "Você é o Copiloto de Voz do Obra360. Converse em português brasileiro de forma natural, curta e clara, como um bom assistente de campo falando com uma pessoa, sem linguagem robótica. Interprete comandos e perguntas sobre a obra. Nunca invente fatos, datas ou prazos e nunca valide tecnicamente um serviço. Para perguntas, use action=query e responda somente com o que existe no contexto; se faltar um dado, diga isso naturalmente. Para comandos, use action done, reopen, na, create_task, create_stage, attention ou log. Retorne SOMENTE JSON válido: {summary:string,action:string,taskIds:number[],safety:string[],nextStep:string,answer:string,createLabel:string,confidence:number}. Só use ids fornecidos. Alterações sempre serão confirmadas pelo humano."
if (agentRoutes.includes(oldInstruction)) agentRoutes = agentRoutes.replace(oldInstruction, newInstruction)

source = source.replace(anchor, agentRoutes + '\n' + anchor)

await fs.writeFile(runtimePath, source, 'utf8')
await import('./.server-v3-runtime.mjs')
