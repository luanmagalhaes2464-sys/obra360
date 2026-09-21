import jwt from 'jsonwebtoken'
import { parseCookies } from './http-safety.mjs'

const OCCURRENCE_TYPES = new Set(['chuva','falta_material','falta_trabalhador','acidente_incidente','retrabalho','atraso_fornecedor','mudanca_projeto','equipamento_quebrado','interferencia','erro_execucao','paralisacao','outro'])

function send(res,status,body){const data=Buffer.from(JSON.stringify(body));res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':String(data.length),'Cache-Control':'no-store'});res.end(data)}
async function readJson(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>256*1024)return null;chunks.push(chunk)}if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
const isoDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):null

export function createFieldRoutes({pool,jwtSecret,cookieName='obra360_session'}){
  async function currentUser(req){const token=parseCookies(req.headers.cookie||'')[cookieName];if(!token)return null;try{const payload=jwt.verify(token,jwtSecret),q=await pool.query('SELECT id,name,email,role FROM users WHERE id=$1',[payload.id]);return q.rows[0]||null}catch{return null}}
  async function canAccess(user,projectId){if(!user)return false;if(user.role==='admin')return true;const q=await pool.query(`SELECT 1 FROM projects p LEFT JOIN company_users cu ON cu.company_id=p.company_id AND cu.user_id=$2 AND cu.is_active=true LEFT JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2 WHERE p.id=$1 AND (cu.user_id IS NOT NULL OR pm.user_id IS NOT NULL)`,[projectId,user.id]);return q.rowCount>0}
  const isStaff=user=>['admin','team'].includes(user?.role)
  async function addEvent(projectId,userId,title,description){await pool.query(`INSERT INTO os_events(project_id,event_type,title,description,created_by) VALUES($1,'field',$2,$3,$4)`,[projectId,title,description,userId])}

  async function fieldBundle(projectId){
    const [reports,records,occurrences,activities]=await Promise.all([
      pool.query(`SELECT r.*,u.name created_by_name,c.name confirmed_by_name,COUNT(p.id)::int productivity_count,COALESCE(SUM(p.worked_hours*p.worker_count),0) labor_hours,COALESCE(SUM(p.downtime_hours),0) downtime_hours FROM daily_reports r LEFT JOIN users u ON u.id=r.created_by LEFT JOIN users c ON c.id=r.confirmed_by LEFT JOIN productivity_records p ON p.daily_report_id=r.id WHERE r.project_id=$1 GROUP BY r.id,u.name,c.name ORDER BY r.report_date DESC LIMIT 90`,[projectId]),
      pool.query(`SELECT p.*,t.title activity_title,t.wbs_code,CASE WHEN p.worked_hours>0 AND p.worker_count>0 THEN p.quantity/(p.worked_hours*p.worker_count) ELSE NULL END productivity_per_labor_hour FROM productivity_records p JOIN os_tasks t ON t.id=p.activity_id WHERE p.project_id=$1 ORDER BY p.record_date DESC,p.id DESC LIMIT 250`,[projectId]),
      pool.query(`SELECT o.*,t.title activity_title,u.name created_by_name FROM occurrences o LEFT JOIN os_tasks t ON t.id=o.activity_id LEFT JOIN users u ON u.id=o.created_by WHERE o.project_id=$1 ORDER BY o.created_at DESC LIMIT 120`,[projectId]),
      pool.query(`SELECT id,title,wbs_code,unit,planned_quantity,actual_quantity,planned_productivity,actual_productivity,status FROM os_tasks WHERE project_id=$1 AND status<>'na' ORDER BY task_order,id`,[projectId]),
    ])
    const laborHours=records.rows.reduce((sum,item)=>sum+Number(item.worked_hours||0)*Number(item.worker_count||0),0)
    return {reports:reports.rows,records:records.rows,occurrences:occurrences.rows,activities:activities.rows,summary:{reports:reports.rowCount,confirmed:reports.rows.filter(item=>item.status==='confirmed').length,records:records.rowCount,laborHours, downtimeHours:records.rows.reduce((sum,item)=>sum+Number(item.downtime_hours||0),0)}}
  }

  return async function handleFieldRequest(req,res,url){
    const fieldMatch=url.pathname.match(/^\/api\/vico\/projects\/(\d+)\/field\/?$/)
    const reportMatch=url.pathname.match(/^\/api\/vico\/projects\/(\d+)\/daily-reports(?:\/(\d+)\/confirm)?\/?$/)
    const productivityMatch=url.pathname.match(/^\/api\/vico\/projects\/(\d+)\/productivity\/?$/)
    const occurrenceMatch=url.pathname.match(/^\/api\/vico\/projects\/(\d+)\/occurrences\/?$/)
    if(!fieldMatch&&!reportMatch&&!productivityMatch&&!occurrenceMatch)return false
    const projectId=Number((fieldMatch||reportMatch||productivityMatch||occurrenceMatch)[1]),user=await currentUser(req)
    if(!user){send(res,401,{error:'Não autenticado'});return true}
    if(!(await canAccess(user,projectId))){send(res,403,{error:'Sem acesso'});return true}
    if(fieldMatch&&req.method==='GET'){send(res,200,await fieldBundle(projectId));return true}
    if(!isStaff(user)){send(res,403,{error:'Somente a equipe da obra pode registrar dados de campo.'});return true}

    if(reportMatch&&req.method==='POST'&&!reportMatch[2]){
      const body=await readJson(req),reportDate=isoDate(body?.reportDate)
      if(!body||!reportDate){send(res,400,{error:'Informe a data do RDO.'});return true}
      const q=await pool.query(`INSERT INTO daily_reports(project_id,report_date,weather,notes,status,created_by) VALUES($1,$2,$3,$4,'draft',$5) ON CONFLICT(project_id,report_date) DO UPDATE SET weather=EXCLUDED.weather,notes=EXCLUDED.notes,updated_at=now() WHERE daily_reports.status='draft' RETURNING *`,[projectId,reportDate,String(body.weather||'').trim().slice(0,120)||null,String(body.notes||'').trim().slice(0,4000)||null,user.id])
      if(!q.rowCount){send(res,409,{error:'Este RDO já foi confirmado e não pode ser substituído silenciosamente.'});return true}
      await addEvent(projectId,user.id,`RDO salvo: ${reportDate}`,'Registro mantido como rascunho até confirmação humana.')
      send(res,201,{report:q.rows[0]});return true
    }
    if(reportMatch&&req.method==='PATCH'&&reportMatch[2]){
      const id=Number(reportMatch[2]),q=await pool.query(`UPDATE daily_reports SET status='confirmed',confirmed_by=$1,confirmed_at=now(),updated_at=now() WHERE id=$2 AND project_id=$3 AND status='draft' RETURNING *`,[user.id,id,projectId])
      if(!q.rowCount){send(res,404,{error:'RDO em rascunho não encontrado.'});return true}
      await addEvent(projectId,user.id,`RDO confirmado: ${q.rows[0].report_date}`,'Registro confirmado pela equipe.')
      send(res,200,{report:q.rows[0]});return true
    }
    if(productivityMatch&&req.method==='POST'){
      const body=await readJson(req);if(!body){send(res,400,{error:'Dados inválidos'});return true}
      const activityId=Number(body.activityId),reportId=Number(body.dailyReportId)||null,recordDate=isoDate(body.recordDate),quantity=Number(body.quantity),workedHours=Number(body.workedHours),workerCount=Number(body.workerCount),downtimeHours=Math.max(0,Number(body.downtimeHours)||0),unit=String(body.unit||'').trim().slice(0,30)
      const activity=await pool.query('SELECT * FROM os_tasks WHERE id=$1 AND project_id=$2',[activityId,projectId])
      if(!activity.rowCount||!recordDate||!unit||!Number.isFinite(quantity)||quantity<0||!Number.isFinite(workedHours)||workedHours<0||!Number.isInteger(workerCount)||workerCount<0){send(res,400,{error:'Atividade, data, quantidade, unidade, horas e trabalhadores precisam ser válidos.'});return true}
      if(activity.rows[0].unit&&String(activity.rows[0].unit).toLowerCase()!==unit.toLowerCase()){send(res,409,{error:`A atividade está configurada em ${activity.rows[0].unit}. Use a mesma unidade para manter o histórico comparável.`});return true}
      if(reportId){const rq=await pool.query('SELECT 1 FROM daily_reports WHERE id=$1 AND project_id=$2',[reportId,projectId]);if(!rq.rowCount){send(res,400,{error:'O RDO selecionado não pertence a esta obra.'});return true}}
      const q=await pool.query(`INSERT INTO productivity_records(project_id,activity_id,daily_report_id,record_date,quantity,unit,worked_hours,worker_count,downtime_hours,downtime_reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[projectId,activityId,reportId,recordDate,quantity,unit,workedHours,workerCount,downtimeHours,String(body.downtimeReason||'').trim().slice(0,500)||null,user.id])
      await pool.query(`UPDATE os_tasks t SET unit=COALESCE(t.unit,$1),actual_quantity=x.quantity,actual_productivity=x.productivity,updated_at=now() FROM (SELECT activity_id,COALESCE(SUM(quantity),0) quantity,CASE WHEN SUM(worked_hours*worker_count)>0 THEN SUM(quantity)/SUM(worked_hours*worker_count) ELSE NULL END productivity FROM productivity_records WHERE activity_id=$2 GROUP BY activity_id) x WHERE t.id=x.activity_id`,[unit,activityId])
      await addEvent(projectId,user.id,`Produção registrada: ${activity.rows[0].title}`,`${quantity} ${unit} · ${workerCount} trabalhador(es) · ${workedHours} hora(s).`)
      send(res,201,{record:q.rows[0]});return true
    }
    if(occurrenceMatch&&req.method==='POST'){
      const body=await readJson(req);if(!body){send(res,400,{error:'Dados inválidos'});return true}
      const type=OCCURRENCE_TYPES.has(body.occurrenceType)?body.occurrenceType:'outro',title=String(body.title||'').trim().slice(0,180),activityId=Number(body.activityId)||null,reportId=Number(body.dailyReportId)||null
      if(!title){send(res,400,{error:'Informe o que aconteceu.'});return true}
      if(activityId){const aq=await pool.query('SELECT 1 FROM os_tasks WHERE id=$1 AND project_id=$2',[activityId,projectId]);if(!aq.rowCount){send(res,400,{error:'Atividade inválida.'});return true}}
      if(reportId){const rq=await pool.query('SELECT 1 FROM daily_reports WHERE id=$1 AND project_id=$2',[reportId,projectId]);if(!rq.rowCount){send(res,400,{error:'O RDO selecionado não pertence a esta obra.'});return true}}
      const impactDays=body.impactDays===''?null:Math.max(0,Number(body.impactDays)||0),impactCost=body.impactCost===''?null:Number(body.impactCost)||null
      const q=await pool.query(`INSERT INTO occurrences(project_id,activity_id,daily_report_id,occurrence_type,title,description,impact_days,impact_cost,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[projectId,activityId,reportId,type,title,String(body.description||'').trim().slice(0,1200)||null,impactDays,impactCost,user.id])
      await addEvent(projectId,user.id,`Ocorrência: ${title}`,'Impactos informados permanecem para revisão; o cronograma não foi alterado automaticamente.')
      send(res,201,{occurrence:q.rows[0]});return true
    }
    send(res,405,{error:'Método não permitido'});return true
  }
}
