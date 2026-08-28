const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });
client.connect().then(() => {
  return client.query("SELECT * FROM invoices WHERE currency = 'CZK'");
}).then(res => {
  console.log('INVOICES CZK:', res.rows);
  return client.query("SELECT * FROM project_payments WHERE currency = 'CZK'");
}).then(res => {
  console.log('PAYMENTS CZK:', res.rows);
  return client.query("SELECT * FROM project_commercial_terms WHERE currency = 'CZK'");
}).then(res => {
  console.log('TERMS CZK:', res.rows);
  client.end();
}).catch(console.error);
