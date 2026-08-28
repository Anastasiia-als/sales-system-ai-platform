const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });
pool.query(`SELECT id, global_role FROM public.profiles WHERE global_role IN ('specialist', 'client')`).then(r => { console.log(r.rows); pool.end(); });
