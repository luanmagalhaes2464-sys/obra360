import http from 'http'
import { spawn } from 'child_process'
import jwt from 'jsonwebtoken'
import pg from 'pg'
import { parseCookies } from './lib/http-safety.mjs'
import { migrateMotor } from './lib/motor-schema.mjs'
import { createMotorRoutes } from './lib/motor-routes.mjs'
import { createFieldRoutes } from './lib/field-routes.mjs'
import { createWorkforceRoutes } from './lib/workforce-routes.mjs'
import { createGovernanceRoutes } from './lib/governance-routes.mjs'
import { createReportingRoutes } from './lib/reporting-routes.mjs'
import { createMunicipalRoutes } from './lib/municipal-routes.mjs'
import { createIntelligenceRoutes } from './lib/intelligence-routes.mjs'

const { Pool } = pg
const PORT = Number(process.env.PORT || 10000)
const CHILD_PORT = Number(process.env.TECNOMATA_CORE_PORT || 10001)
const DATABASE_URL = process.env.DATABASE_URL
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'
const COOKIE = 'obra360_session'

if (!DATABASE_URL) {
  console.error('DATABASE_URL ausente')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
})

async function migrateFinance() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS os_cost_entries(
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      stage_key TEXT,
      task_id INTEGER REFERENCES os_tasks(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'paid',
      category TEXT NOT NULL DEFAULT 'outros',
      description TEXT NOT NULL,
      supplier TEXT,
      amount NUMERIC(14,2) NOT NULL CHECK(amount >= 0),
      entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
      notes TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_os_cost_entries_project_date ON os_cost_entries(project_id,entry_date DESC,id DESC);
    CREATE INDEX IF NOT EXISTS idx_os_cost_entries_stage ON os_cost_entries(project_id,stage_key);
  `)
}

async function currentUser(req) {
  const token = parseCookies(req.headers.cookie || '')[COOKIE]
  if (!token) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const q = await pool.query('SELECT id,name,email,role FROM users WHERE id=$1', [payload.id])
    return q.rows[0] || null
  } catch {
    return null
  }
}

async function canAccess(user, projectId) {
  if (!user) return false
  if (user.role === 'admin') return true
  const q = await pool.query(`SELECT 1 FROM projects p
    LEFT JOIN company_users cu ON cu.company_id=p.company_id AND cu.user_id=$2 AND cu.is_active=true
    LEFT JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2
    WHERE p.id=$1 AND (($3='team' AND cu.user_id IS NOT NULL AND cu.role<>'client') OR pm.user_id IS NOT NULL)`, [projectId, user.id, user.role])
  return q.rowCount > 0
}

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body))
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(data.length),
    'Cache-Control': 'no-store',
  })
  res.end(data)
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return null }
}

async function recalcProject(projectId) {
  const q = await pool.query(`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE status='paid'),0) AS spent,
      COALESCE(SUM(amount) FILTER (WHERE status='committed'),0) AS committed
    FROM os_cost_entries WHERE project_id=$1
  `, [projectId])
  const spent = Number(q.rows[0]?.spent || 0)
  const committed = Number(q.rows[0]?.committed || 0)
  await pool.query('UPDATE projects SET spent=$1,committed=$2,updated_at=now() WHERE id=$3', [spent, committed, projectId])
  return { spent, committed }
}

async function getFinance(projectId, canEdit) {
  const [entriesQ, projectQ] = await Promise.all([
    pool.query(`
      SELECT c.*,u.name created_by_name,t.title task_title
      FROM os_cost_entries c
      LEFT JOIN users u ON u.id=c.created_by
      LEFT JOIN os_tasks t ON t.id=c.task_id
      WHERE c.project_id=$1
      ORDER BY c.entry_date DESC,c.id DESC
      LIMIT 250
    `, [projectId]),
    pool.query('SELECT budget,spent,committed FROM projects WHERE id=$1', [projectId]),
  ])
  const p = projectQ.rows[0] || { budget: 0, spent: 0, committed: 0 }
  const budget = Number(p.budget || 0)
  const spent = Number(p.spent || 0)
  const committed = Number(p.committed || 0)
  return {
    entries: entriesQ.rows,
    totals: { budget, spent, committed, available: budget - spent - committed },
    canEdit,
  }
}

async function handleCosts(req, res, projectId, costId) {
  const user = await currentUser(req)
  if (!user) return json(res, 401, { error: 'Não autenticado' })
  if (!(await canAccess(user, projectId))) return json(res, 403, { error: 'Sem acesso' })
  const isStaff = ['admin', 'team'].includes(user.role)

  if (req.method === 'GET' && !costId) {
    await recalcProject(projectId)
    return json(res, 200, await getFinance(projectId, isStaff))
  }

  if (!isStaff) return json(res, 403, { error: 'Somente a equipe técnica pode alterar movimentações financeiras.' })

  if (req.method === 'POST' && !costId) {
    const body = await readJson(req)
    if (!body) return json(res, 400, { error: 'Dados inválidos' })
    const description = String(body.description || '').trim().slice(0, 220)
    const amount = Number(body.amount)
    const status = body.status === 'committed' ? 'committed' : 'paid'
    const category = ['material','mao_de_obra','servico','equipamento','taxa','projeto','outros'].includes(body.category) ? body.category : 'outros'
    const stageKey = String(body.stageKey || '').trim().slice(0, 80) || null
    const taskId = Number(body.taskId) || null
    const supplier = String(body.supplier || '').trim().slice(0, 160) || null
    const entryDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.entryDate || '')) ? body.entryDate : new Date().toISOString().slice(0,10)
    const notes = String(body.notes || '').trim().slice(0, 500) || null
    if (!description) return json(res, 400, { error: 'Informe o que foi comprado, contratado ou pago.' })
    if (!Number.isFinite(amount) || amount <= 0) return json(res, 400, { error: 'Informe um valor maior que zero.' })
    if (taskId) {
      const tq = await pool.query('SELECT 1 FROM os_tasks WHERE id=$1 AND project_id=$2', [taskId, projectId])
      if (!tq.rowCount) return json(res, 400, { error: 'O item selecionado não pertence a esta obra.' })
    }
    const q = await pool.query(`
      INSERT INTO os_cost_entries(project_id,stage_key,task_id,status,category,description,supplier,amount,entry_date,notes,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [projectId, stageKey, taskId, status, category, description, supplier, amount, entryDate, notes, user.id])
    const totals = await recalcProject(projectId)
    await pool.query(`INSERT INTO os_events(project_id,event_type,title,description,created_by) VALUES($1,'finance',$2,$3,$4)`, [
      projectId,
      status === 'paid' ? `Custo realizado: ${description}` : `Compromisso financeiro: ${description}`,
      `Valor: R$ ${amount.toFixed(2)}${stageKey ? ` · Etapa: ${stageKey}` : ''}`,
      user.id,
    ])
    return json(res, 201, { entry: q.rows[0], totals })
  }

  if (req.method === 'PATCH' && costId) {
    const body = await readJson(req)
    if (!body) return json(res, 400, { error: 'Dados inválidos' })
    const existing = await pool.query('SELECT * FROM os_cost_entries WHERE id=$1 AND project_id=$2', [costId, projectId])
    if (!existing.rowCount) return json(res, 404, { error: 'Movimentação não encontrada' })
    const current = existing.rows[0]
    const status = body.status === 'paid' || body.status === 'committed' ? body.status : current.status
    const description = body.description !== undefined ? String(body.description || '').trim().slice(0,220) : current.description
    const amount = body.amount !== undefined ? Number(body.amount) : Number(current.amount)
    if (!description || !Number.isFinite(amount) || amount <= 0) return json(res, 400, { error: 'Descrição e valor são obrigatórios.' })
    await pool.query('UPDATE os_cost_entries SET status=$1,description=$2,amount=$3,updated_at=now() WHERE id=$4 AND project_id=$5', [status, description, amount, costId, projectId])
    const totals = await recalcProject(projectId)
    return json(res, 200, { ok: true, totals })
  }

  if (req.method === 'DELETE' && costId) {
    const q = await pool.query('DELETE FROM os_cost_entries WHERE id=$1 AND project_id=$2 RETURNING id', [costId, projectId])
    if (!q.rowCount) return json(res, 404, { error: 'Movimentação não encontrada' })
    const totals = await recalcProject(projectId)
    return json(res, 200, { ok: true, totals })
  }

  return json(res, 405, { error: 'Método não permitido' })
}

