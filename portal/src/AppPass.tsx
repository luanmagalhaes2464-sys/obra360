import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowRight, Bot, Building2, CheckCircle2, ChevronRight,
  ClipboardCheck, Construction, FileText, Fingerprint, Gauge, HardHat, History,
  KeyRound, Landmark, LockKeyhole, LogOut, MessageSquareText, Milestone, Plus,
  QrCode, Search, Send, ShieldCheck, Sparkles, TimerReset, UserRound, WalletCards,
  Wrench, XCircle
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

type User={id:number;name:string;email:string;role:'admin'|'team'|'client'}
type Project={id:number;name:string;city?:string;address?:string;status:string;budget:number|string;spent:number|string;progress:number|string;planned_progress:number|string;updated_at?:string}
type GateRequirement={id:number;title:string;category:string;required:boolean;status:string;notes?:string;evidence_count:number}
type Gate={id:number;phase_id?:number;phase_name:string;order_index:number;status:string;technical_score:number;released_at?:string;released_by_name?:string;notes?:string;requirements:GateRequirement[];evidence_count:number;payment?:PaymentRelease|null}
type PaymentRelease={id:number;gate_id?:number;description:string;claimed_amount:number|string;validated_amount:number|string;recommendation:string;reason?:string;status:string;created_at:string;decided_at?:string}
type PassportItem={id:number;system_type:string;zone:string;title:string;description?:string;photo_url?:string;height_cm?:number;depth_cm?:number;warranty_until?:string;supplier?:string;created_at:string}
type RiskItem={code:string;title:string;severity:'baixa'|'media'|'alta'|'critica';why:string;action:string;source:string}
type PassBundle={project:Project;gates:Gate[];payments:PaymentRelease[];passport:PassportItem[];riskRadar:{phase:string;score:number;level:string;items:RiskItem[]};summary:{released:number;blocked:number;pending:number;passportItems:number;paymentPending:number;nextGate?:Gate|null}}
type Nav='pass'|'pagamentos'|'passaporte'|'risco'|'ia'|'gestao'

async function api<T=any>(url:string,options:RequestInit={}):Promise<T>{
  const r=await fetch(url,{...options,credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})}})
  const d=await r.json().catch(()=>({}))
  if(!r.ok)throw new Error(d.error||'Erro na operação')
  return d
}
const money=(v:any)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(v)||0)
const pct=(v:any)=>`${Number(v||0).toFixed(1).replace('.0','')}%`
const date=(v?:string)=>v?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v)):'—'
const human=(v:string)=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())

export default function AppPass(){
  const [user,setUser]=useState<User|null>(null)
  const [loading,setLoading]=useState(true)
  useEffect(()=>{api('/api/me').then(r=>setUser(r.user)).catch(()=>{}).finally(()=>setLoading(false))},[])
  if(loading)return <Splash/>
  if(!user)return <Login onLogin={setUser}/>
  return <Portal user={user} onLogout={()=>setUser(null)}/>
}

function Splash(){return <div className="pass-splash"><div className="pass-logo"><span>O</span><div><b>OBRA360</b><small>PASS</small></div></div></div>}

function Login({onLogin}:{onLogin:(u:User)=>void}){
  const [email,setEmail]=useState('');const[password,setPassword]=useState('');const[error,setError]=useState('');const[busy,setBusy]=useState(false)
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const r=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})});onLogin(r.user)}catch(e:any){setError(e.message)}finally{setBusy(false)}}
  return <div className="pass-login"><section className="pass-login-copy"><div className="pass-logo"><span>O</span><div><b>OBRA360</b><small>PASS</small></div></div><div><span className="kicker light">PASSAPORTE VERIFICÁVEL DA OBRA</span><h1>Não pague no escuro.<br/>Não avance no improviso.</h1><p>Cada etapa reúne evidências, pendências, validação técnica, segurança e liberação financeira em um único registro.</p><div className="login-features"><span><Milestone size={17}/> Gates por etapa</span><span><WalletCards size={17}/> Medição validada</span><span><Fingerprint size={17}/> DNA do imóvel</span></div></div></section><section className="pass-login-form"><form onSubmit={submit}><span className="kicker">ACESSO AO PORTAL</span><h2>Entre na sua obra</h2><p>Use o acesso individual enviado pela equipe Obra360.</p><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<div className="form-error">{error}</div>}<button disabled={busy}>{busy?'Entrando…':'Entrar no Obra360 PASS'} <ArrowRight size={17}/></button></form></section></div>
}

