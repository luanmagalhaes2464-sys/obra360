const money = v => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0
}).format(v);

const number = v => new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0
}).format(v);

const CUB = {
  casa: { baixo: 2562.62, normal: 3102.16, alto: 3852.38 },
  predio: { baixo: 2285.68, normal: 2554.58, alto: 3120.21 },
  comercial: { baixo: 2490.95, normal: 2954.74, alto: 3213.83 }
};

const tipoLabel = {
  casa: 'Casa',
  predio: 'Prédio residencial',
  comercial: 'Construção comercial'
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function getData() {
  return {
    municipio: document.querySelector('#municipio').value.trim(),
    lote: document.querySelector('#lote').value,
    areaTerreno: Number(document.querySelector('#areaTerreno').value) || 0,
    tipo: document.querySelector('#tipo').value,
    area: Number(document.querySelector('#area').value),
    pavimentos: Number(document.querySelector('#pavimentos').value),
    quartos: Number(document.querySelector('#quartos').value) || 0,
    banheiros: Number(document.querySelector('#banheiros').value) || 0,
    vagas: Number(document.querySelector('#vagas').value) || 0,
    padrao: document.querySelector('#padrao').value,
    terreno: document.querySelector('#terreno').value,
    estrutura: document.querySelector('#estrutura').value,
    cobertura: document.querySelector('#cobertura').value,
    projetoStatus: document.querySelector('#projetoStatus').value,
    prazo: document.querySelector('#prazo').value,
    piscina: document.querySelector('#piscina').checked,
    subsolo: document.querySelector('#subsolo').checked,
    elevador: document.querySelector('#elevador').checked,
    solar: document.querySelector('#solar').checked,
    gourmet: document.querySelector('#gourmet').checked,
    contencao: document.querySelector('#contencao').checked
  };
}

function calculate(d) {
  const base = CUB[d.tipo][d.padrao];
  let complexity = 1.17;

  if (d.terreno === 'moderado') complexity += 0.05;
  if (d.terreno === 'acentuado') complexity += 0.12;
  if (d.pavimentos >= 2) complexity += 0.03;
  if (d.pavimentos >= 4) complexity += 0.04;
  if (d.quartos > 3) complexity += Math.min(0.04, (d.quartos - 3) * 0.01);
  if (d.banheiros > 2) complexity += Math.min(0.04, (d.banheiros - 2) * 0.008);
  if (d.vagas > 2) complexity += Math.min(0.03, (d.vagas - 2) * 0.01);
  if (d.estrutura === 'concreto') complexity += 0.04;
  if (d.estrutura === 'metalica') complexity += 0.08;
  if (d.cobertura === 'laje') complexity += 0.03;
  if (d.cobertura === 'platibanda') complexity += 0.04;
  if (d.piscina) complexity += 0.05;
  if (d.subsolo) complexity += 0.10;
  if (d.elevador) complexity += 0.08;
  if (d.solar) complexity += 0.025;
  if (d.gourmet) complexity += 0.02;
  if (d.contencao) complexity += 0.05;
  if (d.areaTerreno > 0 && d.areaTerreno < d.area * 1.3) complexity += 0.03;

  let center = d.area * base * complexity;
  if (d.tipo === 'predio' && d.pavimentos >= 5) center *= 1.04;
  if (d.tipo === 'comercial') center *= 1.03;

  const low = center * 0.90;
  const high = center * 1.12;
  const reserveLow = center * 0.08;
  const reserveHigh = center * 0.12;

  let months = d.area / 18;
  if (d.tipo === 'predio') months *= 0.9;
  if (d.tipo === 'comercial') months *= 0.95;
  if (d.pavimentos > 1) months += d.pavimentos * 0.35;
  if (d.terreno === 'acentuado') months += 1.2;
  if (d.subsolo) months += 1.0;
  if (d.contencao) months += 0.8;
  if (d.elevador) months += 0.6;
  months = clamp(months, 4, 30);
  const monthsLow = Math.max(4, Math.round(months * 0.88));
  const monthsHigh = Math.ceil(months * 1.22);

  let masons = Math.ceil(d.area / 70);
  if (d.pavimentos >= 3) masons += 1;
  if (d.subsolo || d.contencao) masons += 1;
  masons = clamp(masons, 1, 10);
  const masonHigh = Math.min(12, masons + (d.area > 160 ? 1 : 0));
  const helpers = Math.max(1, Math.ceil(masons * 0.8));

  return { base, complexity, center, low, high, reserveLow, reserveHigh, monthsLow, monthsHigh, masons, masonHigh, helpers };
}

function docsFor(d) {
  const docs = [
    ['Levantamento / conferência do terreno', 'Recomendado'],
    ['Projeto arquitetônico', d.projetoStatus === 'sim' ? 'Informado' : 'Essencial'],
    ['Responsabilidade técnica (ART/RRT)', 'Essencial'],
    ['Aprovação / alvará municipal', 'Avaliar no município'],
    ['Projetos estrutural, elétrico e hidrossanitário', 'Conforme escopo'],
    ['Orçamento executivo + cronograma', 'Recomendado']
  ];

  if (d.projetoStatus !== 'sim') docs.splice(1, 0, ['Estudo preliminar / programa de necessidades', 'Importante']);
  if (d.terreno !== 'plano' || d.pavimentos > 1 || d.contencao) docs.splice(2, 0, ['Sondagem e avaliação de fundações', 'Forte recomendação']);
  if (d.tipo === 'predio' || d.pavimentos > 2 || d.subsolo) docs.push(['PGR / orientações de segurança da obra', 'Avaliar NR-18']);
  docs.push(['Comunicação Prévia de Obra (SCPO)', 'Quando aplicável']);
  return docs;
}

function phases(d) {
  const list = [
    ['01', 'Projetos e aprovações', 10],
    ['02', 'Terreno e fundações', 14],
    ['03', 'Estrutura', 18],
    ['04', 'Vedações + cobertura', 18],
    ['05', 'Instalações', 18],
    ['06', 'Acabamentos + entrega', 22]
  ];
  if (d.subsolo || d.contencao) list[1][2] += 4;
  if (d.pavimentos >= 3) list[2][2] += 4;
  if (d.cobertura === 'platibanda') list[3][2] += 2;
  return list;
}

function risks(d) {
  const r = [
    'Preço e disponibilidade de materiais',
    'Mudanças de projeto durante a execução',
    'Condições reais do solo e da fundação',
    'Produtividade e disponibilidade de mão de obra'
  ];
  if (d.terreno !== 'plano') r.unshift('Topografia, cortes, aterros e adaptações do terreno');
  if (d.contencao) r.push('Custos de contenção, drenagem e muros especiais');
  if (d.subsolo) r.push('Escavação, drenagem e impermeabilização do subsolo');
  if (d.elevador) r.push('Elevador e infraestrutura associada');
  if (d.lote === 'nao') r.push('Aquisição e características do lote ainda não definidas');
  if (d.projetoStatus === 'nao') r.push('Falta de projeto definido pode mudar bastante o resultado');
  return r.slice(0, 6);
}

function getBreakdown(d) {
  const parts = [
    ['Projetos, aprovações e gestão', 8],
    ['Fundações + estrutura', 26],
    ['Vedações + cobertura', 16],
    ['Instalações', 16],
    ['Acabamentos', 27],
    ['Reserva técnica', 7]
  ];

  if (d.subsolo || d.contencao) {
    parts[1][1] += 3;
    parts[4][1] -= 2;
  }
  if (d.piscina) {
    parts[1][1] += 2;
    parts[5][1] -= 1;
  }
  if (d.solar) {
    parts[2][1] -= 1;
    parts[3][1] += 1;
  }

  return parts;
}

function render(d, r) {
  document.querySelector('#resultTitle').textContent = `${tipoLabel[d.tipo]} de ${number(d.area)} m² em ${d.municipio || 'seu município'}`;
  document.querySelector('#costRange').textContent = `${money(r.low)} – ${money(r.high)}`;
  document.querySelector('#costPerM2').textContent = `equivale a ~${money(r.low / d.area)}–${money(r.high / d.area)}/m²`;
  document.querySelector('#timeRange').textContent = `${r.monthsLow}–${r.monthsHigh} meses`;
  document.querySelector('#crewRange').textContent = `${r.masons}–${r.masonHigh} pedreiro${r.masonHigh > 1 ? 's' : ''}`;
  document.querySelector('#crewDetail').textContent = `+ ~${r.helpers} servente(s) e equipes especializadas por etapa`;
  document.querySelector('#reserveRange').textContent = `${money(r.reserveLow)}–${money(r.reserveHigh)}`;

  const breakdown = getBreakdown(d);
  document.querySelector('#breakdown').innerHTML = breakdown.map(([name, pct]) => `
    <div class="break-row">
      <span>${name}</span>
      <div class="break-track"><div class="break-fill" style="width:${pct * 2.5}%"></div></div>
      <b>${pct}%</b>
    </div>
  `).join('');

  document.querySelector('#docsList').innerHTML = docsFor(d).map(([name, status]) => `
    <div class="doc-item"><span>${name}</span><b>${status}</b></div>
  `).join('');

  const ph = phases(d);
  document.querySelector('#timelineLabel').textContent = `${r.monthsLow}–${r.monthsHigh} meses`;
  document.querySelector('#timeline').innerHTML = ph.map(([n, name, p]) => `
    <div class="phase"><span>${n}</span><strong>${name}</strong><i style="width:${Math.min(100, p * 3)}%"></i></div>
  `).join('');

  document.querySelector('#riskList').innerHTML = risks(d).map(item => `<div class="risk-item">${item}</div>`).join('');

  const summary = `Diagnóstico preliminar — ${tipoLabel[d.tipo]}, ${d.area} m², ${d.municipio}. Investimento estimado: ${money(r.low)} a ${money(r.high)}. Prazo provável: ${r.monthsLow} a ${r.monthsHigh} meses. Equipe-base: ${r.masons} a ${r.masonHigh} pedreiros + apoio e especialidades. Terreno: ${d.terreno}. Acabamento: ${d.padrao}.`;
  window.currentSummary = summary;

  const phone = '5531000000000';
  document.querySelector('#whatsappBtn').href = `https://wa.me/${phone}?text=${encodeURIComponent('Olá! Fiz o diagnóstico gratuito no site e gostaria de conversar sobre minha obra.\n\n' + summary)}`;

  const results = document.querySelector('#resultado');
  results.classList.remove('hidden');
  setTimeout(() => results.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

document.querySelector('#calcForm').addEventListener('submit', e => {
  e.preventDefault();
  const d = getData();
  if (!d.area || d.area < 35) {
    alert('Informe uma área válida a partir de 35 m².');
    return;
  }
  const r = calculate(d);
  render(d, r);
});

document.querySelector('#copySummary').addEventListener('click', async () => {
  if (!window.currentSummary) return;
  try {
    await navigator.clipboard.writeText(window.currentSummary);
    const button = document.querySelector('#copySummary');
    const old = button.textContent;
    button.textContent = 'Copiado!';
    setTimeout(() => button.textContent = old, 1600);
  } catch (e) {
    alert(window.currentSummary);
  }
});
