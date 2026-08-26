const { Client } = require('pg');

const DB_CONFIG = {
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.aayqydcdfxhlwizhfjun',
  password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function listProjects() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  const res = await client.query(`SELECT id, organization_id, name, title FROM public.projects;`);
  console.log('PROJECTS:', res.rows);
  const orgs = await client.query(`SELECT id, name FROM public.organizations;`);
  console.log('ORGS:', orgs.rows);
  await client.end();
}

listProjects();
