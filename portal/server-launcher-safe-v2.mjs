import fs from 'fs/promises'

const sourcePath = new URL('./server-launcher-safe.mjs', import.meta.url)
const runtimePath = new URL('./.server-launcher-safe-v2-runtime.mjs', import.meta.url)

let source = await fs.readFile(sourcePath, 'utf8')
const marker = 'const ttsRoutes = String.raw`'
if (!source.includes(marker)) throw new Error('Ponto de extensão do Matinho não encontrado.')

const enhancement = String.raw`
// Matinho v2: interpretação sem eco, acesso ao contexto da obra e pesquisa web quando necessário.
const matinhoInterpretStart = "app.post('/api/os/projects/:id/copilot/interpret'"
const matinhoInterpretEnd = "app.post('/api/os/projects/:id/copilot/apply'"
const matinhoStartAt = agentRoutes.indexOf(matinhoInterpretStart)
const matinhoEndAt = agentRoutes.indexOf(matinhoInterpretEnd, matinhoStartAt)
if (matinhoStartAt < 0 || matinhoEndAt < 0) throw new Error('Rota de interpretação do Matinho não encontrada.')

const matinhoInterpretRoute = String.raw\`
app.post('/api/os/projects/:id/copilot/interpret',auth,async(req,res)=>{
  const id=Number(req.params.id)
  if(!(await canAccess(req.user,id)))return res.status(403).json({error:'Sem acesso'})
  const transcript=String(req.body.transcript||'').trim()
  if(!transcript)return res.status(400).json({error:'Conte o que deseja registrar ou perguntar.'})
  const b=await getBundle(id)
  if(!b)return res.status(404).json({error:'Obra não encontrada'})

  const tasks=b.tasks.slice(0,260)
  const low=agentNorm(transcript)
  const looksLikeQuestion = transcript.includes('?') || /^(o que|qual|quais|quanto|quantos|como|quando|onde|quem|por que|porque|tem|existe|estamos|estou|faltam|falta|proximo|proxima|voce|você|posso|pode|me diga|me fale|pesquise|procure)/.test(low) || /\\b(acesso a internet|acesso internet|pesquisa na internet|consultar internet|pesquisar na web|google|na internet|na web|norma atual|versao atual|versão atual|atualizado|atualizada)\\b/.test(low)
  const asksInternetCapability = /\\b(acesso|acessar|consulta|consultar|pesquisa|pesquisar|busca|buscar)\\b.*\\b(internet|web|google)\\b/.test(low) || /\\b(internet|web|google)\\b.*\\b(acesso|pesquisa|consulta)\\b/.test(low)
  const asksSystemCapability = /\\b(acesso|acessar|consulta|consultar|mexer|alterar|mudar|atualizar)\\b.*\\b(sistema|obra|portal|checklist|etapa)\\b/.test(low)
  let analysis=voiceFallback(transcript,b)

  if(asksInternetCapability || asksSystemCapability){
    const internet=Boolean(process.env.GEMINI_API_KEY)
    analysis={
      summary:transcript,
      action:'query',
      suggestions:[],
      safety:[],
      nextStep:b.summary.nextTask?.title||'',
      answer: internet
        ? 'Sim. Eu consigo consultar a internet quando você pedir informação externa ou atualizada e também consultar os dados desta obra no sistema. Posso marcar itens do checklist, reabrir ou indicar que não se aplicam, além de criar tarefas e etapas quando seu perfil permitir. Alterações técnicas, financeiras ou regulatórias continuam pedindo confirmação antes de serem aplicadas.'
        : 'Eu consigo consultar e alterar os dados permitidos desta obra no sistema, mas a pesquisa na internet está indisponível porque a chave do Gemini não está configurada.',
      createLabel:'',confidence:99,mode:internet?'gemini-web':'grounded'
    }
    return res.json({analysis})
  }

  const taskList=tasks.map(t=>String(t.id)+'|'+t.status+'|'+t.stage_key+'|'+t.discipline+'|'+t.title+'|'+String(t.detail||'').slice(0,180)).join('\\n')
  const stageList=(b.stages||[]).map(s=>s.key+'|'+s.title+'|'+s.progress+'%|'+s.done+'/'+s.applicable).join('\\n')
  const context='USUÁRIO: '+(req.user?.name||'usuário')+'\\n'+
    'PROJETO: '+b.project.name+'\\nMUNICÍPIO: '+(b.project.city||b.profile?.city||'não informado')+'\\n'+
    'TIPO: '+(b.profile?.kind||'não informado')+'\\nÁREA: '+(b.profile?.area||'não informada')+'\\nPAVIMENTOS: '+(b.profile?.floors||'não informado')+'\\n'+
    'PROGRESSO GERAL: '+b.summary.progress+'%\\nPRÓXIMA AÇÃO: '+(b.summary.nextTask?.title||'nenhuma')+'\\n'+
    'PREVISÃO DE CONCLUSÃO: '+(b.project.planned_end_date||'não cadastrada')+'\\n'+
    'ORÇAMENTO: '+agentMoney(b.project.budget)+'\\nREALIZADO: '+agentMoney(b.project.spent)+'\\n'+
    'FOTOS REGISTRADAS: '+(b.photos?.length||0)+'\\n\\nETAPAS:\\n'+stageList+'\\n\\nCHECKLIST:\\n'+taskList

  if(process.env.GEMINI_API_KEY && looksLikeQuestion){
    try{
      const prompt='Você é Matinho, copiloto da TecnoMata Engenharia. Responda em português brasileiro, de forma educada, natural, objetiva e útil. NÃO repita nem parafraseie a pergunta do usuário como resposta. Para dados da obra, use exclusivamente o contexto do sistema abaixo como fonte de verdade. Para informações externas, atuais, normas, referências, preços, notícias ou fatos públicos, você pode usar a Pesquisa Google habilitada. Se a pergunta misturar obra e internet, deixe claro o que vem do sistema e o que vem de fonte externa. Nunca declare aprovação técnica, conformidade estrutural ou segurança sem validação do profissional responsável. Se não houver dado suficiente no sistema, diga isso.\\n\\nCONTEXTO DO SISTEMA:\\n'+context+'\\n\\nPERGUNTA DO USUÁRIO:\\n'+transcript
      const gr=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{
        method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
        body:JSON.stringify({contents:[{parts:[{text:prompt}]}],tools:[{google_search:{}}],generationConfig:{temperature:0.25,maxOutputTokens:520}})
      })
      if(gr.ok){
        const gd=await gr.json()
        const answer=gd?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim()
        const chunks=gd?.candidates?.[0]?.groundingMetadata?.groundingChunks||[]
        const sources=chunks.map(c=>c?.web?.uri).filter(Boolean).slice(0,5)
        if(answer){
          analysis={summary:transcript,action:'query',suggestions:[],safety:[],nextStep:b.summary.nextTask?.title||'',answer,createLabel:'',confidence:92,mode:sources.length?'gemini-web':'gemini-system',sources}
          return res.json({analysis})
        }
      }else{
        const detail=await gr.text().catch(()=>String(gr.status));console.error('matinho-web',gr.status,detail.slice(0,400))
      }
    }catch(e){console.error('matinho-web',e)}
  }

  if(process.env.GEMINI_API_KEY && !looksLikeQuestion){
    try{
      const prompt='Você é Matinho, agente operacional da TecnoMata Engenharia. Interprete o comando do usuário usando SOMENTE ids existentes no checklist abaixo. Não invente ids. Retorne somente JSON válido com os campos action, taskIds, answer, createLabel, safety e confidence. action deve ser um de: done, reopen, na, create_task, create_stage, attention, log, query. Use done somente quando o usuário mandar explicitamente concluir/marcar um item. Para "concluir uma etapa" inteira, não marque todos os itens automaticamente: use query e explique que a etapa depende dos itens aplicáveis. Não aprove tecnicamente estrutura, fundações, SST, Prefeitura, ART/RRT ou financeiro. Comandos sensíveis serão confirmados na interface. Se for apenas uma pergunta, use query e responda em answer.\\n\\nCONTEXTO:\\n'+context+'\\n\\nCOMANDO:\\n'+transcript
      const gr=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{
        method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
        body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.08,maxOutputTokens:420,responseMimeType:'application/json'}})
      })
      if(gr.ok){
        const gd=await gr.json();const txt=gd?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim()||''
        const parsed=JSON.parse(txt)
        const ids=Array.isArray(parsed.taskIds)?parsed.taskIds.map(Number):[]
        const valid=ids.map(taskId=>tasks.find(t=>t.id===taskId)).filter(Boolean).slice(0,8)
        const action=['done','reopen','na','create_task','create_stage','attention','log','query'].includes(parsed.action)?parsed.action:analysis.action
        analysis={
          summary:transcript,action,
          suggestions:valid.map((t,i)=>({id:t.id,title:t.title,stageKey:t.stage_key,discipline:t.discipline,confidence:Math.max(55,Math.min(99,Number(parsed.confidence)||90)-i*2)})),
          safety:Array.isArray(parsed.safety)?parsed.safety.map(String).slice(0,6):analysis.safety||[],
          nextStep:b.summary.nextTask?.title||'',answer:String(parsed.answer||''),createLabel:String(parsed.createLabel||analysis.createLabel||''),
          confidence:Math.max(0,Math.min(100,Number(parsed.confidence)||90)),mode:'gemini-system'
        }
      }
    }catch(e){console.error('matinho-action',e)}
  }

  if(looksLikeQuestion && analysis.action!=='query')analysis={...analysis,action:'query',suggestions:[],answer:analysis.answer||questionAnswer(transcript,b)}
  if(analysis.action==='query'&&!analysis.answer)analysis.answer=questionAnswer(transcript,b)
  res.json({analysis})
})

\`
agentRoutes = agentRoutes.slice(0,matinhoStartAt)+matinhoInterpretRoute+agentRoutes.slice(matinhoEndAt)
`

source = source.replace(marker, enhancement + '\n' + marker)
await fs.writeFile(runtimePath, source, 'utf8')
await import('./.server-launcher-safe-v2-runtime.mjs')
