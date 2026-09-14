import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 10000)
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'
const COOKIE_NAME = 'obra360_session'
const DATABASE_URL = process.env.DATABASE_URL
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-terra'

if (!DATABASE_URL) {
  console.error('DATABASE_URL ausente')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
})

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin','team','client')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT,
        address TEXT,
        client_name TEXT,
        status TEXT NOT NULL DEFAULT 'planejamento',
        start_date DATE,
        planned_end_date DATE,
        budget NUMERIC(14,2) NOT NULL DEFAULT 0,
        committed NUMERIC(14,2) NOT NULL DEFAULT 0,
        spent NUMERIC(14,2) NOT NULL DEFAULT 0,
        progress NUMERIC(5,2) NOT NULL DEFAULT 0,
        planned_progress NUMERIC(5,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS project_members (
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        member_role TEXT NOT NULL DEFAULT 'client',
        PRIMARY KEY (project_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS phases (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        planned_start DATE,
        planned_end DATE,
        actual_start DATE,
        actual_end DATE,
        planned_progress NUMERIC(5,2) NOT NULL DEFAULT 0,
        actual_progress NUMERIC(5,2) NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'nao_iniciada',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'tecnico',
        status TEXT NOT NULL DEFAULT 'pendente',
        required_for_phase TEXT,
        expires_at DATE,
        version TEXT,
        url TEXT,
        responsible TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS safety_items (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'inspecao',
        severity TEXT NOT NULL DEFAULT 'media' CHECK (severity IN ('baixa','media','alta','critica')),
        status TEXT NOT NULL DEFAULT 'aberta',
        due_date DATE,
        standard_ref TEXT,
        description TEXT,
        responsible TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS project_events (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL DEFAULT 'atualizacao',
        title TEXT NOT NULL,
        description TEXT,
        happened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS decisions (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        cost_impact NUMERIC(14,2) NOT NULL DEFAULT 0,
        days_impact INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando','aprovada','rejeitada','cancelada')),
        due_date DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        decided_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS costs (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        description TEXT,
        planned NUMERIC(14,2) NOT NULL DEFAULT 0,
        committed NUMERIC(14,2) NOT NULL DEFAULT 0,
        spent NUMERIC(14,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_events_project_date ON project_events(project_id, happened_at DESC);
      CREATE INDEX IF NOT EXISTS idx_docs_project ON documents(project_id);
      CREATE INDEX IF NOT EXISTS idx_safety_project ON safety_items(project_id);
    `)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  const adminName = process.env.ADMIN_NAME || 'Equipe Obra360'
  if (adminEmail && adminPassword) {
    const hash = await bcrypt.hash(adminPassword, 12)
    await pool.query(
      `INSERT INTO users (name,email,password_hash,role)
       VALUES ($1,$2,$3,'admin')
       ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name, role='admin'`,
      [adminName, adminEmail.toLowerCase(), hash],
    )
  }
}

function signUser(user) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' })
}

function auth(req, res, next) {
  const token = req.cookies[COOKIE_NAME]
  if (!token) return res.status(401).json({ error: 'Não autenticado' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Sessão expirada' })
  }
}

function staffOnly(req, res, next) {
  if (!['admin', 'team'].includes(req.user?.role)) return res.status(403).json({ error: 'Acesso restrito à equipe técnica' })
  next()
}

async function canAccessProject(user, projectId) {
  if (['admin', 'team'].includes(user.role)) return true
  const { rowCount } = await pool.query('SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2', [projectId, user.id])
  return rowCount > 0
}

function numeric(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

async function getProjectBundle(projectId) {
  const [projectQ, phasesQ, docsQ, safetyQ, eventsQ, decisionsQ, costsQ, membersQ] = await Promise.all([
    pool.query('SELECT * FROM projects WHERE id=$1', [projectId]),
    pool.query('SELECT * FROM phases WHERE project_id=$1 ORDER BY order_index,id', [projectId]),
    pool.query('SELECT * FROM documents WHERE project_id=$1 ORDER BY updated_at DESC,id DESC', [projectId]),
    pool.query("SELECT * FROM safety_items WHERE project_id=$1 ORDER BY CASE severity WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END, due_date NULLS LAST,id DESC", [projectId]),
    pool.query(`SELECT e.*, u.name AS author_name FROM project_events e LEFT JOIN users u ON u.id=e.created_by WHERE e.project_id=$1 ORDER BY happened_at DESC LIMIT 100`, [projectId]),
    pool.query("SELECT * FROM decisions WHERE project_id=$1 ORDER BY CASE status WHEN 'aguardando' THEN 1 ELSE 2 END, due_date NULLS LAST,id DESC", [projectId]),
    pool.query('SELECT * FROM costs WHERE project_id=$1 ORDER BY category,id', [projectId]),
    pool.query(`SELECT u.id,u.name,u.email,u.role,pm.member_role FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1 ORDER BY u.name`, [projectId]),
  ])
  if (!projectQ.rows[0]) return null
  const project = projectQ.rows[0]
  const documents = docsQ.rows
  const safety = safetyQ.rows
  const decisions = decisionsQ.rows
  const phases = phasesQ.rows
  const costs = costsQ.rows

  const docsDone = documents.filter(d => ['aprovado', 'valido', 'concluido'].includes(String(d.status).toLowerCase())).length
  const documentCompliance = documents.length ? Math.round((docsDone / documents.length) * 100) : 100
  const criticalOpen = safety.filter(s => ['aberta', 'pendente'].includes(String(s.status).toLowerCase()) && ['critica', 'alta'].includes(s.severity)).length
  const safetyOpen = safety.filter(s => !['resolvida', 'concluida', 'fechada'].includes(String(s.status).toLowerCase())).length
  const pendingDecisions = decisions.filter(d => d.status === 'aguardando').length
  const budget = numeric(project.budget)
  const spent = numeric(project.spent)
  const progress = numeric(project.progress)
  const plannedProgress = numeric(project.planned_progress)
  const progressVariance = progress - plannedProgress
  const financialUsage = budget ? Math.round((spent / budget) * 1000) / 10 : 0
  const totalOpenBlockers = criticalOpen + pendingDecisions + documents.filter(d => String(d.status).toLowerCase() === 'pendente' && d.required_for_phase).length
  const safetyScore = Math.max(0, 100 - safety.reduce((sum, s) => {
    if (['resolvida', 'concluida', 'fechada'].includes(String(s.status).toLowerCase())) return sum
    return sum + ({ critica: 30, alta: 18, media: 8, baixa: 3 }[s.severity] || 5)
  }, 0))
  const scheduleScore = Math.max(0, Math.min(100, 100 + progressVariance * 2))
  const financeScore = budget ? Math.max(0, Math.min(100, 100 - Math.max(0, financialUsage - progress) * 1.5)) : 100
  const pulseScore = Math.round((documentCompliance + safetyScore + scheduleScore + financeScore) / 4)

  return {
    project,
    phases,
    documents,
    safety,
    events: eventsQ.rows,
    decisions,
    costs,
    members: membersQ.rows,
    metrics: { documentCompliance, safetyOpen, criticalOpen, pendingDecisions, progressVariance, financialUsage, safetyScore, scheduleScore, financeScore, pulseScore, totalOpenBlockers },
  }
}

function dateOrNull(v) { return v ? v : null }

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email])
  const user = rows[0]
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'E-mail ou senha inválidos' })
  const token = signUser(user)
  res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 })
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } })
})

app.post('/api/auth/logout', (_req, res) => { res.clearCookie(COOKIE_NAME); res.json({ ok: true }) })
app.get('/api/me', auth, async (req, res) => { const { rows } = await pool.query('SELECT id,name,email,role,created_at FROM users WHERE id=$1', [req.user.id]); res.json({ user: rows[0] }) })

app.get('/api/projects', auth, async (req, res) => {
  let q
  if (['admin', 'team'].includes(req.user.role)) q = await pool.query('SELECT * FROM projects ORDER BY updated_at DESC,id DESC')
  else q = await pool.query(`SELECT p.* FROM projects p JOIN project_members pm ON pm.project_id=p.id WHERE pm.user_id=$1 ORDER BY p.updated_at DESC,p.id DESC`, [req.user.id])
  res.json({ projects: q.rows })
})

app.get('/api/projects/:id/dashboard', auth, async (req, res) => {
  const projectId = Number(req.params.id)
  if (!(await canAccessProject(req.user, projectId))) return res.status(403).json({ error: 'Sem acesso a esta obra' })
  const bundle = await getProjectBundle(projectId)
  if (!bundle) return res.status(404).json({ error: 'Obra não encontrada' })
  res.json(bundle)
})

app.post('/api/projects', auth, staffOnly, async (req, res) => {
  const { name, city, address, clientName, startDate, plannedEndDate, budget } = req.body
  if (!name) return res.status(400).json({ error: 'Nome da obra é obrigatório' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(`INSERT INTO projects (name,city,address,client_name,start_date,planned_end_date,budget,status) VALUES ($1,$2,$3,$4,$5,$6,$7,'planejamento') RETURNING *`, [name, city || null, address || null, clientName || null, dateOrNull(startDate), dateOrNull(plannedEndDate), numeric(budget)])
    const project = rows[0]
    const phases = ['Pré-obra e projetos', 'Terraplenagem e fundações', 'Estrutura', 'Vedações e cobertura', 'Instalações', 'Acabamentos', 'Vistoria e entrega']
    for (let i = 0; i < phases.length; i++) await client.query('INSERT INTO phases (project_id,name,order_index,status) VALUES ($1,$2,$3,$4)', [project.id, phases[i], i + 1, i === 0 ? 'em_andamento' : 'nao_iniciada'])
    const docs = [
      ['Projeto arquitetônico', 'projeto', 'Pré-obra e projetos'],
      ['ART/RRT dos serviços contratados', 'responsabilidade_tecnica', 'Pré-obra e projetos'],
      ['Alvará/licença municipal — quando aplicável', 'legal', 'Pré-obra e projetos'],
      ['Projeto estrutural — quando aplicável', 'projeto', 'Estrutura'],
      ['Projetos elétrico e hidrossanitário — conforme escopo', 'projeto', 'Instalações'],
      ['PGR e documentos de SST — conforme enquadramento da obra', 'seguranca', 'Terraplenagem e fundações'],
      ['Comunicação Prévia de Obras — verificar aplicabilidade', 'seguranca', 'Pré-obra e projetos'],
    ]
    for (const d of docs) await client.query("INSERT INTO documents (project_id,title,category,status,required_for_phase) VALUES ($1,$2,$3,'pendente',$4)", [project.id, ...d])
    await client.query(`INSERT INTO project_events (project_id,event_type,title,description,created_by) VALUES ($1,'sistema','Obra criada','Estrutura inicial de fases e checklist documental criada automaticamente.',$2)`, [project.id, req.user.id])
    await client.query('COMMIT')
    res.status(201).json({ project })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Não foi possível criar a obra' })
  } finally { client.release() }
})

app.patch('/api/projects/:id', auth, staffOnly, async (req, res) => {
  const id = Number(req.params.id)
  const currentQ = await pool.query('SELECT * FROM projects WHERE id=$1', [id])
  const current = currentQ.rows[0]
  if (!current) return res.status(404).json({ error: 'Obra não encontrada' })
  const fields = ['name','city','address','client_name','status','start_date','planned_end_date','budget','committed','spent','progress','planned_progress']
  const values = [], sets = []
  const bodyMap = { clientName: 'client_name', startDate: 'start_date', plannedEndDate: 'planned_end_date', plannedProgress: 'planned_progress' }
  const normalized = { ...req.body }
  for (const [from, to] of Object.entries(bodyMap)) if (from in normalized) normalized[to] = normalized[from]
  for (const field of fields) if (field in normalized) { values.push(normalized[field] === '' ? null : normalized[field]); sets.push(`${field}=$${values.length}`) }
  if (!sets.length) return res.json({ project: current })
  values.push(id)
  const { rows } = await pool.query(`UPDATE projects SET ${sets.join(',')},updated_at=now() WHERE id=$${values.length} RETURNING *`, values)
  await pool.query(`INSERT INTO project_events(project_id,event_type,title,description,created_by) VALUES($1,'atualizacao','Indicadores da obra atualizados','Progresso, prazo ou valores da obra foram atualizados.',$2)`, [id, req.user.id])
  res.json({ project: rows[0] })
})

app.patch('/api/projects/:projectId/phases/:phaseId', auth, staffOnly, async (req, res) => {
  const { projectId, phaseId } = req.params
  const { actualProgress, plannedProgress, status, plannedStart, plannedEnd, actualStart, actualEnd } = req.body
  const { rows } = await pool.query(`UPDATE phases SET actual_progress=COALESCE($1,actual_progress),planned_progress=COALESCE($2,planned_progress),status=COALESCE($3,status),planned_start=COALESCE($4,planned_start),planned_end=COALESCE($5,planned_end),actual_start=COALESCE($6,actual_start),actual_end=COALESCE($7,actual_end) WHERE id=$8 AND project_id=$9 RETURNING *`, [actualProgress ?? null, plannedProgress ?? null, status ?? null, plannedStart || null, plannedEnd || null, actualStart || null, actualEnd || null, phaseId, projectId])
  res.json({ phase: rows[0] })
})

app.post('/api/projects/:id/events', auth, staffOnly, async (req, res) => {
  const { eventType='atualizacao', title, description, happenedAt, metadata={} } = req.body
  if (!title) return res.status(400).json({ error: 'Título obrigatório' })
  const { rows } = await pool.query(`INSERT INTO project_events(project_id,event_type,title,description,happened_at,created_by,metadata) VALUES($1,$2,$3,$4,COALESCE($5::timestamptz,now()),$6,$7) RETURNING *`, [req.params.id,eventType,title,description || null,happenedAt || null,req.user.id,metadata])
  await pool.query('UPDATE projects SET updated_at=now() WHERE id=$1', [req.params.id])
  res.status(201).json({ event: rows[0] })
})

app.post('/api/projects/:id/documents', auth, staffOnly, async (req, res) => {
  const { title, category='tecnico', status='pendente', requiredForPhase, expiresAt, version, url, responsible, notes } = req.body
  if (!title) return res.status(400).json({ error: 'Título obrigatório' })
  const { rows } = await pool.query(`INSERT INTO documents(project_id,title,category,status,required_for_phase,expires_at,version,url,responsible,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [req.params.id,title,category,status,requiredForPhase || null,expiresAt || null,version || null,url || null,responsible || null,notes || null])
  await pool.query(`INSERT INTO project_events(project_id,event_type,title,description,created_by) VALUES($1,'documento',$2,$3,$4)`, [req.params.id,`Documento registrado: ${title}`,`Status inicial: ${status}.`,req.user.id])
  res.status(201).json({ document: rows[0] })
})

app.patch('/api/projects/:projectId/documents/:documentId', auth, staffOnly, async (req, res) => {
  const { status, expiresAt, version, url, responsible, notes } = req.body
  const { rows } = await pool.query(`UPDATE documents SET status=COALESCE($1,status),expires_at=COALESCE($2,expires_at),version=COALESCE($3,version),url=COALESCE($4,url),responsible=COALESCE($5,responsible),notes=COALESCE($6,notes),updated_at=now() WHERE id=$7 AND project_id=$8 RETURNING *`, [status ?? null,expiresAt || null,version ?? null,url ?? null,responsible ?? null,notes ?? null,req.params.documentId,req.params.projectId])
  res.json({ document: rows[0] })
})

app.post('/api/projects/:id/safety', auth, staffOnly, async (req, res) => {
  const { title, category='inspecao', severity='media', status='aberta', dueDate, standardRef, description, responsible } = req.body
  if (!title) return res.status(400).json({ error: 'Título obrigatório' })
  const { rows } = await pool.query(`INSERT INTO safety_items(project_id,title,category,severity,status,due_date,standard_ref,description,responsible) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [req.params.id,title,category,severity,status,dueDate || null,standardRef || null,description || null,responsible || null])
  await pool.query(`INSERT INTO project_events(project_id,event_type,title,description,created_by) VALUES($1,'seguranca',$2,$3,$4)`, [req.params.id,`Segurança: ${title}`,description || `Item ${severity} registrado.`,req.user.id])
  res.status(201).json({ item: rows[0] })
})

app.patch('/api/projects/:projectId/safety/:itemId', auth, staffOnly, async (req, res) => {
  const { status, severity, dueDate, responsible, description } = req.body
  const { rows } = await pool.query(`UPDATE safety_items SET status=COALESCE($1,status),severity=COALESCE($2,severity),due_date=COALESCE($3,due_date),responsible=COALESCE($4,responsible),description=COALESCE($5,description),updated_at=now() WHERE id=$6 AND project_id=$7 RETURNING *`, [status ?? null,severity ?? null,dueDate || null,responsible ?? null,description ?? null,req.params.itemId,req.params.projectId])
  res.json({ item: rows[0] })
})

app.post('/api/projects/:id/decisions', auth, staffOnly, async (req, res) => {
  const { title, description, costImpact=0, daysImpact=0, dueDate } = req.body
  if (!title) return res.status(400).json({ error: 'Título obrigatório' })
  const { rows } = await pool.query(`INSERT INTO decisions(project_id,title,description,cost_impact,days_impact,due_date) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [req.params.id,title,description || null,numeric(costImpact),Number(daysImpact)||0,dueDate || null])
  await pool.query(`INSERT INTO project_events(project_id,event_type,title,description,created_by) VALUES($1,'decisao',$2,$3,$4)`, [req.params.id,`Decisão solicitada: ${title}`,description || 'Aguardando decisão do cliente.',req.user.id])
  res.status(201).json({ decision: rows[0] })
})

app.patch('/api/projects/:projectId/decisions/:decisionId', auth, async (req, res) => {
  const projectId = Number(req.params.projectId)
  if (!(await canAccessProject(req.user, projectId))) return res.status(403).json({ error: 'Sem acesso' })
  const status = req.body.status
  if (!['aprovada','rejeitada','cancelada'].includes(status)) return res.status(400).json({ error: 'Status inválido' })
  if (status === 'cancelada' && !['admin','team'].includes(req.user.role)) return res.status(403).json({ error: 'Apenas a equipe pode cancelar' })
  const { rows } = await pool.query(`UPDATE decisions SET status=$1,decided_at=now() WHERE id=$2 AND project_id=$3 RETURNING *`, [status,req.params.decisionId,projectId])
  if (!rows[0]) return res.status(404).json({ error: 'Decisão não encontrada' })
  await pool.query(`INSERT INTO project_events(project_id,event_type,title,description,created_by) VALUES($1,'decisao',$2,$3,$4)`, [projectId,`Decisão ${status}: ${rows[0].title}`,`Registro realizado por ${req.user.name}.`,req.user.id])
  res.json({ decision: rows[0] })
})

app.post('/api/projects/:id/costs', auth, staffOnly, async (req, res) => {
  const { category, description, planned=0, committed=0, spent=0 } = req.body
  if (!category) return res.status(400).json({ error: 'Categoria obrigatória' })
  const { rows } = await pool.query(`INSERT INTO costs(project_id,category,description,planned,committed,spent) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [req.params.id,category,description || null,numeric(planned),numeric(committed),numeric(spent)])
  res.status(201).json({ cost: rows[0] })
})

app.post('/api/projects/:id/users', auth, staffOnly, async (req, res) => {
  const { name, email, password, role='client' } = req.body
  if (!name || !email || !password) return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' })
  const hash = await bcrypt.hash(password, 12)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(`INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name RETURNING id,name,email,role`, [name,email.toLowerCase(),hash,role === 'team' ? 'team' : 'client'])
    const user = rows[0]
    await client.query(`INSERT INTO project_members(project_id,user_id,member_role) VALUES($1,$2,$3) ON CONFLICT(project_id,user_id) DO UPDATE SET member_role=EXCLUDED.member_role`, [req.params.id,user.id,role])
    await client.query('COMMIT')
    res.status(201).json({ user })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Não foi possível criar o acesso' })
  } finally { client.release() }
})

function formatCurrency(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(numeric(v)) }

function localAnswer(bundle, question) {
  const q = question.toLowerCase()
  const { project, documents, safety, events, decisions, phases, metrics } = bundle
  const pendingDocs = documents.filter(d => !['aprovado','valido','concluido'].includes(String(d.status).toLowerCase()))
  const openSafety = safety.filter(s => !['resolvida','concluida','fechada'].includes(String(s.status).toLowerCase()))
  const pendingDecisions = decisions.filter(d => d.status === 'aguardando')
  const currentPhase = phases.find(p => p.status === 'em_andamento') || phases.find(p => p.status !== 'concluida')
  const blockers = []
  pendingDocs.filter(d => d.required_for_phase === currentPhase?.name).slice(0,4).forEach(d => blockers.push(`Documento pendente: ${d.title}`))
  openSafety.filter(s => ['critica','alta'].includes(s.severity)).slice(0,4).forEach(s => blockers.push(`Segurança ${s.severity}: ${s.title}`))
  pendingDecisions.slice(0,4).forEach(d => blockers.push(`Decisão aguardando: ${d.title}`))
  if (/(document|art|rrt|alvar|pgr|licen)/.test(q)) return pendingDocs.length ? `Existem ${pendingDocs.length} documento(s) ainda não concluído(s). Os principais agora são: ${pendingDocs.slice(0,6).map(d => d.title).join('; ')}. A conformidade documental atual está em ${metrics.documentCompliance}%.` : `Não há documentos pendentes registrados no sistema neste momento. A conformidade documental está em ${metrics.documentCompliance}%.`
  if (/(seguran|risco|epi|epc|nr-?18|nr-?35|acidente)/.test(q)) return openSafety.length ? `Há ${openSafety.length} item(ns) de segurança em aberto, sendo ${metrics.criticalOpen} de severidade alta ou crítica. Prioridades: ${openSafety.slice(0,5).map(s => `${s.title} (${s.severity})`).join('; ')}.` : `Não há pendências de segurança abertas registradas. O indicador de segurança está em ${metrics.safetyScore}/100.`
  if (/(prazo|atras|cronograma|adiant)/.test(q)) { const delta = metrics.progressVariance; return `O avanço físico registrado é ${numeric(project.progress).toFixed(1)}% e o planejado é ${numeric(project.planned_progress).toFixed(1)}%. A diferença é ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} ponto(s) percentual(is). ${delta < -3 ? 'O sistema sinaliza atenção ao prazo.' : 'Não há desvio físico relevante apenas por este indicador.'}` }
  if (/(custo|orçament|gasto|finance|dinheiro|estour)/.test(q)) return `Orçamento registrado: ${formatCurrency(project.budget)}. Comprometido: ${formatCurrency(project.committed)}. Realizado: ${formatCurrency(project.spent)}. O realizado equivale a ${metrics.financialUsage}% do orçamento, enquanto o avanço físico está em ${numeric(project.progress).toFixed(1)}%.`
  if (/(mudou|semana|últim|histor|aconteceu)/.test(q)) { const recent = events.slice(0,6); return recent.length ? `Últimos registros da obra: ${recent.map(e => `${e.title}${e.description ? ` — ${e.description}` : ''}`).join(' | ')}` : 'Ainda não há histórico registrado nesta obra.' }
  if (/(avançar|proxima fase|próxima fase|liberar|pode entrar)/.test(q)) { if (!currentPhase) return 'Todas as fases cadastradas estão concluídas ou não há fase ativa definida.'; return blockers.length ? `A fase atual é “${currentPhase.name}”. Antes de avançar, o sistema encontrou ${blockers.length} ponto(s) que merecem validação: ${blockers.join('; ')}.` : `A fase atual é “${currentPhase.name}” e não há bloqueadores críticos cadastrados no sistema. Ainda assim, a liberação técnica da próxima etapa deve ser confirmada pela equipe responsável.` }
  return `Resumo da obra: pulso ${metrics.pulseScore}/100, avanço ${numeric(project.progress).toFixed(1)}% contra ${numeric(project.planned_progress).toFixed(1)}% planejado, ${pendingDocs.length} documento(s) pendente(s), ${openSafety.length} item(ns) de segurança aberto(s) e ${pendingDecisions.length} decisão(ões) aguardando. Pergunte sobre prazo, custos, documentos, segurança, histórico ou liberação de fase.`
}

app.post('/api/projects/:id/ai', auth, async (req, res) => {
  const projectId = Number(req.params.id)
  if (!(await canAccessProject(req.user, projectId))) return res.status(403).json({ error: 'Sem acesso' })
  const question = String(req.body.question || '').trim()
  if (!question) return res.status(400).json({ error: 'Pergunta vazia' })
  const bundle = await getProjectBundle(projectId)
  if (!bundle) return res.status(404).json({ error: 'Obra não encontrada' })
  const evidence = [
    ...bundle.events.slice(0,8).map(e => ({ type: 'histórico', label: e.title, date: e.happened_at })),
    ...bundle.documents.filter(d => String(d.status).toLowerCase() === 'pendente').slice(0,5).map(d => ({ type: 'documento', label: d.title, date: d.updated_at })),
    ...bundle.safety.filter(s => !['resolvida','fechada','concluida'].includes(String(s.status).toLowerCase())).slice(0,5).map(s => ({ type: 'segurança', label: s.title, date: s.updated_at })),
  ].slice(0,10)
  if (!OPENAI_API_KEY) return res.json({ answer: localAnswer(bundle, question), mode: 'grounded', evidence })
  try {
    const context = JSON.stringify({ project: bundle.project, metrics: bundle.metrics, phases: bundle.phases, documents: bundle.documents, safety: bundle.safety, decisions: bundle.decisions, costs: bundle.costs, recentEvents: bundle.events.slice(0,30) })
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions: 'Você é a Obra IA, assistente técnico do Portal Obra360. Responda em português do Brasil. Priorize os dados da obra fornecidos. Nunca invente documentos, medições, custos, normas aplicáveis ou fatos que não estejam no contexto. Separe claramente fato registrado de orientação geral. Para questões que exigem decisão de engenharia, arquitetura ou segurança do trabalho, explique o que os dados indicam e diga que a validação final cabe ao profissional responsável. Seja objetivo, útil e cite os registros relevantes pelo nome quando existirem.',
        input: `CONTEXTO DA OBRA:\n${context}\n\nPERGUNTA DO USUÁRIO:\n${question}`,
        max_output_tokens: 900,
      }),
    })
    if (!response.ok) throw new Error(`OpenAI ${response.status}`)
    const data = await response.json()
    let answer = data.output_text
    if (!answer && Array.isArray(data.output)) answer = data.output.flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('\n')
    res.json({ answer: answer || localAnswer(bundle, question), mode: answer ? 'ai' : 'grounded', evidence })
  } catch (err) {
    console.error('AI fallback', err)
    res.json({ answer: localAnswer(bundle, question), mode: 'grounded', evidence })
  }
})

const dist = path.join(__dirname, 'dist')
app.use(express.static(dist))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(dist, 'index.html'))
})

migrate()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`Obra360 Portal ativo na porta ${PORT}`)))
  .catch(err => { console.error('Falha na inicialização', err); process.exit(1) })
