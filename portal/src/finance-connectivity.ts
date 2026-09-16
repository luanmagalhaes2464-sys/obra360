type CostEntry = {
  id:number; status:'paid'|'committed'; category:string; description:string; supplier?:string|null;
  amount:number|string; entry_date:string; stage_key?:string|null; task_id?:number|null; task_title?:string|null; created_by_name?:string|null
}

type Bundle = { project:{id:number}; stages:{key:string;title:string}[]; tasks:{id:number;stage_key:string;title:string;status:string}[] }

type FinancePayload = { entries:CostEntry[]; totals:{budget:number;spent:number;committed:number;available:number}; canEdit:boolean }

let mounting = false
let mountedProject = ''

const money = (value:number|string) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2}).format(Number(value)||0)
const esc = (value:any) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c))
const today = () => new Date().toISOString().slice(0,10)

function projectId(){return (document.querySelector('.v4-project-select select') as HTMLSelectElement|null)?.value||''}

async function getJson<T=any>(url:string,options:RequestInit={}):Promise<T>{
  const response=await fetch(url,{...options,credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})}})
  const data=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(data.error||'Erro na operação')
  return data
}

function categoryLabel(v:string){return ({material:'Material',mao_de_obra:'Mão de obra',servico:'Serviço',equipamento:'Equipamento',taxa:'Taxa / licença',projeto:'Projeto',outros:'Outros'} as Record<string,string>)[v]||v}

function stageMap(bundle:Bundle){return new Map((bundle.stages||[]).map(s=>[s.key,s.title]))}

function byStage(entries:CostEntry[],bundle:Bundle){
  const labels=stageMap(bundle),m=new Map<string,{label:string;paid:number;committed:number}>()
  for(const e of entries){
    const key=e.stage_key||'sem_etapa',row=m.get(key)||{label:e.stage_key?labels.get(e.stage_key)||e.stage_key:'Sem etapa vinculada',paid:0,committed:0}
    if(e.status==='paid')row.paid+=Number(e.amount)||0;else row.committed+=Number(e.amount)||0
    m.set(key,row)
  }
  return [...m.values()].sort((a,b)=>(b.paid+b.committed)-(a.paid+a.committed))
}