await migrateFinance()
await migrateMotor(pool)
const handleMotorRequest = createMotorRoutes({ pool, jwtSecret: JWT_SECRET, cookieName: COOKIE })
const handleFieldRequest = createFieldRoutes({ pool, jwtSecret: JWT_SECRET, cookieName: COOKIE, geminiApiKey: process.env.GEMINI_API_KEY })
const handleWorkforceRequest = createWorkforceRoutes({ pool, jwtSecret: JWT_SECRET, cookieName: COOKIE })
const handleGovernanceRequest = createGovernanceRoutes({ pool, jwtSecret: JWT_SECRET, cookieName: COOKIE })
const handleReportingRequest = createReportingRoutes({ pool, jwtSecret: JWT_SECRET, cookieName: COOKIE })
const handleMunicipalRequest = createMunicipalRoutes({ pool, jwtSecret: JWT_SECRET, cookieName: COOKIE })
const handleIntelligenceRequest = createIntelligenceRoutes({ pool, jwtSecret: JWT_SECRET, cookieName: COOKIE, geminiApiKey: process.env.GEMINI_API_KEY })

const child = spawn(process.execPath, ['server-launcher-safe-v2.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  console.error('Núcleo VIÇO encerrado', { code, signal })
  process.exit(code || 1)
})

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost')
    if (await handleMotorRequest(req, res, url)) return
    if (await handleFieldRequest(req, res, url)) return
    if (await handleWorkforceRequest(req, res, url)) return
    if (await handleGovernanceRequest(req, res, url)) return
    if (await handleReportingRequest(req, res, url)) return
    if (await handleMunicipalRequest(req, res, url)) return
    if (await handleIntelligenceRequest(req, res, url)) return
    const match = url.pathname.match(/^\/api\/os\/projects\/(\d+)\/costs(?:\/(\d+))?\/?$/)
    if (match) return await handleCosts(req, res, Number(match[1]), match[2] ? Number(match[2]) : null)
  } catch (e) {
    console.error('finance-route', e)
    if (!res.headersSent) return json(res, 500, { error: 'Falha ao processar movimentação financeira.' })
  }

  const headers = { ...req.headers, host: `127.0.0.1:${CHILD_PORT}` }
  const proxy = http.request({
    hostname: '127.0.0.1',
    port: CHILD_PORT,
    path: req.url,
    method: req.method,
    headers,
  }, upstream => {
    res.writeHead(upstream.statusCode || 502, upstream.headers)
    upstream.pipe(res)
  })
  proxy.on('error', err => {
    console.error('proxy-core', err.message)
    if (!res.headersSent) json(res, 502, { error: 'Núcleo do portal ainda está iniciando. Tente novamente em alguns segundos.' })
    else res.end()
  })
  req.pipe(proxy)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Gateway VIÇO ativo na porta ${PORT}; núcleo na ${CHILD_PORT}`)
})

async function shutdown() {
  try { child.kill('SIGTERM') } catch {}
  try { await pool.end() } catch {}
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 5000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
