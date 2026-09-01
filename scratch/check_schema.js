const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });
pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'automation_rules'").then(res => { console.log(res.rows); pool.end(); });