function render(root:HTMLElement,data:FinancePayload,bundle:Bundle){
  const stages=bundle.stages||[],entries=data.entries||[],stageTotals=byStage(entries,bundle)
  root.innerHTML=`
    <section class="tm-finance-intro">
      <div><span>CONTROLE FINANCEIRO CONECTADO</span><h3>O sistema não adivinha quanto foi gasto.</h3><p>O realizado e o comprometido são calculados pelas movimentações reais registradas abaixo. Cada lançamento pode ser ligado à etapa e ao item do checklist que gerou aquele custo.</p></div>
      <div class="tm-finance-kpis">
        <article><small>Pago / realizado</small><b>${money(data.totals.spent)}</b></article>
        <article><small>Comprometido</small><b>${money(data.totals.committed)}</b></article>
        <article><small>Saldo não comprometido</small><b class="${data.totals.available<0?'negative':''}">${money(data.totals.available)}</b></article>
      </div>
    </section>
    ${data.canEdit?`<section class="tm-cost-entry"><header><div><span>NOVA MOVIMENTAÇÃO</span><h3>Registrar gasto ou compromisso</h3></div><button type="button" class="tm-cost-toggle">+ Registrar</button></header><form class="tm-cost-form" hidden>
      <label>Situação<select name="status"><option value="paid">Pago / realizado</option><option value="committed">Comprometido / contratado</option></select></label>
      <label>Valor (R$)<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0,00"></label>
      <label class="wide">Descrição<input name="description" required placeholder="Ex.: compra de cimento / mão de obra de fundação"></label>
      <label>Categoria<select name="category"><option value="material">Material</option><option value="mao_de_obra">Mão de obra</option><option value="servico">Serviço</option><option value="equipamento">Equipamento</option><option value="taxa">Taxa / licença</option><option value="projeto">Projeto</option><option value="outros">Outros</option></select></label>
      <label>Etapa<select name="stageKey"><option value="">Sem etapa</option>${stages.map(s=>`<option value="${esc(s.key)}">${esc(s.title)}</option>`).join('')}</select></label>
      <label class="wide">Item do checklist<select name="taskId"><option value="">Sem item específico</option></select></label>
      <label>Fornecedor<input name="supplier" placeholder="Opcional"></label>
      <label>Data<input name="entryDate" type="date" value="${today()}"></label>
      <div class="tm-cost-actions"><button type="button" class="tm-cost-cancel">Cancelar</button><button type="submit">Salvar movimentação</button></div>
      <p class="tm-cost-error" aria-live="polite"></p>
    </form></section>`:''}
    <section class="tm-finance-grid">
      <article class="tm-stage-costs"><header><span>CUSTO POR ETAPA</span><h3>Onde o dinheiro está indo</h3></header>${stageTotals.length?`<div>${stageTotals.map(s=>`<p><span>${esc(s.label)}</span><b>${money(s.paid+s.committed)}</b><small>${money(s.paid)} pago · ${money(s.committed)} comprometido</small></p>`).join('')}</div>`:'<div class="tm-empty-cost">Nenhuma movimentação registrada ainda.</div>'}</article>
      <article class="tm-cost-history"><header><span>HISTÓRICO</span><h3>Movimentações da obra</h3></header>${entries.length?`<div class="tm-cost-list">${entries.slice(0,40).map(e=>`<div class="tm-cost-row" data-id="${e.id}"><i class="${e.status}"></i><div><b>${esc(e.description)}</b><small>${esc(categoryLabel(e.category))}${e.stage_key?` · ${esc(stageMap(bundle).get(e.stage_key)||e.stage_key)}`:''}${e.task_title?` · ${esc(e.task_title)}`:''}${e.supplier?` · ${esc(e.supplier)}`:''}</small><em>${new Date(String(e.entry_date).slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR')}</em></div><strong>${money(e.amount)}</strong>${data.canEdit&&e.status==='committed'?'<button class="tm-mark-paid" title="Marcar como pago">Pagar</button>':''}</div>`).join('')}</div>`:'<div class="tm-empty-cost">Comece registrando um pagamento ou um compromisso. A partir daí os totais do topo passam a vir desses registros.</div>'}</article>
    </section>`

  const toggle=root.querySelector('.tm-cost-toggle') as HTMLButtonElement|null,form=root.querySelector('.tm-cost-form') as HTMLFormElement|null,cancel=root.querySelector('.tm-cost-cancel') as HTMLButtonElement|null
  toggle?.addEventListener('click',()=>{if(form)form.hidden=!form.hidden})
  cancel?.addEventListener('click',()=>{if(form)form.hidden=true})
  const stageSelect=form?.querySelector('[name="stageKey"]') as HTMLSelectElement|null
  const taskSelect=form?.querySelector('[name="taskId"]') as HTMLSelectElement|null
  function updateTasks(){if(!taskSelect)return;const key=stageSelect?.value||'';const tasks=(bundle.tasks||[]).filter(t=>!key||t.stage_key===key);taskSelect.innerHTML='<option value="">Sem item específico</option>'+tasks.map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join('')}
  stageSelect?.addEventListener('change',updateTasks);updateTasks()

  form?.addEventListener('submit',async ev=>{
    ev.preventDefault();const err=form.querySelector('.tm-cost-error') as HTMLElement;err.textContent='';const button=form.querySelector('[type="submit"]') as HTMLButtonElement;button.disabled=true;button.textContent='Salvando…'
    try{
      const fd=new FormData(form),body={status:fd.get('status'),amount:Number(fd.get('amount')),description:fd.get('description'),category:fd.get('category'),stageKey:fd.get('stageKey'),taskId:fd.get('taskId')?Number(fd.get('taskId')):null,supplier:fd.get('supplier'),entryDate:fd.get('entryDate')}
      await getJson(`/api/os/projects/${bundle.project.id}/costs`,{method:'POST',body:JSON.stringify(body)})
      window.dispatchEvent(new CustomEvent('obra360:refresh'));await mountFinance(true)
    }catch(e:any){err.textContent=e.message||'Não foi possível salvar.'}finally{button.disabled=false;button.textContent='Salvar movimentação'}
  })

  root.querySelectorAll('.tm-mark-paid').forEach(btn=>btn.addEventListener('click',async()=>{
    const row=(btn as HTMLElement).closest('.tm-cost-row') as HTMLElement|null;if(!row)return;(btn as HTMLButtonElement).disabled=true
    try{await getJson(`/api/os/projects/${bundle.project.id}/costs/${row.dataset.id}`,{method:'PATCH',body:JSON.stringify({status:'paid'})});window.dispatchEvent(new CustomEvent('obra360:refresh'));await mountFinance(true)}catch(e:any){alert(e.message)}
  }))
}

async function mountFinance(force=false){
  const hero=document.querySelector('.v4-finance-hero') as HTMLElement|null
  const id=projectId();if(!hero||!id||mounting)return
  const existing=document.getElementById('tm-finance-connectivity')
  if(existing&&!force&&mountedProject===id)return
  mounting=true
  try{
    const [data,bundle]=await Promise.all([getJson<FinancePayload>(`/api/os/projects/${id}/costs`),getJson<Bundle>(`/api/os/projects/${id}`)])
    existing?.remove();const root=document.createElement('div');root.id='tm-finance-connectivity';hero.insertAdjacentElement('afterend',root);mountedProject=id;render(root,data,bundle)
    const head=hero.closest('.v4-page')?.querySelector('.v4-page-head') as HTMLElement|null
    const h1=head?.querySelector('h1'),p=head?.querySelector('p');if(h1)h1.textContent='Custos reais ligados à execução.';if(p)p.textContent='Pagamentos e compromissos vinculados às etapas e aos itens da obra. O sistema calcula os totais a partir desses registros.'
  }catch(e:any){
    if(!existing){const root=document.createElement('div');root.id='tm-finance-connectivity';root.className='tm-finance-error';root.textContent='Não consegui carregar as movimentações financeiras: '+(e.message||'erro');hero.insertAdjacentElement('afterend',root)}
  }finally{mounting=false}
}

setTimeout(()=>mountFinance(),250)
setInterval(()=>mountFinance(),900)
window.addEventListener('obra360:refresh',()=>setTimeout(()=>mountFinance(true),300))
