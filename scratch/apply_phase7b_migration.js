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

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');

    const sqlPath = path.join(__dirname, '../supabase/migrations/20260907000030_phase7b_telegram_integration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying migration 20260907000030_phase7b_telegram_integration.sql...');
    await client.query(sql);
    console.log('Phase 7B migration applied successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
