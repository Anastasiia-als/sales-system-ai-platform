const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });
pool.query("SELECT * FROM organizations WHERE id = '59f079d0-c8c9-4703-88a7-c4934f64b69e'").then(res => { console.log(res.rows); pool.end(); });
