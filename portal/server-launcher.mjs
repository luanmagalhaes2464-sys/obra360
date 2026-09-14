import fs from 'fs/promises'

const sourcePath = new URL('./server-v3.mjs', import.meta.url)
const runtimePath = new URL('./.server-v3-runtime.mjs', import.meta.url)

let source = await fs.readFile(sourcePath, 'utf8')

// Hotfix legado do checklist
const before = "completed_by=CASE WHEN $1='done' THEN $2 ELSE NULL END"
const after = "completed_by=CASE WHEN $1='done' THEN $2::integer ELSE NULL END"
if (!source.includes(before) && !source.includes(after)) throw new Error('Não foi possível localizar completed_by.')
source = source.replace(before, after)

// Tabelas adicionais dos agentes. Entram dentro da migração do servidor original.
const migrationAnchor = 'CREATE INDEX IF NOT EXISTS idx_os_tasks_project_stage'
if (!source.includes(migrationAnchor)) throw new Error('Ponto de migração dos agentes não encontrado.')
const agentTables = String.raw`
    CREATE TABLE IF NOT EXISTS os_ai_files(
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      mime_type TEXT,
      file_data TEXT,
      agent_type TEXT NOT NULL DEFAULT 'vision',
      title TEXT,
      category TEXT,
      summary TEXT,
      stage_key TEXT,
      discipline TEXT,
      confidence NUMERIC(5,2),
      extracted JSONB NOT NULL DEFAULT '{}'::jsonb,
      task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      observations JSONB NOT NULL DEFAULT '[]'::jsonb,
      safety JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS os_ai_reports(
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      report_type TEXT NOT NULL DEFAULT 'weekly',
      title TEXT NOT NULL,
      period_label TEXT,
      content TEXT NOT NULL,
      metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_os_ai_files_project ON os_ai_files(project_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_os_ai_reports_project ON os_ai_reports(project_id,created_at DESC);
    `
source = source.replace(migrationAnchor, agentTables + migrationAnchor)

const anchor = "const dist=path.join(__dirname,'dist');"
if (!source.includes(anchor)) throw new Error('Ponto de injeção dos agentes não encontrado.')