function Portal({user,onLogout}:{user:User;onLogout:()=>void}){
  const staff=['admin','team'].includes(user.role)
  const [projects,setProjects]=useState<Project[]>([]);const[projectId,setProjectId]=useState<number|null>(null);const[bundle,setBundle]=useState<PassBundle|null>(null);const[nav,setNav]=useState<Nav>('pass');const[menu,setMenu]=useState(false)
  async function loadProjects(){const r=await api('/api/projects');setProjects(r.projects);if(!projectId&&r.projects[0])setProjectId(r.projects[0].id)}
  async function load(){if(projectId){const r=await api(`/api/pass/projects/${projectId}`);setBundle(r)}}
  useEffect(()=>{loadProjects()},[]);useEffect(()=>{load()},[projectId])
  async function logout(){await api('/api/auth/logout',{method:'POST'}).catch(()=>{});onLogout()}
  if(!projects.length)return <Empty user={user} reload={loadProjects} logout={logout}/>
  const items:[Nav,string,any][]=[['pass','Obra360 PASS',ShieldCheck],['pagamentos','Medições & pagamentos',WalletCards],['passaporte','Passaporte do imóvel',Fingerprint],['risco','Radar da próxima etapa',HardHat],['ia','Obra IA',Bot],...(staff?[['gestao','Gestão técnica',Wrench] as [Nav,string,any]]:[])]
  return <div className="pass-shell"><aside className={menu?'pass-side open':'pass-side'}><div className="pass-side-head"><div className="pass-logo small"><span>O</span><div><b>OBRA360</b><small>PASS</small></div></div><button onClick={()=>setMenu(false)} className="mobile-close"><XCircle size={20}/></button></div><div className="active-project"><small>OBRA ATIVA</small><b>{bundle?.project.name||'Carregando…'}</b><span>{bundle?.project.city||'Município não informado'}</span></div><nav>{items.map(([k,l,I])=><button key={k} className={nav===k?'active':''} onClick={()=>{setNav(k);setMenu(false)}}><I size={18}/><span>{l}</span>{k==='pagamentos'&&bundle?.summary.paymentPending?<em>{bundle.summary.paymentPending}</em>:null}</button>)}</nav><div className="pass-user"><div><span>{user.name.slice(0,1).toUpperCase()}</span><p><b>{user.name}</b><small>{human(user.role)}</small></p></div><button onClick={logout}><LogOut size={16}/></button></div></aside>
    <main className="pass-main"><header className="pass-top"><button className="pass-menu-btn" onClick={()=>setMenu(true)}><Construction size={19}/> Menu</button><div className="pass-project-select"><Building2 size={16}/><select value={projectId||''} onChange={e=>setProjectId(Number(e.target.value))}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div><span className="pass-top-note">última atualização {bundle?.project.updated_at?date(bundle.project.updated_at):'—'}</span></header>{!bundle?<div className="pass-loading">Carregando obra…</div>:<View nav={nav} bundle={bundle} staff={staff} reload={load}/>}</main></div>
}

function View({nav,bundle,staff,reload}:{nav:Nav;bundle:PassBundle;staff:boolean;reload:()=>void}){
  if(nav==='pass')return <PassView b={bundle}/>
  if(nav==='pagamentos')return <PaymentsView b={bundle} reload={reload}/>
  if(nav==='passaporte')return <PassportView b={bundle}/>
  if(nav==='risco')return <RiskView b={bundle}/>
  if(nav==='ia')return <AIView b={bundle}/>
  return <Management b={bundle} reload={reload}/>
}

function PageHead({tag,title,text,right}:{tag:string;title:string;text:string;right?:any}){return <div className="pass-page-head"><div><span className="kicker">{tag}</span><h1>{title}</h1><p>{text}</p></div>{right}</div>}

