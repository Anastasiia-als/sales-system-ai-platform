const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_CONFIG = {
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.aayqydcdfxhlwizhfjun',
  password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function applyMigration() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  const migrationPath = path.join(__dirname, '../supabase/migrations/20260826000014_billing_invoices_phase5c2.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Applying migration 20260826000014_billing_invoices_phase5c2.sql...');
  await client.query(sql);
  console.log('✔ Phase 5C.2 SQL Migration applied successfully.');

  await client.end();
}

applyMigration().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
