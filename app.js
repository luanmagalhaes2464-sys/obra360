const visualStyles = document.createElement('style');
visualStyles.textContent = `
.hero{background:#173f32 url("https://commons.wikimedia.org/wiki/Special:FilePath/Balaustrada_Vi%C3%A7osa_MG.jpg") center/cover no-repeat!important}
.hero:after{background:linear-gradient(90deg,rgba(10,26,21,.90) 0%,rgba(16,45,36,.78) 46%,rgba(16,45,36,.72) 100%),linear-gradient(180deg,rgba(8,18,16,.28),rgba(8,18,16,.38)),radial-gradient(circle at 80% 35%,rgba(76,113,93,.28) 0%,transparent 38%)!important}
.hero-caption{margin-top:18px;font-size:11px;color:#b8c8c1}
.visual-showcase{padding-top:12px}
.showcase-header{max-width:760px;margin-bottom:26px}
.showcase-header h2{font:800 clamp(32px,4vw,52px) Manrope;letter-spacing:-.045em;line-height:1.08;margin:14px 0 12px}
.showcase-header p{font-size:17px;line-height:1.7;color:#65706b}
.showcase-grid{display:grid;grid-template-columns:1.2fr .8fr .8fr;gap:16px;align-items:stretch}
.showcase-card{position:relative;overflow:hidden;border-radius:24px;min-height:290px;background:#fff;border:1px solid #e6ebe7;box-shadow:0 20px 60px rgba(23,63,50,.08)}
.showcase-card img{width:100%;height:100%;object-fit:cover;display:block}
.showcase-main{min-height:420px}
.showcase-overlay{position:absolute;left:0;right:0;bottom:0;padding:28px;background:linear-gradient(180deg,rgba(9,18,15,0) 0%,rgba(9,18,15,.84) 100%);color:#fff}
.showcase-overlay span,.showcase-copy span{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#f4a27f}
.showcase-overlay h3{font:800 30px Manrope;letter-spacing:-.04em;line-height:1.05;margin:10px 0 10px}
.showcase-overlay p{font-size:14px;max-width:460px;color:#e1ebe6;line-height:1.55}
.showcase-copy{padding:18px 18px 20px}
.showcase-copy h3{font:700 22px Manrope;letter-spacing:-.03em;margin:10px 0 10px}
.showcase-copy p{font-size:14px;line-height:1.65;color:#66716c}
.image-credits{margin-top:22px;padding:18px 20px;background:#fff;border:1px solid #e3e8e5;border-radius:16px}
.image-credits strong{display:block;font-size:14px;margin-bottom:8px}
.image-credits p{margin:0;font-size:12px;line-height:1.6;color:#67716c}
@media(max-width:960px){.showcase-grid{grid-template-columns:1fr 1fr}.showcase-main{grid-column:1/-1}}
@media(max-width:640px){.showcase-grid{grid-template-columns:1fr}.showcase-main{min-height:330px}.showcase-overlay h3{font-size:24px}}
`;
document.head.appendChild(visualStyles);

const money = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(v);
const number = v => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(v);

const CUB = {
  casa: { baixo: 2562.62, normal: 3102.16, alto: 3852.38 }, // R1 - MG - ago/2026
  predio: { baixo: 2285.68, normal: 2554.58, alto: 3120.21 }, // R8 - MG - ago/2026
  comercial: { baixo: 2490.95, normal: 2954.74, alto: 3213.83 } // referência comercial adaptada
};

const tipoLabel = {casa:'Casa',predio:'Prédio residencial',comercial:'Construção comercial'};
const padraoLabel = {baixo:'econômico',normal:'normal',alto:'alto'};

function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }

