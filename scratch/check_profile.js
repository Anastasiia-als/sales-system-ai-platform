const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });
pool.query("SELECT p.id, p.organization_id FROM profiles p JOIN auth.users u ON p.id = u.id WHERE u.email = 'anzaitseva96@gmail.com'").then(res => { console.log(res.rows); pool.end(); });
