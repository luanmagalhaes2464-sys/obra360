type BundleStage={key:string;title:string;progress:number;done:number;applicable:number}
type Bundle={profile:any;stages:BundleStage[]}
type Plan={crew:[number,number];days:[number,number];hard:string[];soft?:string[];successors:string[];note:string}

const KEYS=['terreno','arquitetura','legal','complementares','planejamento','mobilizacao','fundacoes','estrutura','envoltoria','instalacoes','impermeabilizacao','acabamentos','externas','conclusao','entrega']
const LABELS:Record<string,string>={
 terreno:'Terreno & viabilidade',arquitetura:'Arquitetura',legal:'Projeto legal & Prefeitura',complementares:'Projetos complementares',planejamento:'Planejamento',mobilizacao:'Mobilização & SST',fundacoes:'Fundações',estrutura:'Estrutura',envoltoria:'Vedações / cobertura',instalacoes:'Instalações',impermeabilizacao:'Impermeabilização',acabamentos:'Acabamentos',externas:'Áreas externas',conclusao:'Vistoria & regularização',entrega:'Entrega'
}

// Faixas operacionais de referência para planejamento inicial. Não são exigências normativas.
// A duração real depende de área, sistema construtivo, produtividade, clima, suprimentos e equipe.
const PLANS:Record<string,Plan>={
 terreno:{crew:[1,3],days:[2,10],hard:[],successors:['arquitetura'],note:'Levantamentos e restrições devem estar suficientemente conhecidos antes das decisões de implantação.'},
 arquitetura:{crew:[1,4],days:[15,45],hard:['terreno'],successors:['legal','complementares'],note:'O projeto precisa amadurecer antes de protocolar ou detalhar disciplinas que dependem da geometria arquitetônica.'},
 legal:{crew:[1,3],days:[3,15],hard:['arquitetura'],soft:['complementares'],successors:['mobilizacao'],note:'O prazo indicado é de preparação interna. A análise da Prefeitura tem prazo externo e pode variar bastante.'},
 complementares:{crew:[2,6],days:[10,35],hard:['arquitetura'],soft:['legal'],successors:['planejamento','fundacoes'],note:'Estrutura e instalações devem ser compatibilizadas antes da execução dos serviços que dependem delas.'},
 planejamento:{crew:[1,3],days:[5,15],hard:['arquitetura'],soft:['complementares','legal'],successors:['mobilizacao'],note:'Orçamento, cronograma, compras e responsabilidades podem evoluir em paralelo ao fechamento dos projetos, mas precisam estar definidos antes das frentes críticas.'},
 mobilizacao:{crew:[3,8],days:[3,10],hard:['legal','planejamento'],soft:['complementares'],successors:['fundacoes'],note:'Canteiro, acessos, controles de SST e liberações aplicáveis devem estar preparados antes da execução pesada.'},
 fundacoes:{crew:[4,10],days:[5,20],hard:['complementares','mobilizacao'],successors:['estrutura'],note:'Fundação depende de locação, solução de fundações, informações do solo quando necessárias e condições seguras de execução.'},
 estrutura:{crew:[5,12],days:[15,60],hard:['fundacoes'],successors:['envoltoria','instalacoes'],note:'A estrutura avança por ciclos e libera pavimentos/frentes subsequentes de forma progressiva.'},
 envoltoria:{crew:[4,10],days:[10,40],hard:['estrutura'],soft:['instalacoes'],successors:['impermeabilizacao','acabamentos'],note:'Vedações, cobertura e esquadrias precisam respeitar interfaces com estrutura e instalações.'},
 instalacoes:{crew:[3,8],days:[10,35],hard:['estrutura'],soft:['envoltoria'],successors:['impermeabilizacao','acabamentos'],note:'Instalações podem sobrepor vedações por frentes, mas devem ser testadas e registradas antes do fechamento.'},
 impermeabilizacao:{crew:[2,5],days:[5,20],hard:['estrutura'],soft:['instalacoes','envoltoria'],successors:['acabamentos'],note:'Áreas e interfaces precisam estar preparadas; testes e cura devem ocorrer antes do revestimento definitivo.'},
 acabamentos:{crew:[5,15],days:[20,60],hard:['envoltoria'],soft:['instalacoes','impermeabilizacao'],successors:['externas','conclusao'],note:'Acabamentos devem entrar apenas nas frentes tecnicamente liberadas para evitar retrabalho e perda de materiais.'},
 externas:{crew:[3,8],days:[7,25],hard:['estrutura'],soft:['acabamentos'],successors:['conclusao'],note:'Áreas externas podem avançar em paralelo ao final interno, desde que acessos, drenagem e logística da obra permitam.'},
 conclusao:{crew:[2,5],days:[5,20],hard:['acabamentos'],soft:['externas'],successors:['entrega'],note:'Vistoria, correções, documentação e regularização dependem da obra estar tecnicamente concluída nas frentes aplicáveis.'},
 entrega:{crew:[1,4],days:[2,7],hard:['conclusao'],successors:[],note:'Entrega reúne aceite, garantias, as built, manuais, registros e memória técnica do imóvel.'},
}