function calculate(data){
  const base = CUB[data.tipo][data.padrao];

  // CUB é referência básica. O fator abaixo amplia a faixa para custos normalmente
  // não incorporados ao CUB e para particularidades preliminares da obra.
  let complexity = 1.17;
  if(data.terreno === 'moderado') complexity += .05;
  if(data.terreno === 'acentuado') complexity += .12;
  if(data.pavimentos >= 2) complexity += .03;
  if(data.pavimentos >= 4) complexity += .04;
  if(data.piscina) complexity += .05;
  if(data.subsolo) complexity += .10;
  if(data.elevador) complexity += .08;
  if(data.solar) complexity += .025;

  let center = data.area * base * complexity;
  if(data.tipo === 'predio' && data.pavimentos >= 5) center *= 1.04;
  if(data.tipo === 'comercial') center *= 1.03;

  // Faixa propositalmente ampla: diagnóstico de viabilidade, não orçamento.
  const low = center * .90;
  const high = center * 1.12;
  const reserveLow = center * .08;
  const reserveHigh = center * .12;

  // Cronograma paramétrico.
  let months = data.area / 18;
  if(data.tipo === 'predio') months *= .90;
  if(data.pavimentos > 1) months += data.pavimentos * .35;
  if(data.terreno === 'acentuado') months += 1.2;
  if(data.subsolo) months += 1.0;
  months = clamp(months, 4, 30);
  const monthsLow = Math.max(4, Math.round(months*.88));
  const monthsHigh = Math.ceil(months*1.22);

  // Equipe-base de alvenaria/acompanhamento geral. Especialidades são adicionais.
  let masons = Math.ceil(data.area / 70);
  if(data.pavimentos >= 3) masons += 1;
  masons = clamp(masons, 1, 10);
  const masonHigh = Math.min(12, masons + (data.area > 160 ? 1 : 0));
  const helpers = Math.max(1,Math.ceil(masons*.8));

  return {base,complexity,center,low,high,reserveLow,reserveHigh,monthsLow,monthsHigh,masons,masonHigh,helpers};
}

function docsFor(d){
  const docs = [
    ['Levantamento / conferência do terreno','Recomendado'],
    ['Projeto arquitetônico','Essencial'],
    ['Responsabilidade técnica (ART/RRT)','Essencial'],
    ['Aprovação / alvará municipal','Avaliar no município'],
    ['Projetos complementares','Conforme projeto'],
    ['Orçamento executivo + cronograma','Recomendado']
  ];
  if(d.terreno !== 'plano' || d.pavimentos > 1) docs.splice(1,0,['Sondagem e avaliação de fundações','Forte recomendação']);
  if(d.tipo === 'predio' || d.pavimentos > 2) docs.push(['Plano de segurança / PGR','Avaliar NR-18']);
  docs.push(['Comunicação Prévia de Obra (SCPO)','Quando aplicável']);
  return docs;
}

function phases(d){
  const base = [
    ['01','Projetos e aprovações',10],
    ['02','Terreno e fundações',14],
    ['03','Estrutura',18],
    ['04','Vedações + cobertura',18],
    ['05','Instalações',18],
    ['06','Acabamentos + entrega',22]
  ];
  if(d.subsolo) base[1][2] += 4;
  if(d.pavimentos >= 3) base[2][2] += 4;
  return base;
}

function risks(d){
  const r = [
    'Preço e disponibilidade de materiais',
    'Mudanças de projeto durante a execução',
    'Condições reais do solo e fundação',
    'Produtividade e disponibilidade de mão de obra'
  ];
  if(d.terreno !== 'plano') r.unshift('Topografia e contenções no terreno');
  if(d.elevador) r.push('Elevador e infraestrutura associada');
  if(d.subsolo) r.push('Escavação, drenagem e impermeabilização do subsolo');
  if(!d.lote || d.lote === 'nao') r.push('Aquisição e características do lote ainda não definidas');
  return r.slice(0,6);
}

function getData(){
  return {
    municipio: document.querySelector('#municipio').value.trim(),
    lote: document.querySelector('#lote').value,
    tipo: document.querySelector('#tipo').value,
    area: Number(document.querySelector('#area').value),
    pavimentos: Number(document.querySelector('#pavimentos').value),
    padrao: document.querySelector('#padrao').value,
    terreno: document.querySelector('#terreno').value,
    prazo: document.querySelector('#prazo').value,
    piscina: document.querySelector('#piscina').checked,
    subsolo: document.querySelector('#subsolo').checked,
    elevador: document.querySelector('#elevador').checked,
    solar: document.querySelector('#solar').checked
  };
}

