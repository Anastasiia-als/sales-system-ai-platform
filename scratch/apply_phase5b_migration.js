const fs = require('fs');
const { Client } = require('pg');

async function applyPhase5bMigration() {
  const sql = fs.readFileSync('supabase/migrations/20260824000011_notifications_personal_inbox_phase5b.sql', 'utf8');
  const client = new Client({
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.aayqydcdfxhlwizhfjun',
    password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL. Applying Phase 5B Migration...');
  await client.query(sql);
  console.log('✔ Phase 5B Migration applied successfully!');

  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications'");
  console.log('Table check:', tables.rows);

  const funcs = await client.query("SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('create_internal_notification', 'mark_notification_as_read', 'mark_all_notifications_as_read', 'get_unread_notifications_count', 'evaluate_notifications')");
  console.log('Functions check:', funcs.rows.map(r => r.routine_name));

  await client.end();
}

applyPhase5bMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