function PassView({b}:{b:PassBundle}){
  const next=b.summary.nextGate
  return <div className="pass-page"><PageHead tag="OBRA360 PASS" title="Só avance quando estiver certo." text="Cada etapa reúne o que precisa estar concluído antes do próximo serviço — e antes do próximo pagamento." right={<div className="trust-badge"><ShieldCheck size={21}/><div><small>STATUS DO PRÓXIMO GATE</small><b>{next?gateLabel(next.status):'Todas as etapas liberadas'}</b></div></div>}/>
    <section className="pass-hero-grid"><article className="pass-hero-card"><div className="pass-hero-top"><div><small>AVANÇO FÍSICO</small><strong>{pct(b.project.progress)}</strong></div><div><small>ETAPAS LIBERADAS</small><strong>{b.summary.released}/{b.gates.length}</strong></div><div><small>PAGAMENTOS EM ANÁLISE</small><strong>{b.summary.paymentPending}</strong></div></div><div className="pass-track"><i style={{width:`${Math.min(100,Number(b.project.progress||0))}%`}}/></div><p>O percentual físico é informativo. A liberação de uma etapa depende dos requisitos e evidências registrados no gate.</p></article><article className="pass-next"><span className="kicker">PRÓXIMO PASSO</span><h3>{next?.phase_name||'Obra concluída'}</h3>{next?<><p>{next.requirements.filter(r=>r.required&&r.status!=='concluido').length} requisito(s) obrigatório(s) ainda não concluído(s).</p><div className="next-stats"><span><FileText size={16}/>{next.requirements.length} requisitos</span><span><ClipboardCheck size={16}/>{next.evidence_count} evidências</span></div></>:<p>Todos os gates cadastrados foram liberados.</p>}</article></section>
    <section className="gate-roadmap">{b.gates.map((g,i)=><GateCard key={g.id} gate={g} index={i}/>)}</section>
    <section className="pass-principle"><div><LockKeyhole size={24}/><h3>Gate técnico não é um “check” automático.</h3></div><p>O sistema organiza evidências, pendências e registros. A liberação técnica continua sendo responsabilidade do profissional competente para aquele serviço.</p></section>
  </div>
}

function GateCard({gate,index}:{gate:Gate;index:number}){
  const [open,setOpen]=useState(false);const done=gate.requirements.filter(r=>r.status==='concluido').length;const total=gate.requirements.length;const requiredPending=gate.requirements.filter(r=>r.required&&r.status!=='concluido').length
  return <article className={`gate-card gate-${gate.status}`}><button className="gate-main" onClick={()=>setOpen(!open)}><span className="gate-index">{String(index+1).padStart(2,'0')}</span><div className="gate-name"><small>{gate.status==='released'?'ETAPA LIBERADA':gate.status==='blocked'?'ETAPA BLOQUEADA':'GATE EM VALIDAÇÃO'}</small><h3>{gate.phase_name}</h3></div><div className="gate-score"><span>{done}/{total}</span><small>requisitos</small></div><div className="gate-status-dot"><span/><b>{gateLabel(gate.status)}</b></div><ChevronRight size={18} className={open?'rotated':''}/></button>{open&&<div className="gate-detail"><div className="gate-meta"><span><ClipboardCheck size={15}/>{gate.evidence_count} evidência(s)</span><span><AlertTriangle size={15}/>{requiredPending} obrigatório(s) pendente(s)</span><span><Gauge size={15}/>{gate.technical_score||0}/100</span>{gate.released_at&&<span><CheckCircle2 size={15}/>liberada em {date(gate.released_at)}</span>}</div><div className="req-list">{gate.requirements.map(r=><div key={r.id} className={`req-row ${r.status}`}><span>{r.status==='concluido'?<CheckCircle2 size={17}/>:<AlertTriangle size={17}/>}</span><div><b>{r.title}</b><small>{human(r.category)} {r.required?'• obrigatório':'• apoio'}</small></div><em>{r.evidence_count} evid.</em></div>)}</div>{gate.payment&&<div className="gate-payment"><WalletCards size={18}/><div><small>LIBERAÇÃO FINANCEIRA</small><b>{human(gate.payment.recommendation)} • {money(gate.payment.validated_amount)}</b><p>{gate.payment.reason||'Sem justificativa registrada.'}</p></div></div>}</div>}</article>
}

