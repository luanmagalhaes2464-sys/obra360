import {useEffect,useMemo,useState} from 'react'
import {Building2,CheckCircle2,ShieldCheck,Clock3,MapPin} from 'lucide-react'

type PublicData={project:{id:number;name:string;city?:string;status:string;progress:number|string;updated_at?:string};verification:{released:number;total:number;current:string;lastRelease?:string|null};gates:{phase_name:string;status:string;released_at?:string}[]}
const date=(v?:string|null)=>v?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v)):'—'
const pct=(v:any)=>`${Number(v||0).toFixed(1).replace('.0','')}%`

export default function PublicPass(){
  const id=useMemo(()=>Number(window.location.pathname.split('/').filter(Boolean).at(-1)),[])
  const[data,setData]=useState<PublicData|null>(null),[error,setError]=useState('')
  useEffect(()=>{fetch(`/api/public/pass/${id}`).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Não encontrado');setData(d)}).catch(e=>setError(e.message))},[id])
  if(error)return <div className="public-pass-state"><ShieldCheck size={34}/><h1>Registro não encontrado</h1><p>{error}</p></div>
  if(!data)return <div className="public-pass-state"><ShieldCheck size={34}/><p>Validando registro…</p></div>
  return <div className="public-pass-page"><header><div className="pass-logo"><span>O</span><div><b>OBRA360</b><small>PASS</small></div></div><span className="public-verified"><ShieldCheck size={16}/> registro verificável</span></header><main><section className="public-pass-hero"><span>PASSAPORTE DA OBRA</span><h1>{data.project.name}</h1><p><MapPin size={15}/>{data.project.city||'Município não informado'}</p><div className="public-pass-summary"><div><small>Avanço informado</small><b>{pct(data.project.progress)}</b></div><div><small>Gates liberados</small><b>{data.verification.released}/{data.verification.total}</b></div><div><small>Etapa atual</small><b>{data.verification.current}</b></div></div><div className="public-pass-note">Esta página confirma registros do Obra360 PASS. Não é laudo, certificado legal, garantia de conformidade integral ou substituto das responsabilidades técnicas aplicáveis.</div></section><section className="public-gates"><div className="public-section-title"><div><span>RASTREABILIDADE</span><h2>Etapas registradas</h2></div><div><Clock3 size={15}/> última liberação {date(data.verification.lastRelease)}</div></div>{data.gates.map((g,i)=><article key={i} className={g.status==='released'?'released':''}><span>{String(i+1).padStart(2,'0')}</span><div><b>{g.phase_name}</b><small>{g.status==='released'?`Liberada em ${date(g.released_at)}`:'Ainda não liberada'}</small></div>{g.status==='released'?<CheckCircle2 size={18}/>:<span className="public-dot"/>}</article>)}</section><footer><Building2 size={16}/> Obra acompanhada com Obra360 PASS</footer></main></div>
}