function render(d,r){
  document.querySelector('#resultTitle').textContent = `${tipoLabel[d.tipo]} de ${number(d.area)} m² em ${d.municipio || 'seu município'}`;
  document.querySelector('#costRange').textContent = `${money(r.low)} – ${money(r.high)}`;
  document.querySelector('#costPerM2').textContent = `equivale a ~${money(r.low/d.area)}–${money(r.high/d.area)}/m²`;
  document.querySelector('#timeRange').textContent = `${r.monthsLow}–${r.monthsHigh} meses`;
  document.querySelector('#crewRange').textContent = `${r.masons}–${r.masonHigh} pedreiro${r.masonHigh>1?'s':''}`;
  document.querySelector('#crewDetail').textContent = `+ ~${r.helpers} servente(s) e equipes especializadas por etapa`;
  document.querySelector('#reserveRange').textContent = `${money(r.reserveLow)}–${money(r.reserveHigh)}`;

  const percentages = [
    ['Projetos, aprovações e gestão',8],
    ['Fundações + estrutura',26],
    ['Vedações + cobertura',16],
    ['Instalações',16],
    ['Acabamentos',27],
    ['Reserva técnica',7]
  ];
  document.querySelector('#breakdown').innerHTML = percentages.map(([n,p]) =>
    `<div class="break-row"><span>${n}</span><div class="break-track"><div class="break-fill" style="width:${p*2.5}%"></div></div><b>${p}%</b></div>`
  ).join('');

  document.querySelector('#docsList').innerHTML = docsFor(d).map(([name,status]) =>
    `<div class="doc-item"><span>${name}</span><b>${status}</b></div>`
  ).join('');

  const ph = phases(d);
  document.querySelector('#timelineLabel').textContent = `${r.monthsLow}–${r.monthsHigh} meses`;
  document.querySelector('#timeline').innerHTML = ph.map(([n,name,p]) =>
    `<div class="phase"><span>${n}</span><strong>${name}</strong><i style="width:${Math.min(100,p*3)}%"></i></div>`
  ).join('');

  document.querySelector('#riskList').innerHTML = risks(d).map(x => `<div class="risk-item">${x}</div>`).join('');

  const summary = `Diagnóstico preliminar — ${tipoLabel[d.tipo]}, ${d.area} m², ${d.municipio}. Investimento estimado: ${money(r.low)} a ${money(r.high)}. Prazo provável: ${r.monthsLow} a ${r.monthsHigh} meses. Equipe-base: ${r.masons} a ${r.masonHigh} pedreiros + apoio e especialidades.`;
  window.currentSummary = summary;

  // Troque o telefone abaixo pelo WhatsApp real da futura empresa.
  const phone = '5531000000000';
  document.querySelector('#whatsappBtn').href = `https://wa.me/${phone}?text=${encodeURIComponent('Olá! Fiz o diagnóstico gratuito no site e gostaria de conversar sobre minha obra.\n\n'+summary)}`;

  const results = document.querySelector('#resultado');
  results.classList.remove('hidden');
  setTimeout(()=>results.scrollIntoView({behavior:'smooth',block:'start'}),80);
}

document.querySelector('#calcForm').addEventListener('submit', e=>{
  e.preventDefault();
  const d = getData();
  if(!d.area || d.area < 35){ alert('Informe uma área válida a partir de 35 m².'); return; }
  const r = calculate(d);
  render(d,r);
});

document.querySelector('#copySummary').addEventListener('click',async ()=>{
  if(!window.currentSummary) return;
  try{
    await navigator.clipboard.writeText(window.currentSummary);
    const b = document.querySelector('#copySummary');
    const old = b.textContent; b.textContent='Copiado!';
    setTimeout(()=>b.textContent=old,1600);
  }catch(e){ alert(window.currentSummary); }
});