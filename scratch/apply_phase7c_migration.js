const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const c = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function applyMigration() {
    await c.connect();
    console.log('Applying Phase 7C Migration: 20260907000031_phase7c_calendar_feed.sql...');

    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260907000031_phase7c_calendar_feed.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await c.query(sql);
    console.log('Successfully applied Phase 7C Migration!');
    await c.end();
}

applyMigration().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
