import { AlertTriangle, BookOpen, CheckCircle2, ExternalLink } from 'lucide-react'
import { STAGE_GUIDES, WORK_KIND_LABELS, stageApplicability, workKind } from './stage-guides'

export default function StageGuide({stageKey,profile}:{stageKey:string;profile:any}){
  const guide=STAGE_GUIDES[stageKey]
  if(!guide)return <section className="v4-guide-card"><span>GUIA DA ETAPA</span><h3>Etapa personalizada</h3><p>Esta etapa foi criada especificamente para a obra. Defina a aplicabilidade, os passos e as referências com o responsável técnico antes de usá-la como roteiro.</p></section>
  const current=workKind(profile)
  const applicability=stageApplicability(stageKey,profile)
  const kinds=[...guide.appliesTo,...(guide.conditionalFor||[])].filter((v,i,a)=>a.indexOf(v)===i)
  return <div className="v4-stage-guide">
    <section className="v4-guide-card">
      <span>APLICABILIDADE</span><h3>Essa etapa entra em qual tipo de obra?</h3>
      <p>{guide.applicabilityNote}</p>
      <span className={`v4-applicability-badge ${applicability.status}`}><CheckCircle2 size={13}/> Para esta obra: {applicability.label}</span>
      <div className="v4-kind-chips">{kinds.map(k=><i key={k}>{WORK_KIND_LABELS[k]}{guide.conditionalFor?.includes(k)?' · depende do escopo':''}</i>)}</div>
      <p className="v4-guide-note"><AlertTriangle size={13}/> O Obra360 orienta o roteiro, mas não decide sozinho se uma exigência legal ou técnica é dispensável. Quando um item realmente não fizer parte do escopo, marque-o como “Não se aplica”.</p>
    </section>
    <section className="v4-guide-card">
      <span>PASSO A PASSO</span><h3>Como conduzir esta etapa</h3>
      <div className="v4-guide-steps">{guide.steps.map((step,i)=><div className="v4-guide-step" key={i}><p>{step}</p></div>)}</div>
    </section>
    <section className="v4-guide-card" style={{gridColumn:'1 / -1'}}>
      <span>FONTES & REFERÊNCIAS</span><h3>De onde vem esse roteiro</h3>
      <p>As referências abaixo ajudam a justificar o checklist. Para normas ABNT, sempre confirme a edição vigente e o escopo exato antes de aplicar.</p>
      <div className="v4-guide-sources">{guide.sources.map((s,i)=>s.url?<a className="v4-guide-source" key={i} href={s.url} target="_blank" rel="noreferrer"><b><BookOpen size={13}/> {s.label} <ExternalLink size={11}/></b><small>{s.detail}</small></a>:<div className="v4-guide-source" key={i}><b><BookOpen size={13}/> {s.label}</b><small>{s.detail}</small></div>)}</div>
      <p className="v4-guide-note">Perfil atual da obra: <b>{WORK_KIND_LABELS[current]}</b>. Regras municipais, Corpo de Bombeiros, concessionárias e atribuições profissionais podem acrescentar exigências.</p>
    </section>
  </div>
}
