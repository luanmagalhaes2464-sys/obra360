export const MOTOR_MIGRATION_VERSION = '2026.09.21-motor-01'
export const FIELD_MIGRATION_VERSION = '2026.09.21-field-01'
export const CAPACITY_MIGRATION_VERSION = '2026.09.21-capacity-01'
export const GOVERNANCE_MIGRATION_VERSION = '2026.09.21-governance-01'
export const ADVANCED_PLANNING_MIGRATION_VERSION = '2026.09.21-planning-02'

export const MOTOR_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations(
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies(
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_users(
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(company_id,user_id)
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS wbs_code TEXT;
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS planned_start DATE;
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS planned_end DATE;
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS duration_days INTEGER CHECK(duration_days IS NULL OR duration_days >= 0);
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS actual_start DATE;
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS actual_end DATE;
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS percent_complete NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK(percent_complete >= 0 AND percent_complete <= 100);
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS planned_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(planned_cost >= 0);
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(actual_cost >= 0);
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS planned_quantity NUMERIC(14,3);
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS actual_quantity NUMERIC(14,3);
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS planned_productivity NUMERIC(14,4);
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS actual_productivity NUMERIC(14,4);
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS baseline JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS delay_reason TEXT;
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS impact_note TEXT;
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE os_tasks ADD COLUMN IF NOT EXISTS workforce_trade TEXT;

CREATE TABLE IF NOT EXISTS activity_dependencies(
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  predecessor_id INTEGER NOT NULL REFERENCES os_tasks(id) ON DELETE CASCADE,
  successor_id INTEGER NOT NULL REFERENCES os_tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'FS' CHECK(dependency_type IN ('FS','SS','FF','SF')),
  lag_days INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id,predecessor_id,successor_id),
  CHECK(predecessor_id <> successor_id)
);
CREATE TABLE IF NOT EXISTS activity_baselines(
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blockers(
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_id INTEGER NOT NULL REFERENCES os_tasks(id) ON DELETE CASCADE,
  blocker_type TEXT NOT NULL CHECK(blocker_type IN ('predecessora','projeto','documento','aprovacao','cliente','material','equipamento','mao_de_obra','sst','fornecedor','inspecao','decisao','outro')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','resolved','cancelled')),
  due_date DATE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workers(
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trade TEXT,
  specialties JSONB NOT NULL DEFAULT '[]'::jsonb,
  availability_status TEXT NOT NULL DEFAULT 'available',
  contractor TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS teams(
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trade TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS team_members(
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
  left_at DATE,
  PRIMARY KEY(team_id,worker_id,joined_at)
);
CREATE TABLE IF NOT EXISTS allocations(
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_id INTEGER REFERENCES os_tasks(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  allocation_percent NUMERIC(5,2) NOT NULL DEFAULT 100 CHECK(allocation_percent > 0 AND allocation_percent <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(team_id IS NOT NULL OR worker_id IS NOT NULL),
  CHECK(end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS daily_reports(
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  weather TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','confirmed')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id,report_date)
);
CREATE TABLE IF NOT EXISTS productivity_records(
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_id INTEGER NOT NULL REFERENCES os_tasks(id) ON DELETE CASCADE,
  daily_report_id INTEGER REFERENCES daily_reports(id) ON DELETE SET NULL,
  record_date DATE NOT NULL,
  quantity NUMERIC(14,3) NOT NULL CHECK(quantity >= 0),
  unit TEXT NOT NULL,
  worked_hours NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK(worked_hours >= 0),
  worker_count INTEGER NOT NULL DEFAULT 0 CHECK(worker_count >= 0),
  downtime_hours NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK(downtime_hours >= 0),
  downtime_reason TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS daily_report_workers(
  id SERIAL PRIMARY KEY,
  daily_report_id INTEGER NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
  role_label TEXT,
  presence_status TEXT NOT NULL DEFAULT 'present' CHECK(presence_status IN ('present','absent','partial')),
  hours_worked NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK(hours_worked >= 0),
  notes TEXT
);
CREATE TABLE IF NOT EXISTS occurrences(
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_id INTEGER REFERENCES os_tasks(id) ON DELETE SET NULL,
  daily_report_id INTEGER REFERENCES daily_reports(id) ON DELETE SET NULL,
  occurrence_type TEXT NOT NULL CHECK(occurrence_type IN ('chuva','falta_material','falta_trabalhador','acidente_incidente','retrabalho','atraso_fornecedor','mudanca_projeto','equipamento_quebrado','interferencia','erro_execucao','paralisacao','outro')),
  title TEXT NOT NULL,
  description TEXT,
  impact_days NUMERIC(8,2),
  impact_cost NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'recorded' CHECK(status IN ('recorded','reviewed','closed')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safety_requirements(
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  requirement_type TEXT NOT NULL DEFAULT 'control',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id,code)
);
CREATE TABLE IF NOT EXISTS activity_safety_requirements(
  activity_id INTEGER NOT NULL REFERENCES os_tasks(id) ON DELETE CASCADE,
  requirement_id INTEGER NOT NULL REFERENCES safety_requirements(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','not_applicable')),
  verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  evidence_note TEXT,
  PRIMARY KEY(activity_id,requirement_id)
);

CREATE TABLE IF NOT EXISTS documents(
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  activity_id INTEGER REFERENCES os_tasks(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  number TEXT,
  title TEXT NOT NULL,
  valid_from DATE,
  valid_until DATE,
  responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS document_versions(
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  checksum TEXT,
  notes TEXT,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id,version_number)
);
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS file_size INTEGER CHECK(file_size IS NULL OR file_size >= 0);

CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id,id);
CREATE INDEX IF NOT EXISTS idx_company_users_user ON company_users(user_id,company_id) WHERE is_active=true;
CREATE INDEX IF NOT EXISTS idx_tasks_schedule ON os_tasks(project_id,planned_start,planned_end);
CREATE INDEX IF NOT EXISTS idx_dependencies_project ON activity_dependencies(project_id,successor_id,predecessor_id);
CREATE INDEX IF NOT EXISTS idx_baselines_project ON activity_baselines(project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blockers_active ON blockers(project_id,activity_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_allocations_period ON allocations(project_id,start_date,end_date);
CREATE INDEX IF NOT EXISTS idx_workers_company_trade ON workers(company_id,trade) WHERE active=true;
CREATE INDEX IF NOT EXISTS idx_productivity_activity_date ON productivity_records(activity_id,record_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_project_date ON daily_reports(project_id,report_date DESC);
CREATE INDEX IF NOT EXISTS idx_occurrences_project_date ON occurrences(project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id,document_type,status);
`

export async function migrateMotor(pool) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(MOTOR_SCHEMA_SQL)
    const company = await client.query(`INSERT INTO companies(name,slug) VALUES('VIÇO','vico') ON CONFLICT(slug) DO UPDATE SET updated_at=now() RETURNING id`)
    const companyId = company.rows[0].id
    await client.query('UPDATE projects SET company_id=$1 WHERE company_id IS NULL', [companyId])
    await client.query(`INSERT INTO company_users(company_id,user_id,role)
      SELECT $1,id,CASE WHEN role='admin' THEN 'company_admin' WHEN role='team' THEN 'team' ELSE 'client' END FROM users
      ON CONFLICT(company_id,user_id) DO NOTHING`, [companyId])
    await client.query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT(version) DO NOTHING', [MOTOR_MIGRATION_VERSION])
    await client.query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT(version) DO NOTHING', [FIELD_MIGRATION_VERSION])
    await client.query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT(version) DO NOTHING', [CAPACITY_MIGRATION_VERSION])
    await client.query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT(version) DO NOTHING', [GOVERNANCE_MIGRATION_VERSION])
    await client.query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT(version) DO NOTHING', [ADVANCED_PLANNING_MIGRATION_VERSION])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
