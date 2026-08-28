const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });
pool.query(`SELECT polname, pg_get_expr(polqual, polrelid) as qual FROM pg_policy WHERE polrelid = 'public.project_templates'::regclass`).then(r => { console.log(r.rows); pool.end(); });
