import { STAGE_GUIDES, WORK_KIND_LABELS, stageApplicability, workKind } from './stage-guides'
import type { WorkKind } from './stage-guides'

const STAGE_KEYS=['terreno','arquitetura','legal','complementares','planejamento','mobilizacao','fundacoes','estrutura','envoltoria','instalacoes','impermeabilizacao','acabamentos','externas','conclusao','entrega']

const SOURCES={
  abnt:{label:'ABNT Catálogo',detail:'Consulte a norma citada e confirme a edição vigente e o escopo aplicável.',url:'https://www.abntcatalogo.com.br/'},
  art:{label:'CONFEA — ART',detail:'A ART define o responsável técnico por obras e serviços de Engenharia.',url:'https://www.confea.org.br/servicos-prestados/anotacao-de-responsabilidade-tecnica-art'},
  rrt:{label:'CAU/BR — RRT',detail:'O RRT identifica a responsabilidade técnica em atividades de Arquitetura e Urbanismo.',url:'https://transparencia.caubr.gov.br/perguntas-frequentes-registro-de-responsabilidade-tecnica-rrt/'},
  nr18:{label:'MTE — NR-18',detail:'Segurança e saúde no trabalho na indústria da construção.',url:'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-18-nr-18'},
  nr35:{label:'MTE — NR-35',detail:'Requisitos para trabalho em altura quando aplicáveis.',url:'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-35-nr-35'},
  nrs:{label:'MTE — Normas Regulamentadoras',detail:'Índice oficial das NRs vigentes, incluindo NR-1, NR-6, NR-7, NR-10, NR-18 e NR-35.',url:'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes'},
  cno:{label:'Receita Federal — CNO',detail:'Orientações oficiais do Cadastro Nacional de Obras.',url:'https://www.gov.br/receitafederal/pt-br/assuntos/construcao-civil/cno'},
  scpo:{label:'Governo Federal — SCPO',detail:'Comunicação Prévia de Obras prevista na NR-18.',url:'https://www.gov.br/pt-br/servicos/realizar-a-comunicacao-previa-de-obras'}
}

type Src={label:string;detail:string;url:string}
let modal:HTMLElement|null=null
let cachedProfile:{projectId:string;profile:any}|null=null

