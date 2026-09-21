import jwt from 'jsonwebtoken'
import { parseCookies } from './http-safety.mjs'
import { buildMotorState, criticalPath, ganttWindow, wouldCreateCycle } from './motor-engine.mjs'

const BLOCKER_TYPES = new Set(['predecessora','projeto','documento','aprovacao','cliente','material','equipamento','mao_de_obra','sst','fornecedor','inspecao','decisao','outro'])
const DEPENDENCY_TYPES = new Set(['FS','SS','FF','SF'])

function send(res, status, body) {
  const data = Buffer.from(JSON.stringify(body))
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Content-Length':String(data.length),'Cache-Control':'no-store'})
  res.end(data)
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 256 * 1024) return null
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return null }
}

function dateOrNull(value) {
  const text = String(value || '')
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

export function createMotorRoutes({ pool, jwtSecret, cookieName = 'obra360_session' }) {
  async function userFrom(req) {
    const token = parseCookies(req.headers.cookie || '')[cookieName]
    if (!token) return null
    try {
      const payload = jwt.verify(token, jwtSecret)
      const q = await pool.query('SELECT id,name,email,role FROM users WHERE id=$1', [payload.id])
      return q.rows[0] || null
    } catch { return null }
  }

  async function access(user, projectId) {
    if (!user) return false
    if (user.role === 'admin') return true
    const q = await pool.query(`SELECT 1 FROM projects p
      LEFT JOIN company_users cu ON cu.company_id=p.company_id AND cu.user_id=$2 AND cu.is_active=true
      LEFT JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2
      WHERE p.id=$1 AND (($3='team' AND cu.user_id IS NOT NULL AND cu.role<>'client') OR pm.user_id IS NOT NULL)`, [projectId, user.id, user.role])
    return q.rowCount > 0
  }

  function staff(user) { return ['admin','team'].includes(user?.role) }

  async function bundle(projectId) {
    const [tasks, dependencies, blockers, baselines] = await Promise.all([
      pool.query(`SELECT t.*,u.name responsible_name FROM os_tasks t LEFT JOIN users u ON u.id=t.responsible_user_id WHERE t.project_id=$1 ORDER BY t.task_order,t.id`, [projectId]),
      pool.query(`SELECT d.*,p.title predecessor_title,s.title successor_title FROM activity_dependencies d JOIN os_tasks p ON p.id=d.predecessor_id JOIN os_tasks s ON s.id=d.successor_id WHERE d.project_id=$1 ORDER BY d.id`, [projectId]),
      pool.query(`SELECT b.*,u.name created_by_name FROM blockers b LEFT JOIN users u ON u.id=b.created_by WHERE b.project_id=$1 ORDER BY (b.status='active') DESC,b.created_at DESC`, [projectId]),
      pool.query(`SELECT id,name,snapshot,created_at FROM activity_baselines WHERE project_id=$1 ORDER BY created_at DESC,id DESC LIMIT 10`,[projectId]),
    ])
    const state = buildMotorState(tasks.rows, dependencies.rows, blockers.rows)
    const path=criticalPath(tasks.rows,dependencies.rows)
    const activities=state.activities.map(item=>({...item,critical:Boolean(path.activities[item.id]?.critical),total_float:path.activities[item.id]?.totalFloat??null}))
    return {...state,activities,dependencies:dependencies.rows,blockers:blockers.rows,baselines:baselines.rows,criticalPath:path,gantt:ganttWindow(tasks.rows)}
  }

  async function activityExists(projectId, activityId) {
    const q = await pool.query('SELECT * FROM os_tasks WHERE id=$1 AND project_id=$2', [activityId, projectId])
    return q.rows[0] || null
  }

  async function event(projectId, userId, title, description) {
    await pool.query(`INSERT INTO os_events(project_id,event_type,title,description,created_by) VALUES($1,'motor',$2,$3,$4)`, [projectId,title,description,userId])
  }

  return async function handleMotorRequest(req, res, url) {
    const projectMatch = url.pathname.match(/^\/api\/vico\/projects\/(\d+)\/motor\/?$/)
    const activityMatch = url.pathname.match(/^\/api\/vico\/projects\/(\d+)\/activities\/(\d+)\/?$/)
    const dependencyMatch = url.pathname.match(/^\/api\/vico\/projects\/(\d+)\/dependencies(?:\/(\d+))?\/?$/)
    const blockerMatch = url.pathname.match(/^\/api\/vico\/projects\/(\d+)\/blockers(?:\/(\d+)\/resolve)?\/?$/)
    const baselineMatch = url.pathname.match(/^\/api\/vico\/projects\/(\d+)\/baselines\/?$/)
    if (!projectMatch && !activityMatch && !dependencyMatch && !blockerMatch && !baselineMatch) return false

    const projectId = Number((projectMatch || activityMatch || dependencyMatch || blockerMatch || baselineMatch)[1])
    const user = await userFrom(req)
    if (!user) { send(res,401,{error:'Não autenticado'}); return true }
    if (!(await access(user,projectId))) { send(res,403,{error:'Sem acesso'}); return true }

    if (projectMatch && req.method === 'GET') {
      send(res,200,await bundle(projectId)); return true
    }
    if (!staff(user)) { send(res,403,{error:'Somente a equipe técnica pode alterar o planejamento.'}); return true }

    if (baselineMatch && req.method === 'POST') {
      const body=await readJson(req),name=String(body?.name||'Baseline').trim().slice(0,120)||'Baseline'
      const rows=await pool.query(`SELECT id,wbs_code,title,planned_start,planned_end,duration_days,planned_cost,planned_quantity,unit,percent_complete FROM os_tasks WHERE project_id=$1 AND status<>'na' ORDER BY task_order,id`,[projectId])
      if(!rows.rowCount){send(res,400,{error:'Não há atividades para registrar na baseline.'});return true}
      const snapshot={capturedAt:new Date().toISOString(),activities:rows.rows}
      const q=await pool.query(`INSERT INTO activity_baselines(project_id,name,snapshot,created_by) VALUES($1,$2,$3,$4) RETURNING id,name,snapshot,created_at`,[projectId,name,snapshot,user.id])
      await event(projectId,user.id,`Baseline registrada: ${name}`,`${rows.rowCount} atividade(s) preservadas para comparação.`)
      send(res,201,{baseline:q.rows[0]});return true
    }

    if (activityMatch && req.method === 'PATCH') {
      const activityId = Number(activityMatch[2])
      const current = await activityExists(projectId,activityId)
      if (!current) { send(res,404,{error:'Atividade não encontrada'}); return true }
      const body = await readJson(req)
      if (!body) { send(res,400,{error:'Dados inválidos'}); return true }
      const plannedStart = body.plannedStart === undefined ? current.planned_start : dateOrNull(body.plannedStart)
      const plannedEnd = body.plannedEnd === undefined ? current.planned_end : dateOrNull(body.plannedEnd)
      if (plannedStart && plannedEnd && plannedEnd < plannedStart) { send(res,400,{error:'A data final não pode ser anterior ao início.'}); return true }
      const durationDays = plannedStart && plannedEnd ? Math.max(1,Math.round((new Date(`${plannedEnd}T12:00:00`)-new Date(`${plannedStart}T12:00:00`))/86400000)+1) : null
      const percent = body.percentComplete === undefined ? Number(current.percent_complete || 0) : Math.max(0,Math.min(100,Number(body.percentComplete)||0))
      const quantity = body.plannedQuantity === undefined ? current.planned_quantity : (body.plannedQuantity === '' ? null : Number(body.plannedQuantity))
      const unit = body.unit === undefined ? current.unit : String(body.unit||'').trim().slice(0,30)||null
      const cost = body.plannedCost === undefined ? Number(current.planned_cost||0) : Math.max(0,Number(body.plannedCost)||0)
      const wbs = body.wbsCode === undefined ? current.wbs_code : String(body.wbsCode||'').trim().slice(0,40)||null
      const q = await pool.query(`UPDATE os_tasks SET wbs_code=$1,planned_start=$2,planned_end=$3,duration_days=$4,percent_complete=$5,planned_quantity=$6,unit=$7,planned_cost=$8,updated_at=now() WHERE id=$9 AND project_id=$10 RETURNING *`, [wbs,plannedStart,plannedEnd,durationDays,percent,quantity,unit,cost,activityId,projectId])
      await event(projectId,user.id,`Planejamento atualizado: ${current.title}`,`Período: ${plannedStart||'não informado'} a ${plannedEnd||'não informado'} · avanço informado: ${percent}%`)
      send(res,200,{activity:q.rows[0]}); return true
    }

    if (dependencyMatch && req.method === 'POST' && !dependencyMatch[2]) {
      const body = await readJson(req)
      if (!body) { send(res,400,{error:'Dados inválidos'}); return true }
      const predecessorId = Number(body.predecessorId), successorId = Number(body.successorId)
      const type = DEPENDENCY_TYPES.has(body.dependencyType) ? body.dependencyType : 'FS'
      const lag = Math.max(-365,Math.min(365,Number(body.lagDays)||0))
      const [predecessor,successor,current] = await Promise.all([activityExists(projectId,predecessorId),activityExists(projectId,successorId),pool.query('SELECT predecessor_id,successor_id FROM activity_dependencies WHERE project_id=$1',[projectId])])
      if (!predecessor || !successor) { send(res,400,{error:'Selecione duas atividades da mesma obra.'}); return true }
      if (wouldCreateCycle(current.rows,predecessorId,successorId)) { send(res,409,{error:'Essa relação criaria um ciclo no planejamento.'}); return true }
      const q = await pool.query(`INSERT INTO activity_dependencies(project_id,predecessor_id,successor_id,dependency_type,lag_days,created_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(project_id,predecessor_id,successor_id) DO UPDATE SET dependency_type=EXCLUDED.dependency_type,lag_days=EXCLUDED.lag_days RETURNING *`, [projectId,predecessorId,successorId,type,lag,user.id])
      await event(projectId,user.id,`Dependência criada: ${predecessor.title} → ${successor.title}`,`${type}${lag?` · defasagem ${lag} dia(s)`:''}`)
      send(res,201,{dependency:q.rows[0]}); return true
    }
    if (dependencyMatch && req.method === 'DELETE' && dependencyMatch[2]) {
      const q = await pool.query('DELETE FROM activity_dependencies WHERE id=$1 AND project_id=$2 RETURNING id',[Number(dependencyMatch[2]),projectId])
      if (!q.rowCount) { send(res,404,{error:'Dependência não encontrada'}); return true }
      send(res,200,{ok:true}); return true
    }

    if (blockerMatch && req.method === 'POST' && !blockerMatch[2]) {
      const body = await readJson(req)
      if (!body) { send(res,400,{error:'Dados inválidos'}); return true }
      const activityId = Number(body.activityId)
      const activity = await activityExists(projectId,activityId)
      const title = String(body.title||'').trim().slice(0,180)
      const type = BLOCKER_TYPES.has(body.blockerType) ? body.blockerType : 'outro'
      if (!activity || !title) { send(res,400,{error:'Informe a atividade e o motivo do bloqueio.'}); return true }
      const q = await pool.query(`INSERT INTO blockers(project_id,activity_id,blocker_type,title,description,due_date,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [projectId,activityId,type,title,String(body.description||'').trim().slice(0,800)||null,dateOrNull(body.dueDate),user.id])
      await event(projectId,user.id,`Atividade bloqueada: ${activity.title}`,title)
      send(res,201,{blocker:q.rows[0]}); return true
    }
    if (blockerMatch && req.method === 'PATCH' && blockerMatch[2]) {
      const q = await pool.query(`UPDATE blockers SET status='resolved',resolved_by=$1,resolved_at=now(),updated_at=now() WHERE id=$2 AND project_id=$3 AND status='active' RETURNING *`, [user.id,Number(blockerMatch[2]),projectId])
      if (!q.rowCount) { send(res,404,{error:'Bloqueio ativo não encontrado'}); return true }
      await event(projectId,user.id,'Bloqueio resolvido',q.rows[0].title)
      send(res,200,{blocker:q.rows[0]}); return true
    }

    send(res,405,{error:'Método não permitido'}); return true
  }
}