let cache:{projectId:string;data:Bundle;at:number}|null=null
let rendering=false

function projectId(){return (document.querySelector('.v4-project-select select') as HTMLSelectElement|null)?.value||''}
async function getBundle(force=false){
 const id=projectId(); if(!id)return null
 if(!force&&cache?.projectId===id&&Date.now()-cache.at<30000)return cache.data
 const r=await fetch(`/api/os/projects/${id}`,{credentials:'include'});if(!r.ok)return null
 const data=await r.json();cache={projectId:id,data,at:Date.now()};return data as Bundle
}
function stageKeyFromHero(){
 const text=document.querySelector('.v4-stage-detail-hero>div>span')?.textContent||''
 const m=text.match(/(\d+)/);if(!m)return null
 return KEYS[Number(m[1])]||null
}
function stageProgress(data:Bundle,key:string){return Number(data.stages.find(s=>s.key===key)?.progress||0)}
function scale(profile:any){
 const area=Number(profile?.area||0);let factor=1
 if(area>=500)factor=1.7;else if(area>=300)factor=1.45;else if(area>=180)factor=1.2
 if(profile?.kind==='predio_residencial')factor=Math.max(factor,1.6)
 return factor
}
function range(r:[number,number],factor:number,mode:'crew'|'days'){
 const adjust=mode==='crew'?Math.sqrt(factor):factor
 const a=Math.max(1,Math.round(r[0]*adjust)),b=Math.max(a,Math.round(r[1]*adjust))
 return `${a}–${b}`
}
function chip(text:string,kind:string){const s=document.createElement('span');s.className=`v4-seq-chip ${kind}`;s.textContent=text;return s}
function card(label:string,value:string,sub:string){const d=document.createElement('div');d.className='v4-seq-stat';d.innerHTML=`<small>${label}</small><b>${value}</b><span>${sub}</span>`;return d}

