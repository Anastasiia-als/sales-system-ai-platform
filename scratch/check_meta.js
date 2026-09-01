const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });
pool.query("SELECT raw_user_meta_data FROM auth.users WHERE email = 'anzaitseva96@gmail.com'").then(res => { console.log(res.rows[0].raw_user_meta_data); pool.end(); });
