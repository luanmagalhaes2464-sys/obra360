function replaceText(root:ParentNode,from:string,to:string){
  root.querySelectorAll('*').forEach(el=>{
    if(el.children.length===0&&el.textContent?.trim()===from)el.textContent=to
  })
}

function applyBrand(){
  document.title='TecnoMata Engenharia — Portal da Obra'

  const brand=document.querySelector('.v4-brand') as HTMLElement|null
  if(brand&&!brand.dataset.tmBrand){
    brand.dataset.tmBrand='1'
    brand.innerHTML='<span class="tm-brand-mark">T</span><div><b>TECNOMATA</b><small>ENGENHARIA</small></div>'
  }

  replaceText(document,'Copiloto Obra360','Matinho · Copiloto')
  replaceText(document,'COPILOTO OBRA360','MATINHO · COPILOTO')
  replaceText(document,'Entre no Obra360','Entre na TecnoMata Engenharia')
  replaceText(document,'OBRA360 COPILOT','TECNOMATA ENGENHARIA')
  replaceText(document,'Memória do imóvel','Raio-X do imóvel')
  replaceText(document,'MEMÓRIA DO IMÓVEL','RAIO-X DO IMÓVEL')

  document.querySelectorAll('.v4-copilot-page .v4-page-head').forEach(head=>{
    const tag=head.querySelector('span'),title=head.querySelector('h1'),text=head.querySelector('p')
    if(tag)tag.textContent='MATINHO · COPILOTO'
    if(title)title.textContent='Converse com o Matinho.'
    if(text)text.textContent='O Matinho consulta a obra, executa ações permitidas, lê fotos e documentos e pode buscar informações externas quando necessário.'
  })

  const memoryPage=[...document.querySelectorAll('.v4-page')].find(page=>page.querySelector('.v4-memory-grid')) as HTMLElement|undefined
  if(memoryPage){
    const head=memoryPage.querySelector('.v4-page-head')
    const tag=head?.querySelector('span'),title=head?.querySelector('h1'),text=head?.querySelector('p')
    if(tag)tag.textContent='RAIO-X DO IMÓVEL'
    if(title)title.textContent='O mapa do que ficará escondido depois da obra.'
    if(text)text.textContent='Fotos e registros de tubulações, elétrica, impermeabilização, estrutura, equipamentos, fornecedores e garantias para consulta na manutenção futura.'
    if(!memoryPage.querySelector('.tm-memory-explainer')){
      const card=document.createElement('section');card.className='tm-memory-explainer';card.innerHTML='<div><b>Para que serve?</b><p>Antes de fechar uma parede ou piso, registre onde passam água, esgoto, fios, impermeabilização e outros elementos que depois não ficarão visíveis.</p></div><div><b>Exemplo prático</b><p>Daqui a alguns anos, antes de furar uma parede ou fazer uma reforma, você consulta o Raio-X e sabe onde existe tubulação ou fiação.</p></div><div><b>Também guarda</b><p>Modelo de equipamentos, fornecedor, data, garantia e observações úteis para manutenção e assistência técnica.</p></div>'
      const grid=memoryPage.querySelector('.v4-memory-grid');grid?.parentElement?.insertBefore(card,grid)
    }
  }
}

setTimeout(applyBrand,100)
setInterval(applyBrand,1000)
