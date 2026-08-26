const { Client } = require('pg');

const DB_CONFIG = {
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.aayqydcdfxhlwizhfjun',
  password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function addAuditImmutabilityTrigger() {
  const client = new Client(DB_CONFIG);
  await client.connect();

  await client.query(`
    CREATE OR REPLACE FUNCTION public.prevent_finance_audit_tampering()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    BEGIN
      RAISE EXCEPTION 'Financial audit log is strictly immutable. UPDATE and DELETE are prohibited.'
        USING ERRCODE = '42501';
    END;
    $$;

    DROP TRIGGER IF EXISTS trg_prevent_finance_audit_tampering ON public.finance_audit_events;
    CREATE TRIGGER trg_prevent_finance_audit_tampering
      BEFORE UPDATE OR DELETE ON public.finance_audit_events
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_finance_audit_tampering();
  `);

  console.log('✔ Finance audit immutability trigger created successfully.');
  await client.end();
}

addAuditImmutabilityTrigger().catch(err => {
  console.error(err);
  process.exit(1);
});
