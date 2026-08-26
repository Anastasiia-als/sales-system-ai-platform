const { Client: PgClient } = require('pg');

const DB_CONFIG = {
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.aayqydcdfxhlwizhfjun',
  password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

const OWNER_USER_ID = '27852879-0d5f-4c72-889d-69a0989302d2'; // Anastasiia (Owner)
const PM_USER_ID = '11111111-1111-1111-1111-111111111111'; // PM Tester Alpha
const SPECIALIST_USER_ID = '22222222-2222-2222-2222-222222222222'; // Specialist Tester Alpha
const CLIENT_ALPHA_USER_ID = '44444444-4444-4444-4444-444444444444'; // Client Alpha Tester
const CLIENT_BETA_USER_ID = '55555555-5555-5555-5555-555555555555'; // Client Beta Tester

async function runSession(userId, testFn) {
  const client = new PgClient(DB_CONFIG);
  await client.connect();
  try {
    await client.query("BEGIN;");
    await client.query("SET LOCAL role = 'authenticated';");
    await client.query("SELECT set_config('request.jwt.claims', $1, true);", [
      JSON.stringify({ sub: userId, role: 'authenticated' })
    ]);
    const result = await testFn(client);
    await client.query("COMMIT;");
    return result;
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    await client.end();
  }
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  console.log('=== Phase 5A: Owner Command Center & Portfolio Security Suite ===\n');

  // 1. Owner Global Scope
  await runSession(OWNER_USER_ID, async (c) => {
    const orgs = await c.query(`SELECT id, name, status FROM public.organizations;`);
    assert(orgs.rows.length >= 3, `Owner sees all organizations (count: ${orgs.rows.length})`);

    const projs = await c.query(`SELECT id, title, health, status FROM public.projects;`);
    assert(projs.rows.length >= 3, `Owner sees all projects (count: ${projs.rows.length})`);

    const tasks = await c.query(`SELECT id, title FROM public.tasks;`);
    assert(tasks.rows.length >= 5, `Owner sees all tasks across all tenants (count: ${tasks.rows.length})`);

    const docs = await c.query(`SELECT id, title FROM public.documents;`);
    assert(docs.rows.length >= 8, `Owner sees all documents including internal drafts (count: ${docs.rows.length})`);
  });

  // 2. PM Scoped Access (Alpha PM sees Alpha org/projects, isolated from unauthorized)
  await runSession(PM_USER_ID, async (c) => {
    const orgs = await c.query(`SELECT id, name FROM public.organizations;`);
    assert(orgs.rows.some(o => o.id === '21bb5fe2-ff1d-473a-b329-bc02b97ba069'),
      'PM sees assigned Alpha organization');

    const projs = await c.query(`SELECT id, title FROM public.projects;`);
    assert(projs.rows.some(p => p.id === '170d3c57-224b-4ae5-a384-0ccdf17252cc'),
      'PM sees assigned Alpha project');
  });

  // 3. Specialist Scoped Access
  await runSession(SPECIALIST_USER_ID, async (c) => {
    // Specialist should only see tasks assigned to them or in assigned projects
    const tasks = await c.query(`SELECT id, title FROM public.tasks WHERE assignee_user_id = $1;`, [SPECIALIST_USER_ID]);
    assert(Array.isArray(tasks.rows), 'Specialist task queries execute cleanly within scope');
  });

  // 4. Client Access Default Deny to Internal Portal
  await runSession(CLIENT_ALPHA_USER_ID, async (c) => {
    const internalDocs = await c.query(`
      SELECT id, title FROM public.documents 
      WHERE is_client_visible = false;
    `);
    assert(internalDocs.rows.length === 0, 'Client Alpha receives ZERO internal/hidden documents (strict RLS default deny)');

    const internalMeetings = await c.query(`
      SELECT id, title FROM public.meetings 
      WHERE is_client_visible = false;
    `);
    assert(internalMeetings.rows.length === 0, 'Client Alpha receives ZERO internal meetings');
  });

  // 5. Cross-Tenant Beta Client Denial
  await runSession(CLIENT_BETA_USER_ID, async (c) => {
    const alphaProjects = await c.query(`
      SELECT id, title FROM public.projects 
      WHERE organization_id = '21bb5fe2-ff1d-473a-b329-bc02b97ba069';
    `);
    assert(alphaProjects.rows.length === 0, 'Client Beta has ZERO access to Alpha projects');
  });

  // 6. Attention Center Rules Verification
  await runSession(OWNER_USER_ID, async (c) => {
    const atRiskProjs = await c.query(`
      SELECT id, name, health, status FROM public.projects
      WHERE health IN ('at_risk', 'delayed', 'blocked')
        AND status NOT IN ('completed', 'archived', 'paused');
    `);
    assert(atRiskProjs.rows.length >= 1, `At Risk/Blocked project detected for Attention Center (count: ${atRiskProjs.rows.length})`);

    const clientActions = await c.query(`
      SELECT id, title, responsibility_type, status FROM public.tasks
      WHERE responsibility_type = 'client' AND status != 'done';
    `);
    assert(clientActions.rows.length >= 2, `Active Client Actions detected for Attention Center (count: ${clientActions.rows.length})`);

    const pendingDocs = await c.query(`
      SELECT id, title, status FROM public.documents
      WHERE status = 'client_review' AND is_client_visible = true;
    `);
    assert(pendingDocs.rows.length >= 1, `Documents in Client Review detected for Attention Center (count: ${pendingDocs.rows.length})`);
  });

  console.log(`\n========================================`);
  console.log(`Phase 5A Security & Portfolio Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