const agentRoutes = String.raw`
function agentNorm(v=''){return String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ')}
function agentTokens(v=''){const stop=new Set(['para','com','uma','uns','das','dos','que','hoje','amanha','obra','gente','foi','esta','estao','mais','pela','pelo','aqui','isso','esse','essa','como','qual']);return agentNorm(v).split(/\s+/).filter(w=>w.length>2&&!stop.has(w))}
function agentTaskMatches(text,tasks,limit=5){const words=agentTokens(text);return tasks.map(t=>{const title=agentNorm(t.title||''),hay=agentNorm((t.title||'')+' '+(t.detail||'')+' '+(t.discipline||'')+' '+(t.stage_key||''));let score=0;for(const w of words){if(hay.includes(w))score+=2;if(title.includes(w))score+=3}if(title&&agentNorm(text).includes(title))score+=10;return {t,score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit)}
function agentMoney(v){try{return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(v)||0)}catch{return 'R$ '+(Number(v)||0)}}
function questionAnswer(text,b){
  const low=agentNorm(text),pending=b.tasks.filter(t=>t.status==='pending'),next=b.summary.nextTask
  if(/(prefeitura|alvara|habite|licenca|licenciamento)/.test(low)){const rows=pending.filter(t=>['prefeitura','federal'].includes(t.discipline)).slice(0,6);return rows.length?'Pendências de regularização: '+rows.map(t=>t.title).join('; ')+'.':'Não há pendências de Prefeitura/federal cadastradas neste momento.'}
  if(/(seguranca|sst|epi|epc|risco|nr 18|nr18|nr 35|nr35)/.test(low)){const rows=pending.filter(t=>t.discipline==='sst').slice(0,6);return rows.length?'Pontos de SST ainda pendentes no roteiro: '+rows.map(t=>t.title).join('; ')+'. A validação deve ser feita pelo responsável competente.':'Não há itens de SST pendentes no roteiro atual.'}
  if(/(arquitet|planta|anteprojeto|projeto)/.test(low)){const rows=pending.filter(t=>t.discipline==='arquitetura'||t.discipline==='cliente').slice(0,6);return rows.length?'Próximas ações de arquitetura/cliente: '+rows.map(t=>t.title).join('; ')+'.':'Não há ações de arquitetura/cliente pendentes cadastradas.'}
  if(/(quanto|gasto|gastou|orcamento|orçamento|custo|finance)/.test(text.toLowerCase()))return 'Orçamento registrado: '+agentMoney(b.project.budget)+'. Realizado: '+agentMoney(b.project.spent)+'. Comprometido: '+agentMoney(b.project.committed)+'.'
  if(/(progresso|percentual|porcentagem|andamento)/.test(low))return 'O roteiro está com '+b.summary.progress+'% das ações aplicáveis concluídas ('+b.summary.done+' de '+b.summary.applicable+').'
  if(/(foto|imagem|registro visual)/.test(low))return 'A obra possui '+(b.photos?.length||0)+' foto(s) registrada(s) no portal.'
  if(/(proximo|próximo|agora|o que faco|o que faço|o que fazer|falta)/.test(text.toLowerCase()))return next?'A próxima ação obrigatória sugerida pelo roteiro é: '+next.title+'. Etapa: '+next.stage_key+'.':'Não há próxima ação obrigatória pendente no roteiro atual.'
  const rows=pending.filter(t=>t.required).slice(0,5);return rows.length?'As próximas pendências obrigatórias são: '+rows.map(t=>t.title).join('; ')+'.':'Não há pendências obrigatórias cadastradas.'
}
function voiceFallback(transcript,b){
  const low=agentNorm(transcript),pending=b.tasks.filter(t=>t.status==='pending'),all=b.tasks
  const isQuestion=/^(o que|qual|quais|quanto|quantos|como|tem|existe|estamos|estou|faltam|falta|proximo|proxima)/.test(low)||/\b(me diga|me fale|quero saber|o que falta|o que faco|o que fazer)\b/.test(low)
  const createStage=/\b(adiciona|adicione|cria|crie|incluir|inclua)\b.*\b(etapa|fase)\b/.test(low)
  const createTask=/\b(adiciona|adicione|cria|crie|incluir|inclua)\b.*\b(tarefa|pendencia|item|atividade)\b/.test(low)
  const reopen=/\b(reabre|reabrir|volta|voltar)\b/.test(low)
  const markNa=/\b(nao se aplica|não se aplica|marque n a|marcar n a|n a)\b/.test(transcript.toLowerCase())
  const done=/\b(terminamos|terminou|concluimos|concluido|finalizamos|finalizado|ficou pronto|feito|executamos|executado|acabamos|marque|marca)\b/.test(low)&&!reopen&&!markNa
  const attention=/\b(falta|faltando|pendente|problema|atencao|nao foi|nao esta|sem protecao|sem guarda|risco)\b/.test(low)
  const baseTasks=reopen||markNa?all:pending, scored=agentTaskMatches(transcript,baseTasks,4)
  const suggestions=scored.map((x,i)=>({id:x.t.id,title:x.t.title,stageKey:x.t.stage_key,discipline:x.t.discipline,confidence:Math.min(96,55+x.score*5-i*3)}))
  const safety=[]
  if(/(sem protecao|sem guarda|borda sem|vao aberto)/.test(low))safety.push('O relato menciona possível ausência de proteção coletiva. Validar no local.')
  if(/(altura|telhado|cobertura|andaime)/.test(low))safety.push('O relato envolve potencial trabalho em altura. Conferir os controles aplicáveis.')
  if(/(fio exposto|choque|eletric|energia ligada)/.test(low))safety.push('O relato menciona condição elétrica. Solicitar verificação antes da intervenção.')
  if(/(escavacao|vala|talude|barranco)/.test(low))safety.push('O relato envolve escavação/talude. Conferir estabilidade, acesso e proteções.')
  let action='log',answer='',createLabel=''
  if(isQuestion){action='query';answer=questionAnswer(transcript,b)}
  else if(createStage){action='create_stage';createLabel=transcript.replace(/^.*?\b(etapa|fase)\b\s*/i,'').trim()||'Nova etapa'}
  else if(createTask){action='create_task';createLabel=transcript.replace(/^.*?\b(tarefa|pendencia|pendência|item|atividade)\b\s*/i,'').trim()||'Nova atividade'}
  else if(reopen)action='reopen'
  else if(markNa)action='na'
  else if(done)action='done'
  else if(attention)action='attention'
  const next=b.summary.nextTask
  return {summary:transcript.trim(),action,suggestions,safety,nextStep:next?.title||'',answer,createLabel,confidence:suggestions.length?Math.max(...suggestions.map(s=>s.confidence||0)):70,mode:'grounded'}
}

app.post('/api/os/projects/:id/copilot/interpret',auth,async(req,res)=>{
  const id=Number(req.params.id);if(!(await canAccess(req.user,id)))return res.status(403).json({error:'Sem acesso'})
  const transcript=String(req.body.transcript||'').trim();if(!transcript)return res.status(400).json({error:'Conte o que deseja registrar ou perguntar.'})
  const b=await getBundle(id);if(!b)return res.status(404).json({error:'Obra não encontrada'})
  const tasks=b.tasks.slice(0,220);let analysis=voiceFallback(transcript,b)
  if(OPENAI_API_KEY){try{
    const taskList=tasks.map(t=>String(t.id)+'|'+t.status+'|'+t.stage_key+'|'+t.discipline+'|'+t.title+'|'+String(t.detail||'').slice(0,150)).join('\n')
    const context='PROJETO: '+b.project.name+'\nPROGRESSO: '+b.summary.progress+'%\nPRÓXIMA AÇÃO: '+(b.summary.nextTask?.title||'nenhuma')+'\nTAREFAS:\n'+taskList+'\n\nCOMANDO/RELATO:\n'+transcript
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+OPENAI_API_KEY},body:JSON.stringify({model:OPENAI_MODEL,instructions:'Você é o Agente de Voz do Obra360. Interprete comandos e perguntas sobre uma obra. Nunca invente fatos e nunca valide tecnicamente um serviço. Para perguntas, use action=query e responda apenas com base no contexto. Para comandos, use action done, reopen, na, create_task, create_stage, attention ou log. Retorne SOMENTE JSON válido: {summary:string,action:string,taskIds:number[],safety:string[],nextStep:string,answer:string,createLabel:string,confidence:number}. Só use ids fornecidos. Alterações sempre serão confirmadas pelo humano.',input:context,max_output_tokens:700})})
    if(r.ok){const d=await r.json();let text=d.output_text||'';if(!text&&Array.isArray(d.output))text=d.output.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');const m=text.match(/\{[\s\S]*\}/);if(m){const parsed=JSON.parse(m[0]),ids=Array.isArray(parsed.taskIds)?parsed.taskIds.map(Number):[],valid=ids.map(taskId=>tasks.find(t=>t.id===taskId)).filter(Boolean).slice(0,6);analysis={summary:String(parsed.summary||transcript),action:['done','reopen','na','create_task','create_stage','query','attention','log'].includes(parsed.action)?parsed.action:'log',suggestions:valid.map((t,i)=>({id:t.id,title:t.title,stageKey:t.stage_key,discipline:t.discipline,confidence:Math.max(50,Math.min(99,Number(parsed.confidence)||84)-i*3)})),safety:Array.isArray(parsed.safety)?parsed.safety.slice(0,6):[],nextStep:String(parsed.nextStep||b.summary.nextTask?.title||''),answer:String(parsed.answer||''),createLabel:String(parsed.createLabel||''),confidence:Math.max(0,Math.min(100,Number(parsed.confidence)||0)),mode:'ai'}}}
  }catch(e){console.error('voice-agent',e)}}
  res.json({analysis})
})

app.post('/api/os/projects/:id/copilot/apply',auth,async(req,res)=>{
  const id=Number(req.params.id);if(!(await canAccess(req.user,id)))return res.status(403).json({error:'Sem acesso'})
  const transcript=String(req.body.transcript||'').trim(),summary=String(req.body.summary||'').trim(),action=String(req.body.action||'log'),taskIds=Array.isArray(req.body.taskIds)?req.body.taskIds.map(Number).filter(Number.isFinite).slice(0,10):[],safety=Array.isArray(req.body.safety)?req.body.safety.map(String).slice(0,8):[],isStaff=['admin','team'].includes(req.user.role),marked=[],skipped=[]
  if(['done','reopen','na'].includes(action)&&taskIds.length){const q=await pool.query('SELECT * FROM os_tasks WHERE project_id=$1 AND id=ANY($2::int[])',[id,taskIds]);for(const t of q.rows){if(isStaff||t.client_action){const status=action==='done'?'done':action==='na'?'na':'pending';await pool.query("UPDATE os_tasks SET status=$1,completed_at=CASE WHEN $1='done' THEN now() ELSE NULL END,completed_by=CASE WHEN $1='done' THEN $2::integer ELSE NULL END,updated_at=now() WHERE id=$3 AND project_id=$4",[status,req.user.id,t.id,id]);marked.push({id:t.id,title:t.title,status})}else skipped.push({id:t.id,title:t.title})}}
  if(action==='create_stage'){if(!isStaff)return res.status(403).json({error:'Somente a equipe pode criar etapas.'});const title=String(req.body.createLabel||'Nova etapa').trim().slice(0,120),key='voice_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),max=await pool.query('SELECT COALESCE(MAX(stage_order),15)+1 n FROM os_custom_stages WHERE project_id=$1',[id]);await pool.query('INSERT INTO os_custom_stages(project_id,stage_key,title,summary,stage_order,created_by) VALUES($1,$2,$3,$4,$5,$6)',[id,key,title,'Etapa criada pelo Agente de Voz.',max.rows[0].n,req.user.id]);marked.push({title,status:'created_stage'})}
  if(action==='create_task'){if(!isStaff)return res.status(403).json({error:'Somente a equipe pode criar atividades.'});const title=String(req.body.createLabel||'Nova atividade').trim().slice(0,160),b=await getBundle(id),stage=b.summary.nextTask?.stage_key||b.stages.find(s=>s.progress<100)?.key||'planejamento',code='voice_task_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),max=await pool.query('SELECT COALESCE(MAX(task_order),0)+1 n FROM os_tasks WHERE project_id=$1',[id]);await pool.query("INSERT INTO os_tasks(project_id,code,stage_key,discipline,title,detail,role,required,priority,task_order,is_custom) VALUES($1,$2,$3,'gestao',$4,'Criada por comando de voz.','equipe',false,'normal',$5,true)",[id,code,stage,title,max.rows[0].n]);marked.push({title,status:'created_task'})}
  const parts=[];if(summary)parts.push('Resumo: '+summary);if(transcript)parts.push('Comando/relato: '+transcript);if(safety.length)parts.push('Pontos para validação: '+safety.join(' | '));if(req.body.nextStep)parts.push('Próximo passo sugerido: '+String(req.body.nextStep));await pool.query("INSERT INTO os_events(project_id,event_type,title,description,created_by) VALUES($1,'voice',$2,$3,$4)",[id,'Agente de Voz',parts.join('\n'),req.user.id]);await pool.query('UPDATE projects SET updated_at=now() WHERE id=$1',[id]);res.json({ok:true,marked,skipped})
})

function visionFallback(fileName,mimeType,note,b){
  const low=agentNorm((fileName||'')+' '+(note||''));let category=mimeType?.includes('pdf')?'documento':'foto',discipline='gestao',stageKey=b.summary.nextTask?.stage_key||null
  if(/(art|rrt)/.test(low)){category='responsabilidade técnica';discipline='engenharia'}
  if(/(alvara|habite|prefeitura|licenca)/.test(low)){category='licenciamento';discipline='prefeitura'}
  if(/(pgr|nr18|seguranca|sst)/.test(low)){category='segurança do trabalho';discipline='sst'}
  if(/(arquitet|planta|layout|fachada)/.test(low)){category='projeto arquitetônico';discipline='arquitetura'}
  const matches=agentTaskMatches((fileName||'')+' '+(note||''),b.tasks.filter(t=>t.status==='pending'),4)
  return {title:fileName||'Arquivo analisado',category,summary:'Arquivo recebido e associado ao contexto da obra. Para leitura visual/documental completa, conecte a chave de IA do ambiente.',stageKey,discipline,taskIds:matches.map(x=>x.t.id),checklistSuggestions:matches.map(x=>x.t.title),observations:[],safety:[],architecture:[],municipality:[],extracted:{fileName,mimeType},confidence:matches.length?62:35,mode:'fallback'}
}

app.post('/api/os/projects/:id/vision/analyze',auth,async(req,res)=>{
  const id=Number(req.params.id);if(!(await canAccess(req.user,id)))return res.status(403).json({error:'Sem acesso'})
  const fileData=String(req.body.fileData||''),fileName=String(req.body.fileName||'arquivo'),mimeType=String(req.body.mimeType||''),note=String(req.body.note||'').trim();if(!fileData)return res.status(400).json({error:'Arquivo ausente'});if(fileData.length>7500000)return res.status(413).json({error:'Arquivo muito grande. Use até aproximadamente 5 MB.'})
  const b=await getBundle(id);if(!b)return res.status(404).json({error:'Obra não encontrada'});let analysis=visionFallback(fileName,mimeType,note,b)
  if(OPENAI_API_KEY){try{
    const pending=b.tasks.filter(t=>t.status==='pending').slice(0,180),taskList=pending.map(t=>String(t.id)+'|'+t.stage_key+'|'+t.discipline+'|'+t.title).join('\n')
    const content=[{type:'input_text',text:'OBRA: '+b.project.name+'\nPRÓXIMA AÇÃO: '+(b.summary.nextTask?.title||'nenhuma')+'\nNOTA DO USUÁRIO: '+note+'\nTAREFAS PENDENTES:\n'+taskList+'\n\nAnalise o arquivo e relacione somente evidências visíveis ou textuais. Não declare conformidade técnica.'}]
    if(mimeType.startsWith('image/'))content.push({type:'input_image',image_url:fileData})
    else if(mimeType==='application/pdf'||fileName.toLowerCase().endsWith('.pdf'))content.push({type:'input_file',filename:fileName,file_data:fileData})
    else return res.status(400).json({error:'Formato não suportado. Envie imagem ou PDF.'})
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+OPENAI_API_KEY},body:JSON.stringify({model:OPENAI_MODEL,instructions:'Você é o Agente de Visão e Documentos do Obra360, com contexto de arquitetura, engenharia civil, regularização e segurança do trabalho. Examine imagens ou PDFs e extraia o que está realmente presente. Nunca invente informação, nunca aprove tecnicamente um serviço e não afirme que um risco foi controlado apenas por uma foto. Retorne SOMENTE JSON: {title:string,category:string,summary:string,stageKey:string|null,discipline:string,taskIds:number[],checklistSuggestions:string[],observations:string[],safety:string[],architecture:string[],municipality:string[],extracted:object,confidence:number}. taskIds só pode conter ids fornecidos.',input:[{role:'user',content}],max_output_tokens:1200})})
    if(r.ok){const d=await r.json();let text=d.output_text||'';if(!text&&Array.isArray(d.output))text=d.output.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');const m=text.match(/\{[\s\S]*\}/);if(m){const p=JSON.parse(m[0]),ids=Array.isArray(p.taskIds)?p.taskIds.map(Number):[],valid=ids.filter(x=>pending.some(t=>t.id===x)).slice(0,8);analysis={title:String(p.title||fileName),category:String(p.category||'arquivo'),summary:String(p.summary||''),stageKey:p.stageKey?String(p.stageKey):null,discipline:String(p.discipline||'gestao'),taskIds:valid,checklistSuggestions:Array.isArray(p.checklistSuggestions)?p.checklistSuggestions.slice(0,8):[],observations:Array.isArray(p.observations)?p.observations.slice(0,10):[],safety:Array.isArray(p.safety)?p.safety.slice(0,8):[],architecture:Array.isArray(p.architecture)?p.architecture.slice(0,8):[],municipality:Array.isArray(p.municipality)?p.municipality.slice(0,8):[],extracted:p.extracted&&typeof p.extracted==='object'?p.extracted:{},confidence:Math.max(0,Math.min(100,Number(p.confidence)||0)),mode:'ai'}}}
  }catch(e){console.error('vision-agent',e)}}
  const q=await pool.query(`INSERT INTO os_ai_files(project_id,file_name,mime_type,file_data,title,category,summary,stage_key,discipline,confidence,extracted,task_ids,observations,safety,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id,created_at`,[id,fileName,mimeType,fileData,analysis.title,analysis.category,analysis.summary,analysis.stageKey,analysis.discipline,analysis.confidence,analysis.extracted,analysis.taskIds,analysis.observations,analysis.safety,req.user.id])
  await pool.query("INSERT INTO os_events(project_id,event_type,title,description,created_by) VALUES($1,'vision',$2,$3,$4)",[id,'Agente analisou: '+fileName,analysis.summary,req.user.id]);res.json({analysis,file:{id:q.rows[0].id,created_at:q.rows[0].created_at}})
})

app.post('/api/os/projects/:id/vision/apply',auth,async(req,res)=>{
  const id=Number(req.params.id);if(!(await canAccess(req.user,id)))return res.status(403).json({error:'Sem acesso'});const taskIds=Array.isArray(req.body.taskIds)?req.body.taskIds.map(Number).filter(Number.isFinite).slice(0,10):[],isStaff=['admin','team'].includes(req.user.role),linked=[]
  if(req.body.markDone&&taskIds.length){const q=await pool.query('SELECT * FROM os_tasks WHERE project_id=$1 AND id=ANY($2::int[])',[id,taskIds]);for(const t of q.rows){if(isStaff||t.client_action){await pool.query("UPDATE os_tasks SET status='done',completed_at=now(),completed_by=$1,updated_at=now() WHERE id=$2 AND project_id=$3",[req.user.id,t.id,id]);linked.push(t.title)}}}
  await pool.query("INSERT INTO os_events(project_id,event_type,title,description,created_by) VALUES($1,'vision','Análise visual/documental confirmada',$2,$3)",[id,linked.length?'Itens confirmados: '+linked.join('; '):'Arquivo analisado e mantido como evidência, sem conclusão automática de checklist.',req.user.id]);res.json({ok:true,linked})
})

function reportFallback(type,b,events,files){
  const pending=b.tasks.filter(t=>t.status==='pending'),done=b.tasks.filter(t=>t.status==='done'),sst=pending.filter(t=>t.discipline==='sst'),pref=pending.filter(t=>['prefeitura','federal'].includes(t.discipline)),arch=pending.filter(t=>t.discipline==='arquitetura'||t.discipline==='cliente'),recent=events.slice(0,12)
  let title='Relatório da Obra';if(type==='weekly')title='Relatório Semanal';if(type==='client')title='Resumo para o Proprietário';if(type==='technical')title='Relatório Técnico de Acompanhamento';if(type==='safety')title='Relatório de Segurança do Trabalho';if(type==='executive')title='Relatório Executivo'
  const lines=[title,'', 'Obra: '+b.project.name, 'Município: '+(b.project.city||'não informado'), 'Progresso do roteiro: '+b.summary.progress+'% ('+done.length+' concluídos de '+b.summary.applicable+' aplicáveis).', 'Próxima ação sugerida: '+(b.summary.nextTask?.title||'Nenhuma ação obrigatória pendente.'), '', 'PENDÊNCIAS PRIORITÁRIAS', ...(pending.filter(t=>t.required).slice(0,8).map(t=>'• '+t.title+' ['+t.discipline+']')), '', 'ARQUITETURA / CLIENTE', ...(arch.slice(0,6).map(t=>'• '+t.title)), '', 'PREFEITURA / REGULARIZAÇÃO', ...(pref.slice(0,6).map(t=>'• '+t.title)), '', 'SEGURANÇA DO TRABALHO', ...(sst.slice(0,6).map(t=>'• '+t.title)), '', 'REGISTROS RECENTES', ...(recent.map(e=>'• '+e.title+(e.description?' — '+String(e.description).replace(/\n/g,' ').slice(0,220):''))), '', 'ARQUIVOS ANALISADOS PELOS AGENTES', ...(files.slice(0,6).map(f=>'• '+(f.title||f.file_name)+' — '+(f.summary||''))), '', 'Observação: este relatório consolida os registros existentes no Obra360. Validações técnicas e legais permanecem sob responsabilidade dos profissionais competentes.']
  return {title,content:lines.join('\n'),metrics:{progress:b.summary.progress,pending:pending.length,done:done.length,sst:sst.length,prefeitura:pref.length,architecture:arch.length,photos:b.photos?.length||0,files:files.length},mode:'grounded'}
}

app.post('/api/os/projects/:id/reports/generate',auth,async(req,res)=>{
  const id=Number(req.params.id);if(!(await canAccess(req.user,id)))return res.status(403).json({error:'Sem acesso'});const type=String(req.body.type||'weekly'),days=Math.max(1,Math.min(90,Number(req.body.days)||7)),b=await getBundle(id);if(!b)return res.status(404).json({error:'Obra não encontrada'})
  const ev=await pool.query("SELECT e.*,u.name author_name FROM os_events e LEFT JOIN users u ON u.id=e.created_by WHERE e.project_id=$1 AND e.created_at>=now()-($2::text||' days')::interval ORDER BY e.created_at DESC LIMIT 100",[id,String(days)]),fq=await pool.query("SELECT id,file_name,title,category,summary,stage_key,discipline,confidence,created_at FROM os_ai_files WHERE project_id=$1 AND created_at>=now()-($2::text||' days')::interval ORDER BY created_at DESC LIMIT 30",[id,String(days)])
  let report=reportFallback(type,b,ev.rows,fq.rows)
  if(OPENAI_API_KEY){try{const compact={project:b.project,progress:b.summary,stages:b.stages,tasks:b.tasks.slice(0,180),events:ev.rows,files:fq.rows,photos:(b.photos||[]).slice(0,20).map(p=>({caption:p.caption,summary:p.ai_summary,stage:p.stage_key,created_at:p.created_at}))};const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+OPENAI_API_KEY},body:JSON.stringify({model:OPENAI_MODEL,instructions:'Você é o Agente de Relatórios do Obra360. Produza relatório profissional em português do Brasil somente a partir dos dados fornecidos. Não invente medições, conformidades, custos ou fatos. Diferencie registro de recomendação. Seja claro para o tipo solicitado. Inclua: resumo executivo, evolução, fatos do período, pendências, arquitetura/decisões, Prefeitura/regularização, SST, próximos passos e ressalva técnica. Retorne SOMENTE JSON {title:string,content:string}.',input:'TIPO: '+type+'\nPERÍODO: últimos '+days+' dias\nDADOS:\n'+JSON.stringify(compact),max_output_tokens:2200})});if(r.ok){const d=await r.json();let text=d.output_text||'';if(!text&&Array.isArray(d.output))text=d.output.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');const m=text.match(/\{[\s\S]*\}/);if(m){const p=JSON.parse(m[0]);report={...report,title:String(p.title||report.title),content:String(p.content||report.content),mode:'ai'}}}}catch(e){console.error('report-agent',e)}}
  const periodLabel='Últimos '+days+' dias',q=await pool.query('INSERT INTO os_ai_reports(project_id,report_type,title,period_label,content,metrics,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,created_at',[id,type,report.title,periodLabel,report.content,report.metrics,req.user.id]);await pool.query("INSERT INTO os_events(project_id,event_type,title,description,created_by) VALUES($1,'report',$2,$3,$4)",[id,'Relatório gerado: '+report.title,periodLabel,req.user.id]);res.json({report:{id:q.rows[0].id,created_at:q.rows[0].created_at,...report,periodLabel}})
})
app.get('/api/os/projects/:id/reports',auth,async(req,res)=>{const id=Number(req.params.id);if(!(await canAccess(req.user,id)))return res.status(403).json({error:'Sem acesso'});const q=await pool.query('SELECT id,report_type,title,period_label,content,metrics,created_at FROM os_ai_reports WHERE project_id=$1 ORDER BY created_at DESC LIMIT 30',[id]);res.json({reports:q.rows})})
app.get('/api/os/projects/:id/agent-files',auth,async(req,res)=>{const id=Number(req.params.id);if(!(await canAccess(req.user,id)))return res.status(403).json({error:'Sem acesso'});const q=await pool.query('SELECT id,file_name,mime_type,title,category,summary,stage_key,discipline,confidence,extracted,task_ids,observations,safety,created_at FROM os_ai_files WHERE project_id=$1 ORDER BY created_at DESC LIMIT 50',[id]);res.json({files:q.rows})})
`

source = source.replace(anchor, agentRoutes + '\n' + anchor)
await fs.writeFile(runtimePath, source, 'utf8')
await import('./.server-v3-runtime.mjs')