function PaymentsView({b,reload}:{b:PassBundle;reload:()=>void}){
  async function decide(id:number,status:string){if(!confirm(status==='approved'?'Confirmar liberação deste pagamento?':'Confirmar que o pagamento não será liberado?'))return;await api(`/api/pass/projects/${b.project.id}/payments/${id}`,{method:'PATCH',body:JSON.stringify({status})});reload()}
  return <div className="pass-page"><PageHead tag="MEDIÇÃO + EVIDÊNCIA" title="Pagar pelo que foi validado." text="A medição deixa de ser apenas um percentual informado: ela fica conectada ao gate, às evidências e às pendências daquela etapa."/>
    <div className="payment-summary"><Metric icon={Landmark} label="Orçamento da obra" value={money(b.project.budget)} text="Referência cadastrada"/><Metric icon={WalletCards} label="Realizado" value={money(b.project.spent)} text={`${Number(b.project.budget)?Math.round(Number(b.project.spent)/Number(b.project.budget)*100):0}% do orçamento`}/><Metric icon={ClipboardCheck} label="Em análise" value={String(b.summary.paymentPending)} text="liberação(ões) pendente(s)"/></div>
    <div className="payment-list">{b.payments.map(p=><article className={`payment-card ${p.recommendation}`} key={p.id}><div className="payment-card-top"><div><small>{human(p.recommendation)}</small><h3>{p.description}</h3></div><Status value={p.status}/></div><div className="payment-values"><span><small>Solicitado</small><b>{money(p.claimed_amount)}</b></span><ArrowRight size={18}/><span><small>Validado</small><b>{money(p.validated_amount)}</b></span></div><p>{p.reason||'Sem justificativa registrada.'}</p><div className="payment-foot"><span>Criado em {date(p.created_at)}</span>{p.status==='pending'&&<div><button className="secondary" onClick={()=>decide(p.id,'rejected')}>Não liberar</button><button className="approve" onClick={()=>decide(p.id,'approved')}><CheckCircle2 size={15}/> Liberar pagamento</button></div>}</div></article>)}{!b.payments.length&&<Empty icon={WalletCards} title="Nenhuma medição cadastrada" text="Quando a equipe lançar uma medição vinculada a uma etapa, a recomendação aparecerá aqui."/>}</div>
  </div>
}

function PassportView({b}:{b:PassBundle}){
  const [q,setQ]=useState('');const rows=useMemo(()=>b.passport.filter(i=>(i.title+' '+i.zone+' '+i.system_type+' '+(i.description||'')).toLowerCase().includes(q.toLowerCase())),[q,b.passport])
  const publicUrl=`${window.location.origin}/public/pass/${b.project.id}`
  return <div className="pass-page"><PageHead tag="DNA DO IMÓVEL" title="O que ficará escondido também fica documentado." text="Tubulações, elétrica, impermeabilização, equipamentos, garantias e registros importantes permanecem consultáveis depois da entrega." right={<div className="passport-qr"><QRCodeSVG value={publicUrl} size={62} fgColor="#143c31"/><div><small>PASSAPORTE</small><b>acesso verificável</b></div></div>}/>
    <div className="passport-search"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar: banheiro, hidráulica, parede norte, impermeabilização…"/></div>
    <div className="passport-grid">{rows.map(i=><article className="passport-card" key={i.id}><div className="passport-card-icon">{passportIcon(i.system_type)}</div><div><small>{human(i.system_type)} • {i.zone||'zona não informada'}</small><h3>{i.title}</h3><p>{i.description||'Sem descrição adicional.'}</p><div className="passport-tags">{i.height_cm!=null&&<span>altura {i.height_cm} cm</span>}{i.depth_cm!=null&&<span>profundidade {i.depth_cm} cm</span>}{i.warranty_until&&<span>garantia até {date(i.warranty_until)}</span>}{i.supplier&&<span>{i.supplier}</span>}</div>{i.photo_url&&<a href={i.photo_url} target="_blank">Ver evidência visual <ArrowRight size={13}/></a>}</div></article>)}{!rows.length&&<Empty icon={Fingerprint} title="Nenhum item encontrado" text="O passaporte cresce durante a obra, principalmente antes de fechar paredes, pisos, shafts e revestimentos."/>}</div>
  </div>
}

