import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowUpRight, BookOpenText, Bot, Building2,
  CalendarDays, CheckCircle2, ChevronDown, CircleDollarSign, ClipboardCheck, Clock3,
  Construction, FileText, Gauge, HardHat, LayoutDashboard, LogOut, MessageSquareText,
  Milestone, Plus, RefreshCw, Search, Send, Settings2, ShieldCheck, Sparkles,
  TimerReset, Users, WalletCards, X
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'

type User = { id:number; name:string; email:string; role:'admin'|'team'|'client' }
type Project = { id:number; name:string; city?:string; address?:string; client_name?:string; status:string; start_date?:string; planned_end_date?:string; budget:number|string; committed:number|string; spent:number|string; progress:number|string; planned_progress:number|string; updated_at?:string }
type Phase = { id:number; name:string; order_index:number; status:string; planned_start?:string; planned_end?:string; actual_progress:number|string; planned_progress:number|string }
type DocumentRow = { id:number; title:string; category:string; status:string; required_for_phase?:string; expires_at?:string; version?:string; url?:string; responsible?:string; notes?:string; updated_at?:string }
type SafetyItem = { id:number; title:string; category:string; severity:'baixa'|'media'|'alta'|'critica'; status:string; due_date?:string; standard_ref?:string; description?:string; responsible?:string; updated_at?:string }
type EventRow = { id:number; event_type:string; title:string; description?:string; happened_at:string; author_name?:string }
type Decision = { id:number; title:string; description?:string; cost_impact:number|string; days_impact:number; status:string; due_date?:string; created_at:string }
type CostRow = { id:number; category:string; description?:string; planned:number|string; committed:number|string; spent:number|string }
type Member = { id:number; name:string; email:string; role:string; member_role:string }
type Metrics = { documentCompliance:number; safetyOpen:number; criticalOpen:number; pendingDecisions:number; progressVariance:number; financialUsage:number; safetyScore:number; scheduleScore:number; financeScore:number; pulseScore:number; totalOpenBlockers:number }
type Bundle = { project:Project; phases:Phase[]; documents:DocumentRow[]; safety:SafetyItem[]; events:EventRow[]; decisions:Decision[]; costs:CostRow[]; members:Member[]; metrics:Metrics }
type NavKey = 'dashboard'|'cronograma'|'financeiro'|'documentos'|'seguranca'|'historico'|'decisoes'|'ia'|'gestao'

const navItems:{key:NavKey; label:string; icon:any}[] = [
  { key:'dashboard', label:'Visão geral', icon:LayoutDashboard },
  { key:'cronograma', label:'Cronograma', icon:CalendarDays },
  { key:'financeiro', label:'Financeiro', icon:WalletCards },
  { key:'documentos', label:'Documentos', icon:FileText },
  { key:'seguranca', label:'Segurança', icon:HardHat },
  { key:'historico', label:'Memória da obra', icon:BookOpenText },
  { key:'decisoes', label:'Decisões', icon:MessageSquareText },
  { key:'ia', label:'Obra IA', icon:Bot },
]

async function api<T=any>(url:string, options:RequestInit={}) : Promise<T> {
  const res = await fetch(url, { ...options, headers:{ 'Content-Type':'application/json', ...(options.headers||{}) }, credentials:'include' })
  const data = await res.json().catch(()=>({}))
  if (!res.ok) throw new Error(data.error || 'Erro na operação')
  return data
}

const money = (v:any) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(v)||0)
const pct = (v:any) => `${Number(v||0).toFixed(1).replace('.0','')}%`
const shortDate = (v?:string) => v ? new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v)) : '—'
const dateTime = (v?:string) => v ? new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v)) : '—'
const norm = (s:string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')

export default function App(){
  const [user,setUser]=useState<User|null>(null)
  const [loading,setLoading]=useState(true)
  useEffect(()=>{ api('/api/me').then(r=>setUser(r.user)).catch(()=>setUser(null)).finally(()=>setLoading(false)) },[])
  if(loading) return <Splash />
  if(!user) return <Login onLogin={setUser}/>
  return <Portal user={user} onLogout={()=>setUser(null)}/>
}

function Splash(){
  return <div className="splash"><div className="brand-lock"><span>O</span><b>OBRA<em>360</em></b></div><div className="splash-line"/></div>
}

function Login({onLogin}:{onLogin:(u:User)=>void}){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  async function submit(e:FormEvent){
    e.preventDefault(); setBusy(true); setError('')
    try{ const r=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})}); onLogin(r.user) }
    catch(err:any){setError(err.message)} finally{setBusy(false)}
  }
  return <div className="login-page">
    <div className="login-visual">
      <div className="blueprint-grid"/>
      <div className="login-brand"><span className="brand-square">O</span><b>OBRA<em>360</em></b></div>
      <div className="login-copy">
        <span className="overline light">PORTAL DA OBRA</span>
        <h1>Sua obra não precisa ser uma caixa-preta.</h1>
        <p>Acompanhe avanço físico, orçamento, documentos, segurança, decisões e o histórico técnico em um só ambiente.</p>
        <div className="login-pills"><span><Gauge size={16}/> Evolução</span><span><ShieldCheck size={16}/> Segurança</span><span><Bot size={16}/> IA com contexto</span></div>
      </div>
      <div className="visual-ruler"><i/><span>planejamento → execução → entrega</span></div>
    </div>
    <div className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <span className="overline">ACESSO SEGURO</span>
        <h2>Entre no Portal Obra360</h2>
        <p>Use o acesso enviado pela equipe responsável pela sua obra.</p>
        <label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" required/></label>
        <label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required/></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-btn" disabled={busy}>{busy ? 'Entrando…' : 'Entrar no portal'} <ArrowUpRight size={18}/></button>
        <small>Acesso individual e rastreável. Não compartilhe sua senha.</small>
      </form>
    </div>
  </div>
}

