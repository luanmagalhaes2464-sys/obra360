function matinhoSource(){
  const runtime=document.querySelector('link[data-matinho-favicon]') as HTMLLinkElement|null
  if(runtime?.href)return runtime.href
  const current=document.querySelector('.v4-matinho-brand img') as HTMLImageElement|null
  return current?.src||''
}

function img(cls:string,src:string,alt='Matinho'){
  const el=document.createElement('img');el.className=cls;el.src=src;el.alt=alt;el.loading='eager';return el
}

function ensureMatinho(){
  const src=matinhoSource();if(!src)return

  let icon=document.querySelector('link[data-matinho-static]') as HTMLLinkElement|null
  if(!icon){icon=document.createElement('link');icon.rel='icon';icon.type='image/png';icon.setAttribute('data-matinho-static','1');document.head.append(icon)}
  if(icon.href!==src)icon.href=src
  document.querySelectorAll('link[rel~="icon"]').forEach(el=>{if((el as HTMLLinkElement).href!==src)(el as HTMLLinkElement).href=src})

  document.querySelectorAll('.v4-brand').forEach(brand=>{
    let avatar=brand.querySelector(':scope > .v4-matinho-visible') as HTMLImageElement|null
    if(!avatar){avatar=img('v4-matinho-visible',src);brand.prepend(avatar)}
    else if(avatar.src!==src)avatar.src=src
  })

  document.querySelectorAll('.v4-agent-tabs button').forEach(btn=>{
    let avatar=btn.querySelector(':scope > .v4-matinho-tab') as HTMLImageElement|null
    if(!avatar){avatar=img('v4-matinho-tab',src);btn.prepend(avatar)}
    else if(avatar.src!==src)avatar.src=src
  })

  const orb=document.querySelector('.v4-voice-orb') as HTMLElement|null
  const mic=orb?.querySelector(':scope > button') as HTMLButtonElement|null
  if(mic){mic.classList.add('v4-matinho-mic');mic.style.backgroundImage=`url("${src}")`}

  document.querySelectorAll('.v4-agent-result > span').forEach(label=>{
    let avatar=label.querySelector(':scope > .v4-matinho-result') as HTMLImageElement|null
    if(!avatar){avatar=img('v4-matinho-result',src);label.prepend(avatar)}
  })

  const head=document.querySelector('.v4-copilot-page .v4-page-head') as HTMLElement|null
  if(head&&!head.querySelector('.v4-matinho-page'))head.append(img('v4-matinho-page',src))
}

window.setTimeout(ensureMatinho,120)
window.setInterval(ensureMatinho,1200)
window.addEventListener('obra360:refresh',()=>window.setTimeout(ensureMatinho,100))