function projectId(){return (document.querySelector('.v4-project-select select') as HTMLSelectElement|null)?.value||''}
async function getProfile(){
  const id=projectId(); if(!id)return null
  if(cachedProfile?.projectId===id)return cachedProfile.profile
  try{const r=await fetch(`/api/os/projects/${id}`,{credentials:'include'});const d=await r.json();cachedProfile={projectId:id,profile:d.profile||null};return cachedProfile.profile}catch{return null}
}
function stageByNumber(text=''){const m=text.match(/\d+/);return m?STAGE_KEYS[Number(m[0])]||null:null}
function inferStage(main:Element,title:string){
  const hero=document.querySelector('.v4-stage-detail-hero span')?.textContent||''
  const fromHero=stageByNumber(hero); if(fromHero)return fromHero
  const section=main.closest('section')
  const stageNumber=section?.querySelector(':scope > header > span')?.textContent||''
  const fromSection=stageByNumber(stageNumber); if(fromSection)return fromSection
  const t=title.toLowerCase()
  if(/briefing|referên|implantação|estudo preliminar|anteprojeto|interior|material visual/.test(t))return 'arquitetura'
  if(/projeto legal|prefeitura|alvará|licen|protocolo|rrt|art do projeto/.test(t))return 'legal'
  if(/estrutural|fundação|hidrossanit|elétric|gás|elevador|solar|compatibil|executivo/.test(t))return 'complementares'
  if(/orçamento|cronograma|fluxo de caixa|compras|contrat|responsáveis/.test(t))return 'planejamento'
  if(/cno|pgr|canteiro|comunicação prévia|epi|epc|integração|aso|pcmso|trabalho em altura|tapume/.test(t))return 'mobilizacao'
  if(/locação|escava|sapata|bloco|estaca|fundaç/.test(t))return 'fundacoes'
  if(/forma|armadura|concret|estrutura|laje|pilar|viga|escoramento/.test(t))return 'estrutura'
  if(/vedação|alvenaria|cobertura|esquadria|fachada/.test(t))return 'envoltoria'
  if(/hidrául|esgoto|elétric|tubula|circuito|quadro|instalaç/.test(t))return 'instalacoes'
  if(/impermeabil|estanque|revestimento/.test(t))return 'impermeabilizacao'
  if(/acabamento|piso|pintura|louça|metal|marcenaria|equipamento/.test(t))return 'acabamentos'
  if(/paisag|calçada|muro|drenagem externa|área externa/.test(t))return 'externas'
  if(/habite|vistoria|regulariza|averba|sero/.test(t))return 'conclusao'
  if(/entrega|garantia|manual|as built|memória/.test(t))return 'entrega'
  return 'arquitetura'
}
function itemSpecificSteps(title:string,discipline:string,stageKey:string){
  const t=title.toLowerCase(),d=discipline.toLowerCase()
  if(/topogr/.test(t))return ['Confirmar limites, referências e datum necessários ao levantamento.','Executar o levantamento com profissional habilitado e equipamentos compatíveis com a precisão requerida.','Registrar cotas, níveis, confrontações e pontos relevantes para implantação e drenagem.','Entregar arquivo/planta identificando método, referências e responsabilidade técnica quando aplicável.','Usar a versão validada como base para arquitetura, locação e terraplenagem.']
  if(/sondag/.test(t))return ['Definir, com o responsável técnico, se o porte e as condições do terreno exigem investigação geotécnica.','Planejar quantidade e posição dos pontos de investigação.','Executar e registrar resultados por empresa/profissional competente.','Interpretar os dados antes de definir a solução de fundações.','Arquivar relatório e vincular a versão usada pelo projeto estrutural/fundações.']
  if(/projeto estrutural|forma|armadura|concret|laje|pilar|viga|fundação/.test(t))return ['Confirmar a versão de projeto liberada para execução.','Conferir dimensões, níveis, armaduras, cobrimentos, inserts, esperas e interferências aplicáveis.','Registrar a inspeção antes de concretar ou ocultar o serviço.','Tratar divergências com o responsável técnico; não improvisar alteração estrutural em campo.','Registrar execução/concretagem e liberar a etapa seguinte somente após os controles previstos.']
  if(/briefing|estudo preliminar|anteprojeto|implantação/.test(t))return ['Confirmar programa de necessidades, terreno, restrições legais e orçamento de referência.','Desenvolver a solução compatível com fluxos, conforto, implantação e requisitos do cliente.','Apresentar alternativas e registrar decisões que alterem custo, prazo ou escopo.','Compatibilizar decisões arquitetônicas com estrutura e instalações antes de detalhar.','Registrar a versão aprovada e evitar que a obra execute desenho superado.']
  if(/projeto legal|alvará|prefeitura|protocolo|licen/.test(t))return ['Conferir a legislação e o procedimento do município da obra para o tipo de intervenção.','Preparar desenhos, documentos do imóvel/proprietário e responsabilidades técnicas exigidas.','Protocolar pelo canal oficial e guardar número, data e versão enviada.','Controlar exigências e revisões sem misturar versões.','Confirmar a autorização aplicável antes de iniciar atividade que dependa dela.']
  if(/pgr/.test(t))return ['Identificar perigos e riscos reais das atividades previstas para o canteiro.','Definir medidas de prevenção, responsáveis e documentos/projetos exigidos pela NR-18 e demais NRs aplicáveis.','Integrar contratadas e mudanças de fase ao gerenciamento de riscos.','Manter o programa disponível e atualizado conforme a obra muda.','Registrar inspeções, desvios e correções; o documento não substitui o controle no campo.']
  if(/trabalho em altura|queda|telhado|cobertura/.test(t)&&d.includes('seguran'))return ['Identificar onde existe risco de queda e eliminar exposição sempre que possível.','Definir acesso, proteção coletiva, sistema de ancoragem e procedimento compatíveis com a atividade.','Verificar capacitação, aptidão, inspeções e equipamentos aplicáveis.','Inspecionar a frente antes do início e após mudanças de condição.','Interromper a atividade quando as condições previstas não estiverem presentes.']
  if(/elétric/.test(t)&&d.includes('seguran'))return ['Definir instalação temporária e proteções compatíveis com o canteiro.','Usar quadros, dispositivos, aterramento, cabos e conexões adequados ao ambiente e à carga.','Restringir intervenções a trabalhadores autorizados/qualificados conforme aplicável.','Inspecionar danos, improvisos, umidade e proteção mecânica periodicamente.','Registrar correções antes de manter o circuito em uso.']
  if(/epi|epc/.test(t))return ['Priorizar medidas coletivas e de engenharia antes de depender apenas de EPI.','Relacionar controles por atividade e risco.','Definir especificação, entrega, inspeção, substituição e responsáveis.','Orientar os trabalhadores sobre uso e limitações.','Revisar a matriz quando a etapa, equipe ou método executivo mudar.']
  if(/fotograf|registrar/.test(t))return ['Definir o que precisa ser comprovado antes de o serviço ficar oculto.','Registrar visão geral e detalhes com referência de ambiente/elemento.','Relacionar a evidência ao item correto do checklist e à data da execução.','Registrar desvios ou observações técnicas relevantes.','Manter o histórico acessível para inspeção, as built, manutenção e entrega.']
  if(/orçamento|cronograma|compras|planejar/.test(t))return ['Confirmar escopo e premissas de projeto disponíveis.','Levantar quantidades, recursos, produtividade e restrições que influenciam o item.','Definir dependências, responsáveis e prazo necessário antes da execução.','Validar impacto em custo, prazo e suprimentos.','Atualizar o planejamento quando houver mudança real de escopo ou condição de obra.']
  const stage=STAGE_GUIDES[stageKey]
  return stage?.steps?.slice(0,6)||['Confirmar o escopo e o critério de aceitação deste item.','Checar os documentos, projetos e condições prévias necessárias.','Executar ou verificar o serviço com profissional competente.','Registrar evidências e eventuais não conformidades.','Corrigir desvios antes de considerar o item concluído.']
}
function taskSources(title:string,discipline:string,stageKey:string){
  const t=title.toLowerCase(),d=discipline.toLowerCase();const list:Src[]=[]
  const add=(s:Src)=>{if(!list.some(x=>x.label===s.label))list.push(s)}
  ;(STAGE_GUIDES[stageKey]?.sources||[]).forEach(add)
  if(d.includes('engenharia')||d.includes('controle')||/estrutura|fundação|topogr|sondag|concret/.test(t))add(SOURCES.art)
  if(d.includes('arquitet')||/estudo preliminar|anteprojeto|projeto legal|executivo|implantação/.test(t)){add(SOURCES.rrt);add({label:'ABNT NBR 16636',detail:'Desenvolvimento de serviços técnicos de projeto arquitetônico e urbanístico — conferir edição vigente.',url:SOURCES.abnt.url});add({label:'ABNT NBR 6492',detail:'Documentação técnica de projetos arquitetônicos e urbanísticos — conferir edição vigente.',url:SOURCES.abnt.url})}
  if(/topogr/.test(t))add({label:'ABNT NBR 13133',detail:'Levantamentos topográficos — conferir edição vigente.',url:SOURCES.abnt.url})
  if(/sondag/.test(t))add({label:'ABNT NBR 6484',detail:'Sondagens de simples reconhecimento com SPT — conferir edição vigente.',url:SOURCES.abnt.url})
  if(/fundação|sapata|estaca|bloco/.test(t))add({label:'ABNT NBR 6122',detail:'Projeto e execução de fundações — conferir edição vigente.',url:SOURCES.abnt.url})
  if(/estrutura|forma|armadura|concret|laje|pilar|viga/.test(t)){add({label:'ABNT NBR 6118',detail:'Projeto de estruturas de concreto — conferir edição vigente.',url:SOURCES.abnt.url});add({label:'ABNT NBR 14931',detail:'Execução de estruturas de concreto — conferir edição vigente.',url:SOURCES.abnt.url})}
  if(/hidrául|água fria|água quente/.test(t))add({label:'ABNT NBR 5626',detail:'Sistemas prediais de água fria e água quente — conferir edição vigente.',url:SOURCES.abnt.url})
  if(/esgoto|sanitár/.test(t))add({label:'ABNT NBR 8160',detail:'Sistemas prediais de esgoto sanitário — conferir edição vigente.',url:SOURCES.abnt.url})
  if(/elétric|circuito|quadro/.test(t)){add({label:'ABNT NBR 5410',detail:'Instalações elétricas de baixa tensão — conferir edição vigente.',url:SOURCES.abnt.url});if(d.includes('seguran'))add(SOURCES.nrs)}
  if(/impermeabil/.test(t)){add({label:'ABNT NBR 9575',detail:'Impermeabilização — seleção e projeto — conferir edição vigente.',url:SOURCES.abnt.url});add({label:'ABNT NBR 9574',detail:'Execução de impermeabilização — conferir edição vigente.',url:SOURCES.abnt.url})}
  if(/reforma/.test(t))add({label:'ABNT NBR 16280',detail:'Reforma em edificações — sistema de gestão de reformas — conferir edição vigente.',url:SOURCES.abnt.url})
  if(d.includes('seguran')){add(SOURCES.nr18);add(SOURCES.nrs);if(/altura|queda|telhado|cobertura/.test(t))add(SOURCES.nr35);if(/comunicação prévia/.test(t))add(SOURCES.scpo)}
  if(/cno/.test(t))add(SOURCES.cno)
  if(/orçamento/.test(t))add({label:'ABNT NBR 12721',detail:'Avaliação de custos unitários e preparo de orçamento de construção — conferir edição vigente.',url:SOURCES.abnt.url})
  return list.slice(0,8)
}
function make<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',text=''){const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e}
function closeModal(){modal?.remove();modal=null;document.documentElement.classList.remove('v4-guide-modal-open')}
function mascotSrc(){
  const current=(document.querySelector('.v4-matinho-brand img') as HTMLImageElement|null)?.src
  const fav=(document.querySelector('link[data-matinho-favicon]') as HTMLLinkElement|null)?.href
  if(current||fav)return current||fav||''
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="53" r="31" fill="#8BC34A" stroke="#0e3b2d" stroke-width="5"/><path d="M18 44c4-22 17-33 31-33 15 0 28 11 30 33" fill="#ff9d24" stroke="#0e3b2d" stroke-width="5"/><path d="M47 26c7-12 16-11 22-11-3 8-8 15-22 18z" fill="#2f8b3f"/><circle cx="37" cy="53" r="5" fill="#0e3b2d"/><circle cx="59" cy="53" r="5" fill="#0e3b2d"/><path d="M35 66c8 7 18 7 26 0" fill="none" stroke="#0e3b2d" stroke-width="4" stroke-linecap="round"/></svg>')}`
}
function addSource(parent:HTMLElement,s:Src){const e=s.url?document.createElement('a'):document.createElement('div');e.className='v4-task-guide-source';if(s.url){(e as HTMLAnchorElement).href=s.url;(e as HTMLAnchorElement).target='_blank';(e as HTMLAnchorElement).rel='noreferrer'}e.append(make('b','',s.label));e.append(make('small','',s.detail));parent.append(e)}
async function openGuide(main:Element){
  const title=main.querySelector('h4')?.textContent?.trim()||'Item do checklist'
  const discipline=main.querySelector('.v4-badge')?.textContent?.trim()||'Roteiro técnico'
  const stageKey=inferStage(main,title);const guide=STAGE_GUIDES[stageKey]
  const profile=await getProfile();const current=profile?workKind(profile):null;const applicability=profile?stageApplicability(stageKey,profile):null
  closeModal();modal=make('div','v4-task-guide-overlay');const dialog=make('div','v4-task-guide-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true')
  const head=make('div','v4-task-guide-head'),id=make('div','v4-task-guide-identity'),img=document.createElement('img');img.src=mascotSrc();img.alt='Matinho';id.append(img);const txt=make('div');txt.append(make('span','','MATINHO · GUIA TÉCNICO DO CHECKLIST'));txt.append(make('h2','',title));id.append(txt);head.append(id);const x=make('button','v4-task-guide-close','×');x.onclick=closeModal;head.append(x);dialog.append(head)
  const app=make('section','v4-task-guide-section');app.append(make('span','','APLICABILIDADE'));app.append(make('h3','','Quando este item faz sentido?'));app.append(make('p','',guide?.applicabilityNote||'A aplicabilidade depende do tipo de obra, do escopo contratado, dos sistemas existentes e da avaliação do profissional responsável.'))
  const chips=make('div','v4-task-guide-kinds');const kinds:WorkKind[]=guide?[...guide.appliesTo,...(guide.conditionalFor||[])]:['casa_nova','predio_residencial','comercial_novo','reforma','ampliacao'];[...new Set(kinds)].forEach(k=>{const c=make('i',guide?.conditionalFor?.includes(k)?'conditional':'applies',`${WORK_KIND_LABELS[k]}${guide?.conditionalFor?.includes(k)?' · depende do escopo':''}`);chips.append(c)});app.append(chips);if(current){const cur=make('div',`v4-task-guide-current ${applicability?.status||''}`,`Obra atual: ${WORK_KIND_LABELS[current]} · ${applicability?.label||'revisar aplicabilidade'}`);app.append(cur)}dialog.append(app)
  const why=make('section','v4-task-guide-section');why.append(make('span','','O QUE ESTE ITEM CONTROLA'));why.append(make('h3','',discipline));why.append(make('p','',`Este checklist não é apenas uma tarefa administrativa. Ele existe para controlar uma decisão, verificação, evidência ou liberação técnica da etapa ${guide?`“${stageKey.replaceAll('_',' ')}”`:'da obra'}. Quando o item estiver fora do escopo real, use “Não se aplica”; quando envolver responsabilidade técnica, a decisão final continua com o profissional habilitado.`));dialog.append(why)
  const steps=make('section','v4-task-guide-section v4-task-guide-wide');steps.append(make('span','','PASSO A PASSO DESTE ITEM'));steps.append(make('h3','','Como tratar no campo e no sistema'));const ol=document.createElement('ol');itemSpecificSteps(title,discipline,stageKey).forEach(s=>ol.append(make('li','',s)));steps.append(ol);dialog.append(steps)
  const src=make('section','v4-task-guide-section v4-task-guide-wide');src.append(make('span','','FONTES TÉCNICAS'));src.append(make('h3','','Referências usadas pelo roteiro'));src.append(make('p','','As fontes abaixo são referências oficiais ou normas técnicas reconhecidas. Confirme sempre a edição vigente da ABNT, a legislação municipal e as atribuições do profissional responsável antes de aplicar ao caso concreto.'));const grid=make('div','v4-task-guide-sources');taskSources(title,discipline,stageKey).forEach(s=>addSource(grid,s));src.append(grid);dialog.append(src)
  const foot=make('div','v4-task-guide-footer');foot.append(make('p','','O Matinho orienta o fluxo e explica o checklist. Ele não substitui projeto, inspeção, ART/RRT, responsável técnico ou exigência do órgão competente.'));const close=make('button','','Fechar');close.onclick=closeModal;foot.append(close);dialog.append(foot)
  modal.append(dialog);modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});document.body.append(modal);document.documentElement.classList.add('v4-guide-modal-open')
}
function fixBrand(){
  const src=mascotSrc();document.querySelectorAll('.v4-brand').forEach(brand=>{let img=brand.querySelector(':scope > img.v4-matinho-visible-logo') as HTMLImageElement|null;if(!img){img=document.createElement('img');img.className='v4-matinho-visible-logo';img.alt='Matinho';brand.insertBefore(img,brand.firstChild)}img.src=src;const b=brand.querySelector('b');const s=brand.querySelector('small');if(b)b.textContent='TECNOMATA';if(s)s.textContent='ENGENHARIA'})
  const state=document.querySelector('.v4-copilot-state');if(state&&!state.querySelector('img')){const im=document.createElement('img');im.src=src;im.alt='Matinho';state.prepend(im)}
}
window.addEventListener('click',event=>{const target=event.target as Element|null;const main=target?.closest?.('.v4-task-main');if(!main)return;event.preventDefault();event.stopPropagation();void openGuide(main)},true)
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()})
function tick(){fixBrand()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{tick();setInterval(tick,1200)},{once:true});else{tick();setInterval(tick,1200)}
