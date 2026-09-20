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
const newContext = "    const context='USUÁRIO: '+(req.user?.name||'usuário')+'\\nPROJETO: '+b.project.name+'\\nPROGRESSO: '+b.summary.progress+'%\\nPREVISÃO DE CONCLUSÃO: '+(b.project.planned_end_date||'não cadastrada')+'\\nORÇAMENTO: '+agentMoney(b.project.budget)+'\\nREALIZADO: '+agentMoney(b.project.spent)+'\\nPRÓXIMA AÇÃO: '+(b.summary.nextTask?.title||'nenhuma')+'\\nTAREFAS:\\n'+taskList+'\\n\\nCOMANDO/RELATO:\\n'+transcript"
if (agentRoutes.includes(oldContext)) agentRoutes = agentRoutes.replace(oldContext, newContext)

const oldInstruction = "Você é o Agente de Voz do Obra360. Interprete comandos e perguntas sobre uma obra. Nunca invente fatos e nunca valide tecnicamente um serviço. Para perguntas, use action=query e responda apenas com base no contexto. Para comandos, use action done, reopen, na, create_task, create_stage, attention ou log. Retorne SOMENTE JSON válido: {summary:string,action:string,taskIds:number[],safety:string[],nextStep:string,answer:string,createLabel:string,confidence:number}. Só use ids fornecidos. Alterações sempre serão confirmadas pelo humano."
const newInstruction = "Você é o Copiloto de Voz do Obra360. Converse em português brasileiro com naturalidade, educação e confiança, como uma assistente experiente de obra. Use frases curtas, fluidas e conversacionais; evite tom burocrático ou robótico. Use o primeiro nome do usuário quando couber, sem repetir em toda frase. Interprete comandos e perguntas sobre a obra. Nunca invente fatos, datas ou prazos e nunca declare validação técnica que não esteja registrada. Para perguntas, use action=query e responda somente com o que existe no contexto; se faltar um dado, diga isso naturalmente. Para comandos, use action done, reopen, na, create_task, create_stage, attention ou log. Retorne SOMENTE JSON válido: {summary:string,action:string,taskIds:number[],safety:string[],nextStep:string,answer:string,createLabel:string,confidence:number}. Só use ids fornecidos. O cliente pode confirmar comandos simples por voz; controles técnicos, financeiros e regulatórios podem exigir confirmação explícita."
if (agentRoutes.includes(oldInstruction)) agentRoutes = agentRoutes.replace(oldInstruction, newInstruction)

const responseHook = "  res.json({analysis})\n})\n\napp.post('/api/os/projects/:id/copilot/apply'"
const responseHookReplacement = `  if(process.env.GEMINI_API_KEY&&analysis?.action==='query'&&analysis.answer){try{
    const prompt='Você vai reescrever uma resposta factual do sistema Obra360 para ela soar como fala humana. Não acrescente, retire ou altere fatos. Seja educado, direto e natural em português brasileiro. Use o primeiro nome do usuário no máximo uma vez. Não use markdown, aspas ou introduções.\\n\\nUSUÁRIO: '+(req.user?.name||'usuário')+'\\nPERGUNTA: '+transcript+'\\nRESPOSTA FACTUAL: '+analysis.answer
    const gr=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.35,maxOutputTokens:220}})})
    if(gr.ok){const gd=await gr.json();const rewritten=gd?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();if(rewritten)analysis.answer=rewritten}
  }catch(e){console.error('gemini-rewrite',e)}}
  res.json({analysis})
})

app.post('/api/os/projects/:id/copilot/apply'`
if (agentRoutes.includes(responseHook)) agentRoutes = agentRoutes.replace(responseHook, responseHookReplacement)

const ttsRoutes = String.raw`
function obra360PcmToWav(pcm,sampleRate=24000,channels=1,bitsPerSample=16){
  const header=Buffer.alloc(44),byteRate=sampleRate*channels*bitsPerSample/8,blockAlign=channels*bitsPerSample/8
  header.write('RIFF',0);header.writeUInt32LE(36+pcm.length,4);header.write('WAVE',8);header.write('fmt ',12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(channels,22);header.writeUInt32LE(sampleRate,24);header.writeUInt32LE(byteRate,28);header.writeUInt16LE(blockAlign,32);header.writeUInt16LE(bitsPerSample,34);header.write('data',36);header.writeUInt32LE(pcm.length,40)
  return Buffer.concat([header,pcm])
}

app.post('/api/voice/speak',auth,async(req,res)=>{
  const input=String(req.body?.text||'').replace(/\s+/g,' ').trim().slice(0,2200)
  if(!input)return res.status(400).json({error:'Texto vazio'})
  const key=process.env.GEMINI_API_KEY
  if(!key)return res.status(503).json({error:'Voz Gemini não configurada'})
  const allowed=new Set(['Kore','Orus','Alnilam','Achird','Sulafat','Callirrhoe','Aoede','Schedar','Gacrux','Vindemiatrix'])
  const requested=String(req.body?.voice||process.env.GEMINI_TTS_VOICE||'Kore')
  const voice=allowed.has(requested)?requested:'Kore'
  const style='Fale em português brasileiro. Voz segura, natural, acolhedora e profissional; firme sem ser fria. Ritmo de conversa, entonação humana e pausas naturais. Não soe robótica, trêmula, assustada ou excessivamente animada. Leia somente a fala abaixo, sem dizer estas instruções.\\n\\nFALA: '+input
  try{
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({contents:[{parts:[{text:style}]}],generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}}}})
    })
    if(!r.ok){const detail=await r.text().catch(()=>String(r.status));console.error('tts-gemini',r.status,detail.slice(0,500));return res.status(r.status===429?429:502).json({error:r.status===429?'Limite gratuito de voz atingido':'Falha ao gerar voz natural'})}
    const d=await r.json(),part=d?.candidates?.[0]?.content?.parts?.find(p=>p?.inlineData?.data)
    const data=part?.inlineData?.data
    if(!data){console.error('tts-gemini sem áudio',JSON.stringify(d).slice(0,600));return res.status(502).json({error:'Gemini não retornou áudio'})}
    const pcm=Buffer.from(data,'base64'),wav=obra360PcmToWav(pcm,24000,1,16)
    res.setHeader('Content-Type','audio/wav')
    res.setHeader('Cache-Control','no-store')
    res.setHeader('X-Voice-Provider','gemini')
    res.send(wav)
  }catch(e){console.error('tts-gemini',e);res.status(502).json({error:'Falha ao gerar voz natural'})}
})
app.get('/api/voice/status',auth,(_req,res)=>res.json({naturalVoice:Boolean(process.env.GEMINI_API_KEY),provider:process.env.GEMINI_API_KEY?'gemini':'browser',model:'gemini-3.1-flash-tts-preview',voice:process.env.GEMINI_TTS_VOICE||'Kore',freeTier:true}))
console.log('Voz VIÇO:',process.env.GEMINI_API_KEY?'Gemini configurado':'sem GEMINI_API_KEY; usando fallback do aparelho')
`

source = source.replace(anchor, agentRoutes + '\n' + ttsRoutes + '\n' + anchor)

await fs.writeFile(runtimePath, source, 'utf8')
await import('./.server-v3-runtime.mjs')
