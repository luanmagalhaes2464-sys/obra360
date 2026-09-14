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

const anchor = "const dist=path.join(__dirname,'dist');"
if (!source.includes(anchor)) throw new Error('Ponto de injeção do copiloto não encontrado.')

const copilotRoutes = String.raw`
function copilotNorm(v=''){return String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ')}
function copilotTokens(v=''){const stop=new Set(['para','com','uma','uns','das','dos','que','hoje','amanha','obra','gente','foi','esta','estao','mais','pela','pelo','aqui','isso','esse','essa']);return copilotNorm(v).split(/\s+/).filter(w=>w.length>2&&!stop.has(w))}
function copilotFallback(transcript,tasks){
  const low=copilotNorm(transcript), words=copilotTokens(transcript)
  const done=/\b(terminamos|terminou|concluimos|concluido|finalizamos|finalizado|ficou pronto|feito|executamos|executado|acabamos)\b/.test(low)
  const attention=/\b(falta|faltando|pendente|problema|atencao|nao foi|nao esta|sem protecao|sem guarda|risco)\b/.test(low)
  const scored=tasks.map(t=>{const hay=copilotNorm((t.title||'')+' '+(t.detail||'')+' '+(t.discipline||'')+' '+(t.stage_key||''));let score=0;for(const w of words){if(hay.includes(w))score+=2;if(copilotNorm(t.title||'').includes(w))score+=2}if(low.includes(copilotNorm(t.title||''))&&String(t.title||'').length>5)score+=8;return {t,score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3)
  const suggestions=scored.map((x,i)=>({id:x.t.id,title:x.t.title,stageKey:x.t.stage_key,discipline:x.t.discipline,confidence:Math.min(94,52+x.score*5-i*4)}))
  const safety=[]
  if(/(sem protecao|sem guarda|borda sem|vao aberto)/.test(low)) safety.push('O relato menciona possível ausência de proteção coletiva. Validar no local antes de prosseguir.')
  if(/(altura|telhado|cobertura|andaime)/.test(low)) safety.push('O relato envolve atividade com potencial trabalho em altura. Conferir os controles aplicáveis antes da execução.')
  if(/(fio exposto|choque|eletric|energia ligada)/.test(low)) safety.push('O relato menciona condição elétrica. Solicitar verificação do responsável antes de intervir.')
  if(/(escavacao|vala|talude|barranco)/.test(low)) safety.push('O relato envolve escavação/talude. Conferir estabilidade, acesso e medidas de proteção aplicáveis.')
  const picked=new Set(suggestions.map(s=>s.id)), next=tasks.find(t=>!picked.has(t.id))
  return {summary:transcript.trim(),action:done?'done':attention?'attention':'log',suggestions,safety,nextStep:next?.title||'',confidence:suggestions.length?Math.max(...suggestions.map(s=>s.confidence||0)):45,mode:'grounded'}
}

app.post('/api/os/projects/:id/copilot/interpret',auth,async(req,res)=>{
  const id=Number(req.params.id)
  if(!(await canAccess(req.user,id)))return res.status(403).json({error:'Sem acesso'})
  const transcript=String(req.body.transcript||'').trim()
  if(!transcript)return res.status(400).json({error:'Conte o que aconteceu na obra.'})
  const b=await getBundle(id)
  if(!b)return res.status(404).json({error:'Obra não encontrada'})
  const tasks=b.tasks.filter(t=>t.status==='pending').slice(0,160)
  let analysis=copilotFallback(transcript,tasks)
  if(OPENAI_API_KEY){
    try{
      const taskList=tasks.map(t=>String(t.id)+'|'+t.stage_key+'|'+t.discipline+'|'+t.title+'|'+String(t.detail||'').slice(0,180)).join('\n')
      const prompt='TRANSCRIÇÃO DO CAMPO:\n'+transcript+'\n\nTAREFAS PENDENTES:\n'+taskList
      const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+OPENAI_API_KEY},body:JSON.stringify({model:OPENAI_MODEL,instructions:'Você é o copiloto de uma obra. Interprete um relato de voz em português do Brasil. Use somente as tarefas fornecidas. Nunca conclua tecnicamente um serviço e nunca invente fatos. Sua função é SUGERIR classificação para confirmação humana. Se o relato disser que algo terminou, action=done; se relatar problema/falta, action=attention; caso contrário action=log. Retorne SOMENTE JSON válido: {summary:string,action:"done"|"log"|"attention",taskIds:number[],safety:string[],nextStep:string,confidence:number}. safety deve conter apenas riscos explicitamente relatados, com linguagem de validação, não afirmações definitivas.',input:prompt,max_output_tokens:600})})
      if(r.ok){
        const d=await r.json();let text=d.output_text||''
        if(!text&&Array.isArray(d.output))text=d.output.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('')
        const m=text.match(/\{[\s\S]*\}/)
        if(m){
          const parsed=JSON.parse(m[0]), ids=Array.isArray(parsed.taskIds)?parsed.taskIds.map(Number):[]
          const valid=ids.map(taskId=>tasks.find(t=>t.id===taskId)).filter(Boolean).slice(0,5)
          analysis={summary:String(parsed.summary||transcript),action:['done','log','attention'].includes(parsed.action)?parsed.action:'log',suggestions:valid.map((t,i)=>({id:t.id,title:t.title,stageKey:t.stage_key,discipline:t.discipline,confidence:Math.max(50,Math.min(99,Number(parsed.confidence)||80)-i*3)})),safety:Array.isArray(parsed.safety)?parsed.safety.slice(0,6):[],nextStep:String(parsed.nextStep||''),confidence:Math.max(0,Math.min(100,Number(parsed.confidence)||0)),mode:'ai'}
        }
      }
    }catch(e){console.error('copilot-interpret',e)}
  }
  res.json({analysis})
})

app.post('/api/os/projects/:id/copilot/apply',auth,async(req,res)=>{
  const id=Number(req.params.id)
  if(!(await canAccess(req.user,id)))return res.status(403).json({error:'Sem acesso'})
  const transcript=String(req.body.transcript||'').trim(), summary=String(req.body.summary||'').trim(), action=String(req.body.action||'log')
  const taskIds=Array.isArray(req.body.taskIds)?req.body.taskIds.map(Number).filter(Number.isFinite).slice(0,10):[]
  const safety=Array.isArray(req.body.safety)?req.body.safety.map(String).slice(0,8):[]
  const isStaff=['admin','team'].includes(req.user.role), marked=[], skipped=[]
  if(action==='done'&&taskIds.length){
    const q=await pool.query('SELECT * FROM os_tasks WHERE project_id=$1 AND id=ANY($2::int[])',[id,taskIds])
    for(const t of q.rows){
      if(isStaff||t.client_action){await pool.query("UPDATE os_tasks SET status='done',completed_at=now(),completed_by=$1,updated_at=now() WHERE id=$2 AND project_id=$3",[req.user.id,t.id,id]);marked.push({id:t.id,title:t.title})}
      else skipped.push({id:t.id,title:t.title})
    }
  }
  const parts=[]
  if(summary)parts.push('Resumo: '+summary)
  if(transcript)parts.push('Relato: '+transcript)
  if(safety.length)parts.push('Pontos para validação: '+safety.join(' | '))
  if(req.body.nextStep)parts.push('Próximo passo sugerido: '+String(req.body.nextStep))
  await pool.query("INSERT INTO os_events(project_id,event_type,title,description,created_by) VALUES($1,'voice',$2,$3,$4)",[id,'Registro pelo Copiloto',parts.join('\n'),req.user.id])
  await pool.query('UPDATE projects SET updated_at=now() WHERE id=$1',[id])
  res.json({ok:true,marked,skipped})
})
`

source = source.replace(anchor, copilotRoutes + '\n' + anchor)
await fs.writeFile(runtimePath, source, 'utf8')
await import('./.server-v3-runtime.mjs')