function Portal({user,onLogout}:{user:User;onLogout:()=>void}){
  const [projects,setProjects]=useState<Project[]>([])
  const [projectId,setProjectId]=useState<number|null>(null)
  const [bundle,setBundle]=useState<Bundle|null>(null)
  const [view,setView]=useState<NavKey>('dashboard')
  const [loading,setLoading]=useState(true)
  const [mobileNav,setMobileNav]=useState(false)
  const staff=['admin','team'].includes(user.role)

  async function loadProjects(selectFirst=true){
    const r=await api('/api/projects'); setProjects(r.projects)
    if(selectFirst && !projectId && r.projects[0]) setProjectId(r.projects[0].id)
    setLoading(false)
  }
  async function loadBundle(id=projectId){ if(!id) return; const r=await api(`/api/projects/${id}/dashboard`); setBundle(r) }
  useEffect(()=>{ loadProjects().catch(()=>setLoading(false)) },[])
  useEffect(()=>{ if(projectId) loadBundle(projectId).catch(console.error) },[projectId])

  async function logout(){ await api('/api/auth/logout',{method:'POST'}).catch(()=>{}); onLogout() }

  if(loading) return <Splash/>
  if(!projects.length) return <EmptyWorkspace user={user} onCreated={async()=>{await loadProjects(true)}} onLogout={logout}/>

  return <div className="portal-shell">
    <aside className={`sidebar ${mobileNav?'open':''}`}>
      <div className="sidebar-head"><div className="brand-lock small"><span>O</span><b>OBRA<em>360</em></b></div><button className="icon-btn mobile-only" onClick={()=>setMobileNav(false)}><X size={20}/></button></div>
      <div className="project-mini">
        <small>OBRA ATIVA</small>
        <strong>{bundle?.project.name || 'Carregando…'}</strong>
        <span><i className="live-dot"/> {statusLabel(bundle?.project.status)}</span>
      </div>
      <nav className="side-nav">
        {[...navItems,...(staff?[{key:'gestao' as NavKey,label:'Gestão da obra',icon:Settings2}]:[])].map(item=>{
          const Icon=item.icon
          return <button key={item.key} className={view===item.key?'active':''} onClick={()=>{setView(item.key);setMobileNav(false)}}><Icon size={18}/><span>{item.label}</span>{item.key==='decisoes'&&bundle?.metrics.pendingDecisions? <b>{bundle.metrics.pendingDecisions}</b>:null}</button>
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="user-chip"><span>{user.name.slice(0,1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{roleLabel(user.role)}</small></div></div>
        <button className="logout-btn" onClick={logout}><LogOut size={17}/> Sair</button>
      </div>
    </aside>

    <main className="portal-main">
      <header className="topline">
        <button className="mobile-brand mobile-only" onClick={()=>setMobileNav(true)}><Construction size={22}/><span>Menu</span></button>
        <div className="project-select-wrap">
          <Building2 size={18}/>
          <select value={projectId||''} onChange={e=>setProjectId(Number(e.target.value))}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <ChevronDown size={15}/>
        </div>
        <div className="topline-actions">
          {bundle && <span className="sync-stamp"><RefreshCw size={14}/> atualizado {bundle.project.updated_at?dateTime(bundle.project.updated_at):'agora'}</span>}
          <button className="ghost-btn" onClick={()=>loadBundle()}><RefreshCw size={16}/><span className="desktop-only">Atualizar</span></button>
        </div>
      </header>
      {!bundle ? <div className="content-loading">Carregando dados da obra…</div> : <ViewRouter view={view} bundle={bundle} user={user} reload={loadBundle}/>} 
    </main>
  </div>
}

function EmptyWorkspace({user,onCreated,onLogout}:{user:User;onCreated:()=>void;onLogout:()=>void}){
  const staff=['admin','team'].includes(user.role)
  return <div className="empty-workspace"><div className="empty-top"><div className="brand-lock"><span>O</span><b>OBRA<em>360</em></b></div><button className="ghost-btn" onClick={onLogout}><LogOut size={16}/> Sair</button></div>
    <div className="empty-center"><div className="empty-icon"><Building2 size={32}/></div><span className="overline">PORTAL DA OBRA</span><h1>{staff?'Cadastre a primeira obra':'Seu acesso ainda não possui uma obra vinculada.'}</h1><p>{staff?'O sistema começa sem dados fictícios. Cadastre uma obra real e o Portal Obra360 cria a estrutura inicial de fases, documentos e acompanhamento.':'Solicite à equipe Obra360 a vinculação do seu acesso ao empreendimento.'}</p>{staff&&<CreateProjectForm onCreated={onCreated}/>}</div>
  </div>
}

function CreateProjectForm({onCreated}:{onCreated:()=>void}){
  const [open,setOpen]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError('')
    const fd=new FormData(e.currentTarget); const body=Object.fromEntries(fd.entries())
    try{await api('/api/projects',{method:'POST',body:JSON.stringify(body)});setOpen(false);onCreated()}catch(err:any){setError(err.message)}finally{setBusy(false)}
  }
  if(!open) return <button className="primary-btn compact" onClick={()=>setOpen(true)}><Plus size={18}/> Criar primeira obra</button>
  return <form className="quick-form" onSubmit={submit}><div className="field-grid"><label>Nome da obra<input name="name" required placeholder="Ex.: Residência Silva"/></label><label>Município<input name="city" placeholder="Ex.: Viçosa, MG"/></label><label>Cliente<input name="clientName" placeholder="Nome do cliente"/></label><label>Orçamento inicial<input name="budget" type="number" min="0" placeholder="R$"/></label><label>Início<input name="startDate" type="date"/></label><label>Entrega planejada<input name="plannedEndDate" type="date"/></label></div>{error&&<div className="form-error">{error}</div>}<div className="form-actions"><button type="button" className="ghost-btn" onClick={()=>setOpen(false)}>Cancelar</button><button className="primary-btn compact" disabled={busy}>{busy?'Criando…':'Criar obra'}</button></div></form>
}

function ViewRouter({view,bundle,user,reload}:{view:NavKey;bundle:Bundle;user:User;reload:()=>void}){
  if(view==='dashboard') return <Dashboard bundle={bundle} user={user}/>
  if(view==='cronograma') return <Schedule bundle={bundle}/>
  if(view==='financeiro') return <Finance bundle={bundle}/>
  if(view==='documentos') return <Documents bundle={bundle}/>
  if(view==='seguranca') return <Safety bundle={bundle}/>
  if(view==='historico') return <History bundle={bundle}/>
  if(view==='decisoes') return <Decisions bundle={bundle} reload={reload}/>
  if(view==='ia') return <AIView bundle={bundle}/>
  return <Management bundle={bundle} reload={reload}/>
}

function PageHead({eyebrow,title,subtitle,right}:{eyebrow:string;title:string;subtitle:string;right?:any}){
  return <div className="page-head"><div><span className="overline">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{right}</div>
}

function Dashboard({bundle,user}:{bundle:Bundle;user:User}){
  const {project,metrics,phases,documents,safety,events,decisions}=bundle
  const progressData=phases.map(p=>({name:p.name.split(' ').slice(0,2).join(' '),planejado:Number(p.planned_progress||0),real:Number(p.actual_progress||0)}))
  const currentPhase=phases.find(p=>p.status==='em_andamento')||phases.find(p=>p.status!=='concluida')
  const blockers=[
    ...documents.filter(d=>d.status==='pendente'&&(!currentPhase||d.required_for_phase===currentPhase.name)).map(d=>({type:'Documento',label:d.title,level:'warn'})),
    ...safety.filter(s=>['aberta','pendente'].includes(s.status)&&['alta','critica'].includes(s.severity)).map(s=>({type:'Segurança',label:s.title,level:'danger'})),
    ...decisions.filter(d=>d.status==='aguardando').map(d=>({type:'Decisão',label:d.title,level:'info'})),
  ].slice(0,5)
  return <div className="page-content">
    <PageHead eyebrow="CENTRAL DA OBRA" title={`Olá, ${user.name.split(' ')[0]}.`} subtitle={`Veja o que mudou, onde a obra está e o que precisa de decisão em ${project.name}.`} right={<div className="phase-badge"><Milestone size={17}/><div><small>FASE ATUAL</small><b>{currentPhase?.name||'A definir'}</b></div></div>}/>

    <section className="pulse-grid">
      <article className="pulse-card dark-card">
        <div className="card-top"><span><Activity size={17}/> PULSO DA OBRA</span><InfoTip text="Índice interno que combina prazo, finanças, documentos e segurança. Não substitui análise técnica."/></div>
        <div className="pulse-body"><div className="pulse-ring" style={{'--score':metrics.pulseScore} as any}><strong>{metrics.pulseScore}</strong><span>/100</span></div><div className="pulse-copy"><h3>{pulseLabel(metrics.pulseScore)}</h3><p>{metrics.totalOpenBlockers?`${metrics.totalOpenBlockers} ponto(s) pedem atenção para manter a obra fluindo.`:'Nenhum bloqueador relevante foi registrado no momento.'}</p></div></div>
        <div className="mini-scores"><span><i/>Prazo <b>{metrics.scheduleScore}</b></span><span><i/>Financeiro <b>{metrics.financeScore}</b></span><span><i/>Documentos <b>{metrics.documentCompliance}</b></span><span><i/>Segurança <b>{metrics.safetyScore}</b></span></div>
      </article>
      <MetricCard icon={Gauge} label="Avanço físico" value={pct(project.progress)} sub={`Planejado: ${pct(project.planned_progress)}`} tone={metrics.progressVariance<-3?'warn':'ok'}/>
      <MetricCard icon={CircleDollarSign} label="Realizado" value={money(project.spent)} sub={`de ${money(project.budget)} orçados`} tone={metrics.financialUsage>Number(project.progress)+10?'warn':'neutral'}/>
      <MetricCard icon={ClipboardCheck} label="Documentos" value={`${metrics.documentCompliance}%`} sub={`${documents.filter(d=>d.status==='pendente').length} pendência(s)`} tone={metrics.documentCompliance<80?'warn':'ok'}/>
      <MetricCard icon={ShieldCheck} label="Segurança" value={`${metrics.safetyScore}/100`} sub={`${metrics.safetyOpen} item(ns) em aberto`} tone={metrics.criticalOpen?'danger':'ok'}/>
    </section>

    <section className="dashboard-two">
      <article className="panel-card chart-card"><div className="panel-title"><div><span>EVOLUÇÃO FÍSICA</span><h3>Planejado x realizado por fase</h3></div><span className={`delta ${metrics.progressVariance<0?'negative':'positive'}`}>{metrics.progressVariance>=0?'+':''}{metrics.progressVariance.toFixed(1)} p.p.</span></div>
        {progressData.some(d=>d.planejado||d.real)?<div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={progressData}><defs><linearGradient id="realFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d97a50" stopOpacity={0.25}/><stop offset="95%" stopColor="#d97a50" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ece9"/><XAxis dataKey="name" tick={{fontSize:10,fill:'#74807a'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:10,fill:'#74807a'}} axisLine={false} tickLine={false} domain={[0,100]}/><Tooltip/><Area type="monotone" dataKey="planejado" stroke="#9aa8a1" strokeDasharray="6 5" fill="transparent" name="Planejado"/><Area type="monotone" dataKey="real" stroke="#d97a50" strokeWidth={3} fill="url(#realFill)" name="Real"/></AreaChart></ResponsiveContainer></div>:<EmptyMini text="Registre o planejamento e o avanço das fases para gerar o gráfico."/>}
      </article>
      <article className="panel-card gate-card"><div className="panel-title"><div><span>PORTÃO DE FASE</span><h3>O que precisa estar resolvido agora</h3></div><span className={`gate-status ${blockers.length?'blocked':'clear'}`}>{blockers.length?'ATENÇÃO':'SEM BLOQUEIOS'}</span></div>
        <p className="muted">O sistema cruza documentos, decisões e segurança antes da passagem de etapa.</p>
        <div className="blocker-list">{blockers.length?blockers.map((b,i)=><div className="blocker" key={i}><span className={`blocker-icon ${b.level}`}>{b.level==='danger'?<AlertTriangle size={16}/>:b.level==='info'?<MessageSquareText size={16}/>:<FileText size={16}/>}</span><div><small>{b.type}</small><b>{b.label}</b></div></div>):<div className="clear-state"><CheckCircle2 size={25}/><div><b>Nenhum bloqueador crítico cadastrado</b><span>A liberação da próxima etapa continua dependendo da validação da equipe técnica.</span></div></div>}</div>
      </article>
    </section>

    <section className="dashboard-two second-row">
      <article className="panel-card"><div className="panel-title"><div><span>MEMÓRIA DA OBRA</span><h3>Últimas movimentações</h3></div><Clock3 size={18}/></div><div className="activity-list">{events.slice(0,5).map(e=><div className="activity-row" key={e.id}><span className={`event-dot ${e.event_type}`}/><div><b>{e.title}</b><p>{e.description||'Sem descrição adicional.'}</p><small>{dateTime(e.happened_at)}{e.author_name?` • ${e.author_name}`:''}</small></div></div>)}{!events.length&&<EmptyMini text="A história da obra começa a ser registrada a partir das primeiras atualizações."/>}</div></article>
      <article className="panel-card decisions-preview"><div className="panel-title"><div><span>DECISÕES DO CLIENTE</span><h3>O que aguarda resposta</h3></div><span className="number-pill">{metrics.pendingDecisions}</span></div>{decisions.filter(d=>d.status==='aguardando').slice(0,4).map(d=><div className="decision-preview" key={d.id}><div><b>{d.title}</b><p>{d.description||'Aguardando decisão.'}</p></div><span>{d.due_date?`até ${shortDate(d.due_date)}`:'sem prazo definido'}</span></div>)}{!metrics.pendingDecisions&&<div className="clear-state soft"><CheckCircle2 size={24}/><div><b>Nenhuma decisão pendente</b><span>Quando a equipe solicitar uma aprovação, ela aparecerá aqui com impacto de custo e prazo.</span></div></div>}</article>
    </section>
  </div>
}

function MetricCard({icon:Icon,label,value,sub,tone='neutral'}:{icon:any;label:string;value:string;sub:string;tone?:string}){
  return <article className={`metric-card ${tone}`}><div className="metric-icon"><Icon size={18}/></div><small>{label}</small><strong>{value}</strong><span>{sub}</span></article>
}
function InfoTip({text}:{text:string}){ return <span className="info-tip" title={text}>i</span> }
function EmptyMini({text}:{text:string}){return <div className="empty-mini"><Construction size={22}/><span>{text}</span></div>}

function Schedule({bundle}:{bundle:Bundle}){
  const data=bundle.phases.map(p=>({name:p.name.split(' ').slice(0,2).join(' '),planejado:Number(p.planned_progress||0),real:Number(p.actual_progress||0)}))
  return <div className="page-content"><PageHead eyebrow="CRONOGRAMA" title="Evolução por etapa" subtitle="Compare o avanço previsto com o executado e identifique onde existe desvio."/>
    <div className="schedule-summary"><MetricCard icon={Gauge} label="Avanço geral" value={pct(bundle.project.progress)} sub={`Planejado ${pct(bundle.project.planned_progress)}`} tone={bundle.metrics.progressVariance<-3?'warn':'ok'}/><MetricCard icon={TimerReset} label="Desvio físico" value={`${bundle.metrics.progressVariance>=0?'+':''}${bundle.metrics.progressVariance.toFixed(1)} p.p.`} sub={bundle.metrics.progressVariance<-3?'Atenção ao replanejamento':'Dentro da faixa atual'} tone={bundle.metrics.progressVariance<-3?'warn':'ok'}/><MetricCard icon={Milestone} label="Previsão de entrega" value={shortDate(bundle.project.planned_end_date)} sub={statusLabel(bundle.project.status)} /></div>
    <article className="panel-card big-chart"><div className="panel-title"><div><span>CURVA DE PROGRESSO</span><h3>Fases da obra</h3></div></div><div className="chart-wrap tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ece9"/><XAxis dataKey="name" tick={{fontSize:11,fill:'#74807a'}} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tick={{fontSize:10,fill:'#74807a'}} axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="planejado" name="Planejado" fill="#cbd4cf" radius={[6,6,0,0]}/><Bar dataKey="real" name="Real" fill="#d97a50" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div></article>
    <div className="phase-list">{bundle.phases.map((p,i)=><article className="phase-card" key={p.id}><div className="phase-index">{String(i+1).padStart(2,'0')}</div><div className="phase-main"><div className="phase-line"><div><h3>{p.name}</h3><span>{phaseStatus(p.status)}</span></div><b>{pct(p.actual_progress)}</b></div><div className="phase-progress"><i style={{width:`${Math.min(100,Number(p.actual_progress||0))}%`}}/><em style={{left:`${Math.min(100,Number(p.planned_progress||0))}%`}}/></div><div className="phase-meta"><span>Planejado: {pct(p.planned_progress)}</span><span>Início: {shortDate(p.planned_start)}</span><span>Fim previsto: {shortDate(p.planned_end)}</span></div></div></article>)}</div>
  </div>
}

function Finance({bundle}:{bundle:Bundle}){
  const {project,costs,metrics}=bundle
  const chart=costs.map(c=>({name:c.category,planejado:Number(c.planned||0),comprometido:Number(c.committed||0),realizado:Number(c.spent||0)}))
  const remaining=Math.max(0,Number(project.budget||0)-Number(project.spent||0)-Number(project.committed||0))
  return <div className="page-content"><PageHead eyebrow="FINANCEIRO" title="Custo com contexto da execução" subtitle="Veja o orçamento, o que já foi comprometido e o que efetivamente foi realizado."/>
    <section className="finance-hero"><div><small>ORÇAMENTO DA OBRA</small><strong>{money(project.budget)}</strong><p>Base financeira cadastrada pela equipe para acompanhamento do empreendimento.</p></div><div className="finance-bars"><span><b>Realizado</b><em>{money(project.spent)}</em><i><u style={{width:`${Math.min(100,metrics.financialUsage)}%`}}/></i></span><span><b>Comprometido</b><em>{money(project.committed)}</em><i><u style={{width:`${Math.min(100,Number(project.budget)?Number(project.committed)/Number(project.budget)*100:0)}%`}}/></i></span></div></section>
    <div className="schedule-summary"><MetricCard icon={CircleDollarSign} label="Realizado" value={money(project.spent)} sub={`${metrics.financialUsage}% do orçamento`}/><MetricCard icon={ClipboardCheck} label="Comprometido" value={money(project.committed)} sub="Contratos, pedidos ou compromissos"/><MetricCard icon={WalletCards} label="Saldo não comprometido" value={money(remaining)} sub="Baseado nos registros atuais"/></div>
    <article className="panel-card big-chart"><div className="panel-title"><div><span>POR CATEGORIA</span><h3>Planejado x comprometido x realizado</h3></div></div>{chart.length?<div className="chart-wrap tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ece9"/><XAxis dataKey="name" tick={{fontSize:10,fill:'#74807a'}} axisLine={false} tickLine={false}/><YAxis tickFormatter={v=>`R$${Math.round(v/1000)}k`} tick={{fontSize:10,fill:'#74807a'}} axisLine={false} tickLine={false}/><Tooltip formatter={(v:any)=>money(v)}/><Bar dataKey="planejado" fill="#cbd4cf" name="Planejado" radius={[5,5,0,0]}/><Bar dataKey="comprometido" fill="#6f8f80" name="Comprometido" radius={[5,5,0,0]}/><Bar dataKey="realizado" fill="#d97a50" name="Realizado" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div>:<EmptyMini text="Cadastre categorias de custo na Gestão da Obra para abrir a visão analítica."/>}</article>
  </div>
}

function Documents({bundle}:{bundle:Bundle}){
  const [query,setQuery]=useState('')
  const rows=bundle.documents.filter(d=>norm(d.title+' '+d.category+' '+(d.responsible||'')).includes(norm(query)))
  return <div className="page-content"><PageHead eyebrow="DOSSIÊ DA OBRA" title="Documentos e conformidade" subtitle="Um único lugar para saber o que existe, o que está pendente, a versão atual e quando precisa de atenção." right={<div className="compliance-ring" style={{'--comp': `${bundle.metrics.documentCompliance}%`} as any}><strong>{bundle.metrics.documentCompliance}%</strong><small>conformidade</small></div>}/>
    <div className="toolbar"><div className="search-box"><Search size={17}/><input placeholder="Buscar documento, categoria ou responsável" value={query} onChange={e=>setQuery(e.target.value)}/></div><span className="toolbar-note">{rows.length} registro(s)</span></div>
    <div className="table-card"><div className="table-head docs-grid"><span>Documento</span><span>Categoria</span><span>Fase</span><span>Responsável</span><span>Validade</span><span>Status</span></div>{rows.map(d=><div className="table-row docs-grid" key={d.id}><div><b>{d.title}</b><small>{d.version?`Versão ${d.version}`:'Sem versão registrada'}</small></div><span>{humanize(d.category)}</span><span>{d.required_for_phase||'—'}</span><span>{d.responsible||'—'}</span><span>{d.expires_at?shortDate(d.expires_at):'—'}</span><StatusChip value={d.status}/></div>)}{!rows.length&&<EmptyMini text="Nenhum documento corresponde à busca."/>}</div>
    <div className="notice-card"><ShieldCheck size={20}/><div><b>Checklist orientativo, não automático</b><p>A exigência de documentos depende do tipo, município, escopo, profissionais envolvidos e enquadramento da obra. A equipe técnica deve validar o checklist aplicável a cada empreendimento.</p></div></div>
  </div>
}

function Safety({bundle}:{bundle:Bundle}){
  const open=bundle.safety.filter(s=>!['resolvida','concluida','fechada'].includes(s.status))
  return <div className="page-content"><PageHead eyebrow="SEGURANÇA DO TRABALHO" title="Risco visível antes de virar problema" subtitle="Pendências, inspeções e itens de segurança conectados ao histórico e às etapas da obra." right={<div className={`risk-score ${bundle.metrics.safetyScore<70?'attention':''}`}><small>ÍNDICE INTERNO</small><strong>{bundle.metrics.safetyScore}/100</strong></div>}/>
    <section className="safety-summary"><MetricCard icon={AlertTriangle} label="Abertos" value={String(bundle.metrics.safetyOpen)} sub="Itens ainda não encerrados" tone={bundle.metrics.safetyOpen?'warn':'ok'}/><MetricCard icon={ShieldCheck} label="Alta / crítica" value={String(bundle.metrics.criticalOpen)} sub="Priorização imediata" tone={bundle.metrics.criticalOpen?'danger':'ok'}/><MetricCard icon={HardHat} label="Registros totais" value={String(bundle.safety.length)} sub="Histórico de SST da obra"/></section>
    <div className="risk-board">{open.length?open.map(s=><article className={`risk-item-card severity-${s.severity}`} key={s.id}><div className="risk-title"><span className="severity-mark"/><div><small>{humanize(s.category)} {s.standard_ref?`• ${s.standard_ref}`:''}</small><h3>{s.title}</h3></div><StatusChip value={s.status}/></div><p>{s.description||'Sem descrição adicional.'}</p><div className="risk-meta"><span><Users size={14}/>{s.responsible||'Responsável não definido'}</span><span><CalendarDays size={14}/>{s.due_date?`Prazo ${shortDate(s.due_date)}`:'Sem prazo cadastrado'}</span><span className="severity-text">Severidade {s.severity}</span></div></article>):<div className="large-clear"><ShieldCheck size={34}/><h3>Nenhuma pendência de segurança aberta</h3><p>Novos registros de inspeção, treinamento, EPI/EPC ou não conformidade aparecerão aqui.</p></div>}</div>
    <div className="notice-card"><AlertTriangle size={20}/><div><b>O sistema apoia a gestão; não substitui avaliação profissional</b><p>Classificação de risco, medidas de controle, PGR e liberações de atividade devem seguir a análise dos profissionais legalmente habilitados e o enquadramento real da obra.</p></div></div>
  </div>
}

function History({bundle}:{bundle:Bundle}){
  const [query,setQuery]=useState('')
  const events=bundle.events.filter(e=>norm(e.title+' '+(e.description||'')+' '+e.event_type).includes(norm(query)))
  return <div className="page-content"><PageHead eyebrow="MEMÓRIA DA OBRA" title="Uma linha do tempo que não se perde no WhatsApp" subtitle="Decisões, documentos, ocorrências e atualizações ficam rastreáveis para o cliente e para a equipe."/>
    <div className="toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar no histórico da obra"/></div><span className="toolbar-note">{events.length} evento(s)</span></div>
    <div className="timeline-feed">{events.map(e=><article className="timeline-event" key={e.id}><div className={`timeline-icon type-${e.event_type}`}>{eventIcon(e.event_type)}</div><div className="timeline-body"><div><span>{humanize(e.event_type)}</span><time>{dateTime(e.happened_at)}</time></div><h3>{e.title}</h3>{e.description&&<p>{e.description}</p>}{e.author_name&&<small>Registrado por {e.author_name}</small>}</div></article>)}{!events.length&&<EmptyMini text="Nenhum registro encontrado."/>}</div>
  </div>
}

function Decisions({bundle,reload}:{bundle:Bundle;reload:()=>void}){
  async function decide(id:number,status:string){ if(!confirm(status==='aprovada'?'Confirmar aprovação desta decisão?':'Confirmar rejeição desta decisão?'))return; await api(`/api/projects/${bundle.project.id}/decisions/${id}`,{method:'PATCH',body:JSON.stringify({status})});reload() }
  return <div className="page-content"><PageHead eyebrow="DECISÕES" title="Escolhas com impacto claro" subtitle="Antes de aprovar, veja o que a decisão pode representar em custo, prazo e sequência da obra."/>
    <div className="decision-grid">{bundle.decisions.map(d=><article className={`decision-card ${d.status}`} key={d.id}><div className="decision-head"><div><small>{d.status==='aguardando'?'AGUARDANDO RESPOSTA':humanize(d.status).toUpperCase()}</small><h3>{d.title}</h3></div><StatusChip value={d.status}/></div><p>{d.description||'Sem descrição adicional.'}</p><div className="impact-grid"><span><CircleDollarSign size={17}/><div><small>Impacto estimado</small><b>{Number(d.cost_impact)?money(d.cost_impact):'Sem impacto cadastrado'}</b></div></span><span><Clock3 size={17}/><div><small>Prazo</small><b>{d.days_impact?`${d.days_impact>0?'+':''}${d.days_impact} dia(s)`:'Sem impacto cadastrado'}</b></div></span></div><div className="decision-foot"><span>{d.due_date?`Responder até ${shortDate(d.due_date)}`:'Sem prazo definido'}</span>{d.status==='aguardando'&&<div><button className="reject-btn" onClick={()=>decide(d.id,'rejeitada')}>Não aprovar</button><button className="approve-btn" onClick={()=>decide(d.id,'aprovada')}><CheckCircle2 size={16}/> Aprovar</button></div>}</div></article>)}{!bundle.decisions.length&&<div className="large-clear"><MessageSquareText size={34}/><h3>Nenhuma decisão registrada</h3><p>Quando houver uma escolha que dependa do cliente, ela aparecerá aqui com contexto de custo e prazo.</p></div>}</div>
  </div>
}

function AIView({bundle}:{bundle:Bundle}){
  const [messages,setMessages]=useState<{role:'user'|'assistant';text:string;evidence?:any[];mode?:string}[]>([{role:'assistant',text:`Eu sou a Obra IA. Consigo consultar o que está registrado em ${bundle.project.name}: histórico, documentos, cronograma, custos, decisões e segurança. Pergunte, por exemplo, “o que mudou na última semana?” ou “o que falta para avançar de fase?”.`}])
  const [text,setText]=useState('')
  const [busy,setBusy]=useState(false)
  const endRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[messages])
  const suggestions=['O que mudou na última semana?','Quais documentos estão pendentes?','Estamos atrasados?','O que falta para avançar de fase?','Há riscos de segurança abertos?','Como está o orçamento?']
  async function ask(q=text){ if(!q.trim()||busy)return; setMessages(m=>[...m,{role:'user',text:q}]);setText('');setBusy(true);try{const r=await api(`/api/projects/${bundle.project.id}/ai`,{method:'POST',body:JSON.stringify({question:q})});setMessages(m=>[...m,{role:'assistant',text:r.answer,evidence:r.evidence,mode:r.mode}])}catch(err:any){setMessages(m=>[...m,{role:'assistant',text:`Não consegui consultar os dados agora: ${err.message}`}])}finally{setBusy(false)} }
  return <div className="page-content ai-page"><PageHead eyebrow="OBRA IA" title="Pergunte para o histórico da sua obra" subtitle="Respostas conectadas aos registros do empreendimento, em vez de uma IA genérica sem contexto." right={<span className="ai-grounded"><Sparkles size={15}/> contexto da obra</span>}/>
    <div className="ai-layout"><aside className="ai-context"><span className="overline">CONTEXTO ATIVO</span><h3>{bundle.project.name}</h3><div className="context-stat"><Activity size={17}/><span>Avanço</span><b>{pct(bundle.project.progress)}</b></div><div className="context-stat"><FileText size={17}/><span>Docs pendentes</span><b>{bundle.documents.filter(d=>d.status==='pendente').length}</b></div><div className="context-stat"><ShieldCheck size={17}/><span>Segurança aberta</span><b>{bundle.metrics.safetyOpen}</b></div><div className="context-stat"><BookOpenText size={17}/><span>Eventos lidos</span><b>{bundle.events.length}</b></div><div className="ai-warning"><ShieldCheck size={17}/><p>A IA não substitui a decisão do engenheiro, arquiteto ou profissional de segurança responsável.</p></div></aside>
      <section className="chat-card"><div className="chat-messages">{messages.map((m,i)=><div className={`chat-message ${m.role}`} key={i}>{m.role==='assistant'&&<div className="ai-avatar"><Bot size={18}/></div>}<div className="bubble"><p>{m.text}</p>{m.evidence&&m.evidence.length>0&&<div className="evidence-row"><small>REGISTROS CONSULTADOS</small>{m.evidence.slice(0,4).map((e:any,j:number)=><span key={j}>{e.type}: {e.label}</span>)}</div>}{m.role==='assistant'&&m.mode&&<em>{m.mode==='ai'?'IA conectada':'análise baseada nos dados do portal'}</em>}</div></div>)}{busy&&<div className="chat-message assistant"><div className="ai-avatar"><Bot size={18}/></div><div className="bubble typing"><i/><i/><i/></div></div>}<div ref={endRef}/></div><div className="suggestions">{suggestions.map(s=><button key={s} onClick={()=>ask(s)}>{s}</button>)}</div><div className="chat-input"><textarea rows={1} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask()}}} placeholder="Pergunte sobre a sua obra…"/><button onClick={()=>ask()} disabled={busy||!text.trim()}><Send size={18}/></button></div></section>
    </div>
  </div>
}

function Management({bundle,reload}:{bundle:Bundle;reload:()=>void}){
  const [tab,setTab]=useState<'indicadores'|'historico'|'documento'|'seguranca'|'decisao'|'financeiro'|'acesso'>('indicadores')
  const [msg,setMsg]=useState('')
  const projectId=bundle.project.id
  async function handle(e:FormEvent<HTMLFormElement>,endpoint:string,method='POST'){e.preventDefault();setMsg('');const body=Object.fromEntries(new FormData(e.currentTarget).entries());try{await api(endpoint,{method,body:JSON.stringify(body)});setMsg('Salvo com sucesso.');(e.currentTarget as HTMLFormElement).reset();await reload()}catch(err:any){setMsg(err.message)}}
  return <div className="page-content"><PageHead eyebrow="GESTÃO DA OBRA" title="Atualize o portal com dados reais" subtitle="Área da equipe técnica para alimentar o que o cliente acompanha e o que a Obra IA utiliza como contexto."/>
    <div className="management-tabs">{[['indicadores','Indicadores'],['historico','Diário / histórico'],['documento','Documento'],['seguranca','Segurança'],['decisao','Decisão'],['financeiro','Custo'],['acesso','Acesso do cliente']].map(([k,l])=><button key={k} className={tab===k?'active':''} onClick={()=>{setTab(k as any);setMsg('')}}>{l}</button>)}</div>
    <div className="management-card">{tab==='indicadores'&&<form onSubmit={e=>handle(e,`/api/projects/${projectId}`,'PATCH')}><FormTitle title="Atualizar indicadores principais" text="Use os valores consolidados mais recentes da obra."/><div className="field-grid"><label>Avanço físico (%)<input name="progress" type="number" step="0.1" min="0" max="100" defaultValue={bundle.project.progress}/></label><label>Avanço planejado (%)<input name="plannedProgress" type="number" step="0.1" min="0" max="100" defaultValue={bundle.project.planned_progress}/></label><label>Orçamento total<input name="budget" type="number" min="0" defaultValue={bundle.project.budget}/></label><label>Comprometido<input name="committed" type="number" min="0" defaultValue={bundle.project.committed}/></label><label>Realizado / pago<input name="spent" type="number" min="0" defaultValue={bundle.project.spent}/></label><label>Status<select name="status" defaultValue={bundle.project.status}><option value="planejamento">Planejamento</option><option value="em_execucao">Em execução</option><option value="pausada">Pausada</option><option value="concluida">Concluída</option></select></label></div><SaveButton/></form>}
      {tab==='historico'&&<form onSubmit={e=>handle(e,`/api/projects/${projectId}/events`)}><FormTitle title="Registrar diário / ocorrência" text="O registro entra na Memória da Obra e pode ser consultado pela IA."/><div className="field-grid"><label>Tipo<select name="eventType"><option value="atualizacao">Atualização</option><option value="obra">Execução</option><option value="visita">Visita técnica</option><option value="reuniao">Reunião</option><option value="ocorrencia">Ocorrência</option></select></label><label className="span2">Título<input name="title" required placeholder="Ex.: Concretagem do pavimento concluída"/></label><label className="span3">Descrição<textarea name="description" rows={4} placeholder="O que aconteceu, decisões tomadas, pendências e responsáveis."/></label></div><SaveButton/></form>}
      {tab==='documento'&&<form onSubmit={e=>handle(e,`/api/projects/${projectId}/documents`)}><FormTitle title="Adicionar documento" text="Cadastre o item com status, fase, responsável e validade."/><div className="field-grid"><label className="span2">Documento<input name="title" required placeholder="Ex.: ART de execução"/></label><label>Categoria<select name="category"><option value="projeto">Projeto</option><option value="legal">Legal</option><option value="responsabilidade_tecnica">Responsabilidade técnica</option><option value="seguranca">Segurança</option><option value="qualidade">Qualidade</option></select></label><label>Status<select name="status"><option value="pendente">Pendente</option><option value="em_analise">Em análise</option><option value="aprovado">Aprovado</option><option value="valido">Válido</option></select></label><label>Fase relacionada<select name="requiredForPhase"><option value="">Sem fase específica</option>{bundle.phases.map(p=><option key={p.id}>{p.name}</option>)}</select></label><label>Responsável<input name="responsible"/></label><label>Validade<input name="expiresAt" type="date"/></label><label>Versão<input name="version"/></label><label className="span2">Link / URL<input name="url" type="url" placeholder="https://..."/></label></div><SaveButton/></form>}
      {tab==='seguranca'&&<form onSubmit={e=>handle(e,`/api/projects/${projectId}/safety`)}><FormTitle title="Registrar item de segurança" text="Não conformidades, inspeções, treinamentos, EPI/EPC e demais controles podem entrar aqui."/><div className="field-grid"><label className="span2">Título<input name="title" required/></label><label>Categoria<select name="category"><option value="inspecao">Inspeção</option><option value="epi">EPI</option><option value="epc">EPC</option><option value="treinamento">Treinamento</option><option value="pgr">PGR</option><option value="nao_conformidade">Não conformidade</option></select></label><label>Severidade<select name="severity"><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="critica">Crítica</option></select></label><label>Referência / NR<input name="standardRef" placeholder="Ex.: NR-18"/></label><label>Responsável<input name="responsible"/></label><label>Prazo<input name="dueDate" type="date"/></label><label className="span3">Descrição<textarea name="description" rows={4}/></label></div><SaveButton/></form>}
      {tab==='decisao'&&<form onSubmit={e=>handle(e,`/api/projects/${projectId}/decisions`)}><FormTitle title="Solicitar decisão do cliente" text="Mostre o contexto e o impacto para tirar aprovações importantes do WhatsApp."/><div className="field-grid"><label className="span2">Decisão<input name="title" required placeholder="Ex.: Aprovação do revestimento externo"/></label><label>Prazo para resposta<input name="dueDate" type="date"/></label><label>Impacto de custo<input name="costImpact" type="number" step="0.01"/></label><label>Impacto em dias<input name="daysImpact" type="number"/></label><label className="span3">Contexto<textarea name="description" rows={4} placeholder="Explique opções, consequência e o que precisa ser decidido."/></label></div><SaveButton/></form>}
      {tab==='financeiro'&&<form onSubmit={e=>handle(e,`/api/projects/${projectId}/costs`)}><FormTitle title="Adicionar categoria de custo" text="Abra o orçamento por grupo para comparar planejado, comprometido e realizado."/><div className="field-grid"><label>Categoria<input name="category" required placeholder="Ex.: Estrutura"/></label><label>Planejado<input name="planned" type="number" step="0.01"/></label><label>Comprometido<input name="committed" type="number" step="0.01"/></label><label>Realizado<input name="spent" type="number" step="0.01"/></label><label className="span2">Descrição<input name="description"/></label></div><SaveButton/></form>}
      {tab==='acesso'&&<form onSubmit={e=>handle(e,`/api/projects/${projectId}/users`)}><FormTitle title="Criar acesso do cliente ou da equipe" text="Cada acesso é individual e fica vinculado somente a esta obra."/><div className="field-grid"><label>Nome<input name="name" required/></label><label>E-mail<input name="email" type="email" required/></label><label>Senha inicial<input name="password" type="password" minLength={8} required/></label><label>Perfil<select name="role"><option value="client">Cliente</option><option value="team">Equipe técnica</option></select></label></div><SaveButton/><div className="member-list">{bundle.members.map(m=><span key={m.id}><b>{m.name}</b><small>{m.email} • {roleLabel(m.member_role)}</small></span>)}</div></form>}
      {msg&&<div className={msg.includes('sucesso')?'form-success':'form-error'}>{msg}</div>}</div>
  </div>
}

function FormTitle({title,text}:{title:string;text:string}){return <div className="form-title"><h3>{title}</h3><p>{text}</p></div>}
function SaveButton(){return <div className="form-actions right"><button className="primary-btn compact"><CheckCircle2 size={17}/> Salvar registro</button></div>}
function StatusChip({value}:{value:string}){const v=norm(value);const tone=v.includes('aprov')||v.includes('conclu')||v.includes('valid')||v.includes('resol')?'success':v.includes('rejeit')||v.includes('crit')?'danger':v.includes('pend')||v.includes('aguard')||v.includes('aberta')?'warning':'neutral';return <span className={`status-chip ${tone}`}>{humanize(value)}</span>}
function eventIcon(type:string){ if(type==='seguranca') return <ShieldCheck size={18}/>; if(type==='documento') return <FileText size={18}/>; if(type==='decisao') return <MessageSquareText size={18}/>; if(type==='reuniao') return <Users size={18}/>; return <Activity size={18}/> }
function pulseLabel(score:number){ if(score>=85)return 'Obra estável'; if(score>=70)return 'Atenção controlada'; if(score>=50)return 'Requer ação'; return 'Risco elevado' }
function statusLabel(s?:string){return humanize(s||'a definir')}
function phaseStatus(s:string){return ({nao_iniciada:'Não iniciada',em_andamento:'Em andamento',concluida:'Concluída',pausada:'Pausada'} as any)[s]||humanize(s)}
function roleLabel(s:string){return ({admin:'Administrador',team:'Equipe técnica',client:'Cliente'} as any)[s]||humanize(s)}
function humanize(s:string){return String(s||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