function RiskView({b}:{b:PassBundle}){
  const r=b.riskRadar
  return <div className="pass-page"><PageHead tag="RADAR DA PRÓXIMA ETAPA" title={`Antes de iniciar: ${r.phase||'próxima etapa'}`} text="O radar antecipa verificações técnicas, documentais e de segurança com base na etapa seguinte e no que já está registrado na obra." right={<div className={`risk-level risk-${r.level}`}><small>ÍNDICE DE ATENÇÃO</small><b>{r.score}/100</b><span>{human(r.level)}</span></div>}/>
    <div className="risk-radar-grid">{r.items.map((i,idx)=><article className={`radar-card sev-${i.severity}`} key={idx}><div className="radar-top"><span>{riskIcon(i.severity)}</span><div><small>{i.source}</small><h3>{i.title}</h3></div><em>{human(i.severity)}</em></div><p>{i.why}</p><div className="radar-action"><CheckCircle2 size={16}/><span>{i.action}</span></div></article>)}{!r.items.length&&<Empty icon={ShieldCheck} title="Nenhum alerta relevante calculado" text="O radar depende das informações cadastradas e não substitui inspeção ou análise profissional."/>}</div>
    <div className="pass-principle warning"><div><AlertTriangle size={23}/><h3>Radar preventivo, não laudo.</h3></div><p>A aplicabilidade de normas, medidas de controle e liberações de serviço deve ser definida pelo responsável técnico e pelos profissionais de SST conforme as condições reais do canteiro.</p></div>
  </div>
}

function AIView({b}:{b:PassBundle}){
  const [msgs,setMsgs]=useState<{role:'user'|'assistant';text:string}[]>([{role:'assistant',text:`Eu sou a Obra IA. Posso consultar gates, pagamentos, passaporte técnico, riscos e histórico registrados em ${b.project.name}. Pergunte, por exemplo: “posso liberar o próximo pagamento?” ou “onde passa a tubulação do banheiro?”.`}]);const[text,setText]=useState('');const[busy,setBusy]=useState(false)
  async function ask(q=text){if(!q.trim()||busy)return;setMsgs(m=>[...m,{role:'user',text:q}]);setText('');setBusy(true);try{const r=await api(`/api/pass/projects/${b.project.id}/ai`,{method:'POST',body:JSON.stringify({question:q})});setMsgs(m=>[...m,{role:'assistant',text:r.answer}])}catch(e:any){setMsgs(m=>[...m,{role:'assistant',text:e.message}])}finally{setBusy(false)}}
  const sug=['Posso liberar o próximo pagamento?','O que falta para liberar a próxima etapa?','Há risco alto para a próxima atividade?','Onde passa a tubulação registrada?','Quais garantias estão cadastradas?']
  return <div className="pass-page ai-pass"><PageHead tag="OBRA IA" title="Uma IA que consulta o DNA da obra." text="Ela responde a partir dos registros do empreendimento. Quando não há evidência suficiente, deve dizer isso — em vez de inventar."/>
    <div className="ai-pass-shell"><aside><Sparkles size={22}/><h3>Contexto ativo</h3><p>{b.project.name}</p><ul><li>{b.gates.length} gates</li><li>{b.payments.length} medições</li><li>{b.passport.length} itens no passaporte</li><li>{b.riskRadar.items.length} alertas no radar</li></ul></aside><section><div className="ai-messages">{msgs.map((m,i)=><div className={`ai-msg ${m.role}`} key={i}>{m.role==='assistant'&&<span><Bot size={17}/></span>}<p>{m.text}</p></div>)}{busy&&<div className="ai-msg assistant"><span><Bot size={17}/></span><p>Analisando os registros da obra…</p></div>}</div><div className="ai-suggestions">{sug.map(s=><button key={s} onClick={()=>ask(s)}>{s}</button>)}</div><div className="ai-input"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')ask()}} placeholder="Pergunte para o histórico técnico…"/><button onClick={()=>ask()} disabled={busy}><Send size={18}/></button></div></section></div>
  </div>
}

