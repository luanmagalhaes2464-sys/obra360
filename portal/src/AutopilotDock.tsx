import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowRight, Camera, Check, CheckCircle2, ImagePlus, Keyboard,
  LoaderCircle, Mic, MicOff, RotateCcw, Sparkles, X
} from 'lucide-react'

type Suggestion = {
  id:number
  title:string
  stageKey?:string
  discipline?:string
  confidence?:number
}

type VoiceAnalysis = {
  summary:string
  action:'done'|'log'|'attention'
  suggestions:Suggestion[]
  safety:string[]
  nextStep?:string
  confidence?:number
  mode?:string
}

type PhotoAnalysis = {
  summary:string
  taskId:number|null
  stageKey:string|null
  confidence:number
  tags:string[]
  safety:string[]
}

async function api<T=any>(url:string, options:RequestInit={}):Promise<T>{
  const r=await fetch(url,{...options,credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})}})
  const d=await r.json().catch(()=>({}))
  if(!r.ok) throw new Error(d.error||'Erro na operação')
  return d
}

async function imageToDataUrl(file:File){
  return await new Promise<string>((resolve,reject)=>{
    const img=new Image(), reader=new FileReader()
    reader.onload=()=>{
      img.onload=()=>{
        const max=1280, scale=Math.min(1,max/Math.max(img.width,img.height))
        const w=Math.round(img.width*scale), h=Math.round(img.height*scale)
        const c=document.createElement('canvas'); c.width=w; c.height=h
        const ctx=c.getContext('2d'); if(!ctx) return reject(new Error('Falha ao processar imagem'))
        ctx.drawImage(img,0,0,w,h)
        resolve(c.toDataURL('image/jpeg',.72))
      }
      img.onerror=()=>reject(new Error('Imagem inválida'))
      img.src=String(reader.result)
    }
    reader.onerror=()=>reject(new Error('Falha ao ler imagem'))
    reader.readAsDataURL(file)
  })
}

function activeProjectId(){
  const el=document.querySelector('.project-select select') as HTMLSelectElement|null
  return el?.value ? Number(el.value) : null
}