async function renderDetail(){
 const hero=document.querySelector('.v4-stage-detail-hero');if(!hero)return
 const key=stageKeyFromHero();if(!key||!PLANS[key])return
 const existing=document.querySelector('.v4-stage-sequence') as HTMLElement|null
 if(existing?.dataset.stage===key)return
 const data=await getBundle();if(!data)return
 existing?.remove()
 const plan=PLANS[key],factor=scale(data.profile),hardPending=plan.hard.filter(k=>stageProgress(data,k)<100),softPending=(plan.soft||[]).filter(k=>stageProgress(data,k)<100)
 const state=hardPending.length?'Aguardando pré-requisito':softPending.length?'Liberada com interfaces':'Liberada para avançar'
 const sec=document.createElement('section');sec.className=`v4-stage-sequence ${hardPending.length?'locked':softPending.length?'attention':'released'}`;sec.dataset.stage=key
 const head=document.createElement('div');head.className='v4-seq-head';head.innerHTML=`<div><span>PLANEJAMENTO TÉCNICO DA ETAPA</span><h3>Sequência, equipe e duração</h3></div><strong>${state}</strong>`;sec.append(head)
 const stats=document.createElement('div');stats.className='v4-seq-stats'
 stats.append(card('EQUIPE-BASE',`${range(plan.crew,factor,'crew')} pessoas`,'estimativa inicial'))
 stats.append(card('DURAÇÃO-BASE',`${range(plan.days,factor,'days')} dias`,'estimativa inicial'))
 stats.append(card('STATUS',hardPending.length?'Bloqueada':softPending.length?'Com interfaces':'Liberada',hardPending.length?'há predecessora crítica pendente':softPending.length?'pode sobrepor com controle':'sem bloqueio crítico'))
 sec.append(stats)
 const flow=document.createElement('div');flow.className='v4-seq-flow'
 const before=document.createElement('div');before.innerHTML='<small>ANTES</small>'
 if(plan.hard.length||plan.soft?.length){plan.hard.forEach(k=>before.append(chip(`${LABELS[k]}${stageProgress(data,k)>=100?' ✓':''}`,'hard')));(plan.soft||[]).forEach(k=>before.append(chip(`${LABELS[k]}${stageProgress(data,k)>=100?' ✓':''}`,'soft')))}else before.append(chip('Início do roteiro','neutral'))
 const now=document.createElement('div');now.innerHTML=`<small>AGORA</small>`;now.append(chip(LABELS[key],'current'))
 const after=document.createElement('div');after.innerHTML='<small>DEPOIS</small>';if(plan.successors.length)plan.successors.forEach(k=>after.append(chip(LABELS[k],'next')));else after.append(chip('Encerramento','neutral'))
 flow.append(before,now,after);sec.append(flow)
 const note=document.createElement('p');note.className='v4-seq-note';note.textContent=plan.note;sec.append(note)
 const caveat=document.createElement('p');caveat.className='v4-seq-caveat';caveat.textContent='Equipe e duração são referências de planejamento, não exigências de norma. A sequência pode ter sobreposições tecnicamente controladas. O responsável técnico deve validar liberações, produtividade, método executivo e condições reais da obra.';sec.append(caveat)
 hero.insertAdjacentElement('afterend',sec)
}

async function renderGrid(){
 const grid=document.querySelector('.v4-stage-grid-large');if(!grid)return
 const data=await getBundle();if(!data)return
 if(!document.querySelector('.v4-sequence-summary')){
  const s=document.createElement('section');s.className='v4-sequence-summary';s.innerHTML='<div><span>SEQUENCIAMENTO TÉCNICO</span><h3>A obra não é uma lista solta de tarefas.</h3><p>As etapas seguem predecessoras críticas e interfaces. Algumas frentes podem se sobrepor, mas somente quando a etapa anterior já liberou tecnicamente aquela frente.</p></div><b>Abra uma etapa para ver equipe, duração e dependências.</b>';grid.parentElement?.insertBefore(s,grid)
 }
 const tiles=Array.from(grid.querySelectorAll('.v4-stage-tile')) as HTMLElement[]
 tiles.forEach((tile,i)=>{
  tile.querySelector('.v4-stage-gate-badge')?.remove();const key=KEYS[i],plan=PLANS[key];if(!plan)return
  const hardPending=plan.hard.filter(k=>stageProgress(data,k)<100),stage= data.stages.find(s=>s.key===key)
  const badge=document.createElement('span');badge.className='v4-stage-gate-badge '
  if(Number(stage?.progress||0)>=100){badge.classList.add('done');badge.textContent='✓ concluída'}
  else if(hardPending.length){badge.classList.add('locked');badge.textContent='aguarda predecessora'}
  else{badge.classList.add('released');badge.textContent='liberada'}
  tile.append(badge)
 })
}

async function render(){if(rendering)return;rendering=true;try{await renderDetail();await renderGrid()}finally{rendering=false}}
window.addEventListener('obra360:refresh',()=>{cache=null;setTimeout(render,300)})
document.addEventListener('click',()=>setTimeout(render,250),true)
setInterval(render,1800)
setTimeout(render,500)