function Management({b,reload}:{b:PassBundle;reload:()=>void}){
  const [tab,setTab]=useState<'gate'|'evidencia'|'pagamento'|'passaporte'>('gate');const[msg,setMsg]=useState('')
  async function submit(e:FormEvent<HTMLFormElement>,url:string,method='POST'){e.preventDefault();setMsg('');const body=Object.fromEntries(new FormData(e.currentTarget).entries());try{await api(url,{method,body:JSON.stringify(body)});setMsg('Salvo com sucesso.');(e.currentTarget as HTMLFormElement).reset();reload()}catch(err:any){setMsg(err.message)}}
  return <div className="pass-page"><PageHead tag="GESTÃO TÉCNICA" title="Alimente o que será verificável." text="A diferença do produto está na qualidade dos registros: evidência, validação e rastreabilidade por etapa."/><div className="mgmt-tabs">{[['gate','Gate'],['evidencia','Evidência'],['pagamento','Medição'],['passaporte','Passaporte']].map(([k,l])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k as any)}>{l}</button>)}</div><div className="mgmt-card">
    {tab==='gate'&&<form onSubmit={e=>submit(e,`/api/pass/projects/${b.project.id}/gates/${(e.currentTarget.elements.namedItem('gateId') as HTMLSelectElement)?.value}`,'PATCH')}><FormTitle title="Atualizar gate de etapa" text="Libere somente após a validação profissional dos requisitos e evidências."/><div className="fields"><label>Gate<select name="gateId" required>{b.gates.map(g=><option value={g.id} key={g.id}>{g.phase_name}</option>)}</select></label><label>Status<select name="status"><option value="pending_review">Em validação</option><option value="blocked">Bloqueada</option><option value="released">Liberada</option></select></label><label>Score técnico<input name="technicalScore" type="number" min="0" max="100"/></label><label className="wide">Observações<textarea name="notes" rows={4}/></label></div><Save msg={msg}/></form>}
    {tab==='evidencia'&&<form onSubmit={e=>submit(e,`/api/pass/projects/${b.project.id}/evidence`)}><FormTitle title="Registrar evidência" text="Foto, medição, documento, inspeção ou registro de execução vinculado a um gate."/><div className="fields"><label>Gate<select name="gateId">{b.gates.map(g=><option value={g.id} key={g.id}>{g.phase_name}</option>)}</select></label><label>Tipo<select name="evidenceType"><option value="photo">Foto</option><option value="measurement">Medição</option><option value="document">Documento</option><option value="inspection">Inspeção</option><option value="test">Ensaio</option></select></label><label className="wide">Título<input name="title" required/></label><label className="wide">Descrição<textarea name="description" rows={4}/></label><label className="wide">URL da evidência<input name="url" type="url" placeholder="https://..."/></label></div><Save msg={msg}/></form>}
    {tab==='pagamento'&&<form onSubmit={e=>submit(e,`/api/pass/projects/${b.project.id}/payments`)}><FormTitle title="Criar liberação financeira" text="Compare o valor solicitado com o valor tecnicamente validado e registre a recomendação."/><div className="fields"><label>Gate<select name="gateId">{b.gates.map(g=><option value={g.id} key={g.id}>{g.phase_name}</option>)}</select></label><label>Recomendação<select name="recommendation"><option value="release">Liberar</option><option value="partial">Liberar parcialmente</option><option value="hold">Não liberar</option></select></label><label>Valor solicitado<input name="claimedAmount" type="number" step="0.01"/></label><label>Valor validado<input name="validatedAmount" type="number" step="0.01"/></label><label className="wide">Descrição<input name="description" required placeholder="Ex.: 2ª medição da estrutura"/></label><label className="wide">Justificativa<textarea name="reason" rows={4}/></label></div><Save msg={msg}/></form>}
    {tab==='passaporte'&&<form onSubmit={e=>submit(e,`/api/pass/projects/${b.project.id}/passport`)}><FormTitle title="Adicionar item ao DNA do imóvel" text="Registre o que poderá ser útil quando estiver escondido ou anos depois da entrega."/><div className="fields"><label>Sistema<select name="systemType"><option value="hidraulica">Hidráulica</option><option value="eletrica">Elétrica</option><option value="impermeabilizacao">Impermeabilização</option><option value="estrutura">Estrutura</option><option value="gas">Gás</option><option value="equipamento">Equipamento</option><option value="garantia">Garantia</option></select></label><label>Zona / ambiente<input name="zone" placeholder="Ex.: Banheiro suíte"/></label><label className="wide">Título<input name="title" required/></label><label>Altura (cm)<input name="heightCm" type="number" step="0.1"/></label><label>Profundidade (cm)<input name="depthCm" type="number" step="0.1"/></label><label>Garantia até<input name="warrantyUntil" type="date"/></label><label>Fornecedor<input name="supplier"/></label><label className="wide">Descrição<textarea name="description" rows={4}/></label><label className="wide">URL da foto / evidência<input name="photoUrl" type="url"/></label></div><Save msg={msg}/></form>}
  </div></div>
}

