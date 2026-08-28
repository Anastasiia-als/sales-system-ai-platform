const fs = require('fs');
const { Client } = require('pg');

async function applyMigration() {
  const sql = fs.readFileSync('supabase/migrations/20260823000009_client_portal_access_rls.sql', 'utf8');
  const client = new Client({
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.aayqydcdfxhlwizhfjun',
    password: '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to DB. Applying migration...');
  await client.query(sql);
  console.log('Migration applied successfully!');
  
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_portal_access'");
  console.log('Table check:', tables.rows);
  
  const funcs = await client.query("SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('is_active_client_user', 'can_client_access_project', 'complete_client_action', 'activate_client_portal_access')");
  console.log('Functions check:', funcs.rows);

  await client.end();
}

applyMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
