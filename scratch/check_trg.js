const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });
pool.query("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'prevent_update_delete'").then(res => { console.log(res.rows[0].pg_get_functiondef); pool.end(); });
