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

    const sqlPath = path.join(__dirname, '../supabase/migrations/20260826000015_analytics_reports_phase5d.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying migration 20260826000015_analytics_reports_phase5d.sql...');
    await client.query(sql);
    console.log('Migration applied successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
