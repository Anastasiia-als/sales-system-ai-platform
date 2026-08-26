const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DB_CONFIG = {
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.aayqydcdfxhlwizhfjun',
  password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function runMigration() {
  const client = new Client(DB_CONFIG);
  await client.connect();

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260824000013_finance_foundation_phase5c1.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('--- Applying Phase 5C.1 Finance Foundation Migration ---');
  await client.query(sql);
  console.log('✔ Migration 20260824000013 applied successfully.');

  await client.end();
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
