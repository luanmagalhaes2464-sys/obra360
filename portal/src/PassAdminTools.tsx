import {useEffect,useState} from 'react'
import {CheckCircle2,ClipboardCheck,X} from 'lucide-react'

type User={role:string}
type Project={id:number;name:string}
type Req={id:number;title:string;category:string;required:boolean;status:string}
type Gate={id:number;phase_name:string;requirements:Req[]}

async function api<T=any>(url:string,options:RequestInit={}):Promise<T>{const r=await fetch(url,{...options,credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Erro');return d}

export default function PassAdminTools(){
  const [allowed,setAllowed]=useState(false),[open,setOpen]=useState(false),[projects,setProjects]=useState<Project[]>([]),[projectId,setProjectId]=useState<number|null>(null),[gates,setGates]=useState<Gate[]>([]),[busy,setBusy]=useState<number|null>(null)
  useEffect(()=>{api('/api/me').then(r=>{if(['admin','team'].includes(r.user?.role)){setAllowed(true);api('/api/projects').then(p=>{setProjects(p.projects);if(p.projects[0])setProjectId(p.projects[0].id)})}}).catch(()=>{})},[])
  useEffect(()=>{if(projectId)api(`/api/pass/projects/${projectId}`).then(r=>setGates(r.gates)).catch(()=>{})},[projectId,open])
  if(!allowed)return null
  async function setStatus(reqId:number,status:string){if(!projectId)return;setBusy(reqId);try{await api(`/api/pass/projects/${projectId}/requirements/${reqId}`,{method:'PATCH',body:JSON.stringify({status})});const r=await api(`/api/pass/projects/${projectId}`);setGates(r.gates)}finally{setBusy(null)}}
  return <><button className="gate-admin-fab" onClick={()=>setOpen(true)}><ClipboardCheck size={17}/> Checklist Gate</button>{open&&<div className="gate-admin-backdrop"><section className="gate-admin-modal"><header><div><small>EQUIPE TÉCNICA</small><h2>Validação dos requisitos</h2></div><button onClick={()=>setOpen(false)}><X size={20}/></button></header><div className="gate-admin-project"><select value={projectId||''} onChange={e=>setProjectId(Number(e.target.value))}>{projects.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></div><div className="gate-admin-list">{gates.map(g=><article key={g.id}><div className="gate-admin-phase"><b>{g.phase_name}</b><span>{g.requirements.filter(r=>['concluido','nao_aplicavel'].includes(r.status)).length}/{g.requirements.length}</span></div>{g.requirements.map(r=><div className="gate-admin-req" key={r.id}><div><b>{r.title}</b><small>{r.category} {r.required?'• obrigatório':'• apoio'}</small></div><select value={r.status} disabled={busy===r.id} onChange={e=>setStatus(r.id,e.target.value)}><option value="pendente">Pendente</option><option value="concluido">Concluído</option><option value="nao_aplicavel">Não aplicável</option></select>{r.status==='concluido'&&<CheckCircle2 size={17}/>}</div>)}</article>)}</div></section></div>}</>
}