export default function AutopilotDock(){
  const [visible,setVisible]=useState(false)
  const [open,setOpen]=useState(false)
  const [tab,setTab]=useState<'voice'|'photo'|'text'>('voice')
  const [listening,setListening]=useState(false)
  const [transcript,setTranscript]=useState('')
  const [interim,setInterim]=useState('')
  const [analysis,setAnalysis]=useState<VoiceAnalysis|null>(null)
  const [photoAnalysis,setPhotoAnalysis]=useState<PhotoAnalysis|null>(null)
  const [photoId,setPhotoId]=useState<number|null>(null)
  const [photoPreview,setPhotoPreview]=useState('')
  const [selected,setSelected]=useState<number[]>([])
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const recognitionRef=useRef<any>(null)
  const fileRef=useRef<HTMLInputElement>(null)

  useEffect(()=>{
    const check=()=>setVisible(!!document.querySelector('.v3-shell') && !document.querySelector('.setup-wizard'))
    check()
    const observer=new MutationObserver(check)
    observer.observe(document.body,{childList:true,subtree:true})
    return ()=>observer.disconnect()
  },[])

  useEffect(()=>()=>{try{recognitionRef.current?.stop()}catch{}},[])

  const speechSupported=useMemo(()=>typeof window!=='undefined' && !!((window as any).SpeechRecognition||(window as any).webkitSpeechRecognition),[])

  function reset(){
    setTranscript('');setInterim('');setAnalysis(null);setPhotoAnalysis(null);setPhotoId(null);setPhotoPreview('');setSelected([]);setMessage('')
  }

  function startVoice(){
    setMessage('')
    const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition
    if(!SR){setMessage('Este navegador não oferece reconhecimento de voz direto. Use “Digitar” ou abra no Safari/Chrome atualizado.');setTab('text');return}
    try{recognitionRef.current?.stop()}catch{}
    const rec=new SR()
    rec.lang='pt-BR'; rec.continuous=true; rec.interimResults=true
    rec.onstart=()=>setListening(true)
    rec.onend=()=>setListening(false)
    rec.onerror=(e:any)=>{setListening(false);setMessage(e?.error==='not-allowed'?'Permita o acesso ao microfone no navegador.':'Não consegui ouvir. Tente novamente.')}
    rec.onresult=(event:any)=>{
      let finalText='', interimText=''
      for(let i=event.resultIndex;i<event.results.length;i++){
        const piece=event.results[i][0].transcript
        if(event.results[i].isFinal) finalText+=piece+' '
        else interimText+=piece
      }
      if(finalText) setTranscript(v=>(v+' '+finalText).trim())
      setInterim(interimText)
    }
    recognitionRef.current=rec
    rec.start()
  }

  function stopVoice(){try{recognitionRef.current?.stop()}catch{};setListening(false);setInterim('')}

  async function analyzeVoice(){
    const projectId=activeProjectId(); const text=(transcript+' '+interim).trim()
    if(!projectId){setMessage('Não consegui identificar a obra ativa.');return}
    if(!text){setMessage('Fale ou digite o que aconteceu na obra.');return}
    stopVoice(); setBusy(true); setMessage(''); setAnalysis(null)
    try{
      const r=await api(`/api/os/projects/${projectId}/copilot/interpret`,{method:'POST',body:JSON.stringify({transcript:text})})
      setAnalysis(r.analysis); setSelected((r.analysis?.suggestions||[]).map((s:Suggestion)=>s.id))
    }catch(e:any){setMessage(e.message)}finally{setBusy(false)}
  }

  async function applyVoice(){
    const projectId=activeProjectId(); if(!projectId||!analysis)return
    setBusy(true);setMessage('')
    try{
      const r=await api(`/api/os/projects/${projectId}/copilot/apply`,{method:'POST',body:JSON.stringify({
        transcript:transcript.trim(), summary:analysis.summary, action:analysis.action,
        taskIds:selected, safety:analysis.safety, nextStep:analysis.nextStep
      })})
      setMessage(r.marked?.length?`${r.marked.length} item(ns) atualizado(s). Registro salvo no histórico.`:'Registro salvo no histórico. Nenhuma tarefa foi alterada automaticamente.')
      setAnalysis(null);setSelected([])
      window.dispatchEvent(new CustomEvent('obra360:refresh'))
    }catch(e:any){setMessage(e.message)}finally{setBusy(false)}
  }

  async function choosePhoto(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; if(!file)return
    const projectId=activeProjectId(); if(!projectId){setMessage('Não consegui identificar a obra ativa.');return}
    setBusy(true);setMessage('');setPhotoAnalysis(null)
    try{
      const dataUrl=await imageToDataUrl(file);setPhotoPreview(dataUrl)
      const r=await api(`/api/os/projects/${projectId}/photos/analyze`,{method:'POST',body:JSON.stringify({dataUrl,caption:transcript.trim()})})
      setPhotoAnalysis(r.analysis);setPhotoId(r.photo?.id||null)
    }catch(e:any){setMessage(e.message)}finally{setBusy(false);if(fileRef.current)fileRef.current.value=''}
  }

  async function confirmPhoto(markDone:boolean){
    const projectId=activeProjectId(); if(!projectId||!photoId||!photoAnalysis?.taskId)return
    setBusy(true);setMessage('')
    try{
      const r=await api(`/api/os/projects/${projectId}/photos/${photoId}/link`,{method:'PATCH',body:JSON.stringify({taskId:photoAnalysis.taskId,markDone})})
      if(r.needsValidation)setMessage('Foto vinculada. A conclusão deste item precisa ser confirmada pela equipe técnica.')
      else if(r.marked)setMessage('Foto vinculada e item marcado como feito.')
      else setMessage('Foto vinculada ao checklist.')
      window.dispatchEvent(new CustomEvent('obra360:refresh'))
    }catch(e:any){setMessage(e.message)}finally{setBusy(false)}
  }

  if(!visible)return null

  return <>
    <button className="autopilot-fab" onClick={()=>{setOpen(true);setTab('voice')}} aria-label="Registrar obra">
      <span className="fab-pulse"><Sparkles size={17}/></span><div><small>OBRA360 COPILOT</small><b>Registrar obra</b></div><Mic size={19}/>
    </button>

    {open&&<div className="autopilot-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
      <section className="autopilot-sheet">
        <header className="autopilot-head">
          <div><span><Sparkles size={15}/> COPILOTO DE CAMPO</span><h2>Conte o que aconteceu. O sistema organiza.</h2><p>Fale, fotografe ou digite. O Obra360 sugere a etapa, o checklist e os próximos passos para você apenas confirmar.</p></div>
          <button onClick={()=>{stopVoice();setOpen(false)}}><X size={20}/></button>
        </header>

        <div className="autopilot-tabs">
          <button className={tab==='voice'?'active':''} onClick={()=>setTab('voice')}><Mic size={17}/> Falar</button>
          <button className={tab==='photo'?'active':''} onClick={()=>setTab('photo')}><Camera size={17}/> Foto</button>
          <button className={tab==='text'?'active':''} onClick={()=>setTab('text')}><Keyboard size={17}/> Digitar</button>
        </div>

        {(tab==='voice'||tab==='text')&&<div className="voice-workspace">
          {tab==='voice'&&<div className={`voice-orb ${listening?'listening':''}`}>
            <button onClick={listening?stopVoice:startVoice}>{listening?<MicOff size={31}/>:<Mic size={31}/>}</button>
            <div><b>{listening?'Estou ouvindo…':'Toque e fale naturalmente'}</b><span>{speechSupported?'Ex.: “Terminamos a armação da laje e falta proteção na borda.”':'Reconhecimento de voz indisponível neste navegador.'}</span></div>
          </div>}
          <label className="transcript-box"><span>{tab==='voice'?'TRANSCRIÇÃO':'REGISTRO'}</span><textarea value={(transcript+(interim?' '+interim:'')).trim()} onChange={e=>{setTranscript(e.target.value);setInterim('')}} placeholder="Ex.: Hoje concluímos a impermeabilização dos banheiros. Amanhã começa o revestimento. A proteção do vão da escada ainda precisa ser colocada."/></label>
          <div className="autopilot-actions"><button className="secondary" onClick={reset}><RotateCcw size={16}/> Limpar</button><button className="primary" onClick={analyzeVoice} disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:<Sparkles size={17}/>} Interpretar registro</button></div>
        </div>}

        {tab==='photo'&&<div className="photo-workspace">
          {!photoPreview?<button className="camera-drop" onClick={()=>fileRef.current?.click()}><ImagePlus size={34}/><b>Tirar foto ou escolher da galeria</b><span>A imagem será analisada para sugerir a etapa e um item do checklist. A IA não aprova tecnicamente o serviço.</span></button>:<div className="photo-review"><img src={photoPreview}/><button onClick={()=>{setPhotoPreview('');setPhotoAnalysis(null);setPhotoId(null)}}><RotateCcw size={15}/> Trocar foto</button></div>}
          <input ref={fileRef} hidden type="file" accept="image/*" capture="environment" onChange={choosePhoto}/>
          {!photoPreview&&<button className="primary wide" onClick={()=>fileRef.current?.click()}><Camera size={17}/> Abrir câmera</button>}
        </div>}

        {analysis&&<div className="copilot-result">
          <div className="result-title"><span><CheckCircle2 size={18}/> O COPILOTO ENTENDEU</span><em>{analysis.mode==='ai'?'IA + dados da obra':'dados da obra'}</em></div>
          <h3>{analysis.summary}</h3>
          {!!analysis.suggestions?.length&&<div className="suggestion-list"><small>SUGESTÕES PARA O CHECKLIST</small>{analysis.suggestions.map(s=><label key={s.id}><input type="checkbox" checked={selected.includes(s.id)} onChange={()=>setSelected(v=>v.includes(s.id)?v.filter(x=>x!==s.id):[...v,s.id])}/><span><b>{s.title}</b><em>{s.discipline?human(s.discipline):'Obra'}{s.confidence?` • ${Math.round(s.confidence)}%`:''}</em></span></label>)}</div>}
          {!!analysis.safety?.length&&<div className="safety-suggestions"><small><AlertTriangle size={14}/> ATENÇÃO VISUAL/RELATADA</small>{analysis.safety.map((s,i)=><span key={i}>{s}</span>)}</div>}
          {analysis.nextStep&&<div className="next-suggest"><span>PRÓXIMO PASSO SUGERIDO</span><b>{analysis.nextStep}</b></div>}
          <div className="autopilot-actions"><button className="secondary" onClick={()=>setAnalysis(null)}>Voltar</button><button className="primary" onClick={applyVoice} disabled={busy}><Check size={17}/> Confirmar sugestões</button></div>
        </div>}

        {photoAnalysis&&<div className="copilot-result photo-result">
          <div className="result-title"><span><Sparkles size={18}/> LEITURA DA FOTO</span><em>{Math.round(Number(photoAnalysis.confidence||0))}% confiança</em></div>
          <h3>{photoAnalysis.summary}</h3>
          {photoAnalysis.taskId?<p className="linked-task">A foto foi associada ao item mais provável do checklist.</p>:<p className="linked-task muted">Não encontrei correspondência segura com um item pendente. A foto foi salva mesmo assim.</p>}
          {!!photoAnalysis.tags?.length&&<div className="tag-row">{photoAnalysis.tags.map(t=><span key={t}>{t}</span>)}</div>}
          {!!photoAnalysis.safety?.length&&<div className="safety-suggestions"><small><AlertTriangle size={14}/> POSSÍVEIS PONTOS VISUAIS</small>{photoAnalysis.safety.map((s,i)=><span key={i}>{s}</span>)}</div>}
          {photoAnalysis.taskId&&<div className="autopilot-actions"><button className="secondary" onClick={()=>confirmPhoto(false)}>Só vincular</button><button className="primary" onClick={()=>confirmPhoto(true)}><Check size={17}/> Vincular e marcar feito</button></div>}
        </div>}

        {message&&<div className={`autopilot-message ${message.toLowerCase().includes('erro')?'error':''}`}>{message}</div>}
      </section>
    </div>}
  </>
}

function human(v=''){return v.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