function FormTitle({title,text}:{title:string;text:string}){return <div className="form-title"><h3>{title}</h3><p>{text}</p></div>}
function Save({msg}:{msg:string}){return <div className="save-row">{msg&&<span>{msg}</span>}<button><CheckCircle2 size={16}/> Salvar registro</button></div>}
function Metric({icon:I,label,value,text}:{icon:any;label:string;value:string;text:string}){return <article className="pass-metric"><I size={19}/><small>{label}</small><b>{value}</b><span>{text}</span></article>}
function Status({value}:{value:string}){return <span className={`pass-status ${value}`}>{human(value)}</span>}
function Empty({icon:I,title,text}:{icon:any;title:string;text:string}){return <div className="pass-empty"><I size={30}/><h3>{title}</h3><p>{text}</p></div>}
function gateLabel(s:string){return ({released:'Liberada',blocked:'Bloqueada',pending_review:'Em validação',draft:'Não iniciada'} as any)[s]||human(s)}
function passportIcon(t:string){if(t==='hidraulica')return <Landmark size={20}/>;if(t==='eletrica')return <Activity size={20}/>;if(t==='estrutura')return <Construction size={20}/>;return <Fingerprint size={20}/>}
function riskIcon(s:string){return s==='critica'?<XCircle size={18}/>:s==='alta'?<AlertTriangle size={18}/>:s==='media'?<TimerReset size={18}/>:<ShieldCheck size={18}/>}

function Empty({user,reload,logout}:{user:User;reload:()=>void;logout:()=>void}){
  const staff=['admin','team'].includes(user.role);const[open,setOpen]=useState(false);const[msg,setMsg]=useState('')
  async function create(e:FormEvent<HTMLFormElement>){e.preventDefault();const body=Object.fromEntries(new FormData(e.currentTarget).entries());try{await api('/api/projects',{method:'POST',body:JSON.stringify(body)});setMsg('Obra criada.');reload()}catch(err:any){setMsg(err.message)}}
  return <div className="pass-empty-page"><div className="pass-empty-top"><div className="pass-logo"><span>O</span><div><b>OBRA360</b><small>PASS</small></div></div><button onClick={logout}><LogOut size={16}/> Sair</button></div><div className="pass-empty-center"><ShieldCheck size={42}/><span className="kicker">PASSAPORTE DA OBRA</span><h1>{staff?'Cadastre a primeira obra real.':'Nenhuma obra vinculada ao seu acesso.'}</h1><p>{staff?'O sistema não cria dados fictícios. Ao cadastrar uma obra, ele gera os gates iniciais e os requisitos-base para a equipe revisar.':'Peça à equipe Obra360 para vincular seu acesso ao empreendimento.'}</p>{staff&&!open&&<button className="approve" onClick={()=>setOpen(true)}><Plus size={16}/> Criar obra</button>}{staff&&open&&<form className="new-project" onSubmit={create}><label>Nome<input name="name" required/></label><label>Município<input name="city"/></label><label>Orçamento<input name="budget" type="number"/></label><button className="approve">Criar e gerar gates</button>{msg&&<span>{msg}</span>}</form>}</div></div>
}
