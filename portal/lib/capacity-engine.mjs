function day(value){const date=new Date(`${String(value).slice(0,10)}T12:00:00Z`);return Number.isFinite(date.getTime())?date:null}
export function workingDays(start,end){const a=day(start),b=day(end);if(!a||!b||b<a)return 0;let total=0;for(let cursor=new Date(a);cursor<=b;cursor.setUTCDate(cursor.getUTCDate()+1)){const weekday=cursor.getUTCDay();if(weekday!==0&&weekday!==6)total++}return total}
export function requiredCrew(activity){const planned=Number(activity.planned_quantity),actual=Number(activity.actual_quantity||0),rate=Number(activity.planned_productivity),days=workingDays(activity.planned_start,activity.planned_end);if(!(planned>0&&rate>0&&days>0))return null;return Math.max(0,Math.ceil(Math.max(0,planned-actual)/(rate*days)))}
export function capacityRows(activities,workers){const available=new Map();for(const worker of workers.filter(item=>item.active!==false&&item.availability_status!=='unavailable')){const trade=String(worker.trade||'Não definida');available.set(trade,(available.get(trade)||0)+1)}return activities.filter(item=>item.status!=='done'&&item.workforce_trade).map(item=>{const demand=requiredCrew(item);const capacity=available.get(item.workforce_trade)||0;return {...item,required_people:demand,available_people:capacity,balance:demand===null?null:capacity-demand,status_capacity:demand===null?'needs_data':capacity<demand?'deficit':capacity>demand?'surplus':'balanced'}})}

function monday(value){const d=value?new Date(value):new Date();d.setUTCHours(12,0,0,0);const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()-day+1);return d}
const iso=d=>d.toISOString().slice(0,10)
export function portfolioCapacity(activities,workers,weekCount=8,today=new Date()){
  const supply={};for(const worker of workers.filter(w=>w.active!==false&&w.availability_status!=='unavailable')){const trade=String(worker.trade||'Não definida');supply[trade]=(supply[trade]||0)+1}
  const first=monday(today),weeks=[]
  for(let index=0;index<weekCount;index++){const start=new Date(first);start.setUTCDate(start.getUTCDate()+index*7);const end=new Date(start);end.setUTCDate(end.getUTCDate()+6);const byTrade={},byProject={}
    for(const activity of activities){if(activity.status==='done'||!activity.workforce_trade||!activity.planned_start||!activity.planned_end)continue;const a=day(activity.planned_start),b=day(activity.planned_end);if(!a||!b||b<start||a>end)continue;const crew=requiredCrew(activity);if(crew===null)continue;const trade=String(activity.workforce_trade),projectId=Number(activity.project_id);byTrade[trade]=(byTrade[trade]||0)+crew;if(!byProject[projectId])byProject[projectId]={projectId,projectName:activity.project_name,demands:{}};byProject[projectId].demands[trade]=(byProject[projectId].demands[trade]||0)+crew}
    const trades=[...new Set([...Object.keys(supply),...Object.keys(byTrade)])].sort().map(trade=>({trade,demand:byTrade[trade]||0,supply:supply[trade]||0,balance:(supply[trade]||0)-(byTrade[trade]||0)}))
    weeks.push({start:iso(start),end:iso(end),trades,projects:Object.values(byProject)})
  }
  const suggestions=[]
  for(let i=1;i<weeks.length;i++){const previous=weeks[i-1],current=weeks[i];for(const trade of current.trades.map(x=>x.trade)){const released=previous.projects.map(p=>({p,value:(p.demands[trade]||0)-((current.projects.find(x=>x.projectId===p.projectId)?.demands[trade])||0)})).filter(x=>x.value>0);const needed=current.projects.map(p=>({p,value:(p.demands[trade]||0)-((previous.projects.find(x=>x.projectId===p.projectId)?.demands[trade])||0)})).filter(x=>x.value>0);for(const from of released)for(const to of needed){if(from.p.projectId!==to.p.projectId)suggestions.push({weekStart:current.start,trade,count:Math.min(from.value,to.value),fromProjectId:from.p.projectId,fromProjectName:from.p.projectName,toProjectId:to.p.projectId,toProjectName:to.p.projectName,kind:'potential_transfer'})}}
  }
  return {weeks,suggestions:suggestions.slice(0,20),supply}
}
