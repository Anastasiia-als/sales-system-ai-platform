// test_phase4a_security.js - Comprehensive E2E Multi-Tenant Security & Functionality Verification (Idempotent)
const { Client: PgClient } = require('pg');

const DB_CONFIG = {
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.aayqydcdfxhlwizhfjun',
  password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

const ORG_ALPHA_ID = '21bb5fe2-ff1d-473a-b329-bc02b97ba069';
const PROJ_ALPHA_1_ID = '170d3c57-224b-4ae5-a384-0ccdf17252cc';
const PROJ_ALPHA_2_ID = '6af58a69-dbd9-43b8-b04f-68a38da1c2bb'; // Unassigned for Client

const ORG_BETA_ID = '59f079d0-c8c9-4703-88a7-c4934f64b69e';
const PROJ_BETA_1_ID = 'e02cb139-64c5-45f3-af3d-b7725a306581';

const CONTACT_ALPHA_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CONTACT_BETA_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const CLIENT_ALPHA_USER_ID = '44444444-4444-4444-4444-444444444444';
const CLIENT_BETA_USER_ID = '55555555-5555-5555-5555-555555555555';

const CLIENT_ALPHA_EMAIL = 'client_alpha_4a@firstwin.io';
const CLIENT_BETA_EMAIL = 'client_beta_4a@firstwin.io';

// Deterministic Canonical IDs
const STAGE_ALPHA_VIS_ID = '11111111-1111-4000-a000-000000000001';
const STAGE_ALPHA_HID_ID = '11111111-1111-4000-a000-000000000002';
const MILESTONE_ALPHA_VIS_ID = '11111111-1111-4000-a000-000000000011';
const MILESTONE_ALPHA_HID_ID = '11111111-1111-4000-a000-000000000012';

const ACTION_ALPHA_1_ID = '11111111-1111-4000-a000-000000000101';
const ACTION_ALPHA_2_ID = '11111111-1111-4000-a000-000000000102';
const ACTION_ALPHA_3_ID = '11111111-1111-4000-a000-000000000103';
const TASK_ALPHA_HID_ID = '11111111-1111-4000-a000-000000000104';

const DOC_ALPHA_VIS_ID = '11111111-1111-4000-a000-000000000201';
const DOC_ALPHA_2_ID = '11111111-1111-4000-a000-000000000202';
const DOC_ALPHA_MGMT_ID = '11111111-1111-4000-a000-000000000203';

const MEET_ALPHA_VIS_ID = '11111111-1111-4000-a000-000000000301';
const MEET_ALPHA_HID_ID = '11111111-1111-4000-a000-000000000302';
const NOTE_ALPHA_VIS_ID = '11111111-1111-4000-a000-000000000311';
const NOTE_ALPHA_HID_ID = '11111111-1111-4000-a000-000000000312';

const STAGE_BETA_1_ID = '22222222-2222-4000-b000-000000000001';
const MILESTONE_BETA_1_ID = '22222222-2222-4000-b000-000000000011';
const TASK_BETA_1_ID = '22222222-2222-4000-b000-000000000101';
const DOC_BETA_1_ID = '22222222-2222-4000-b000-000000000201';
const MEET_BETA_1_ID = '22222222-2222-4000-b000-000000000301';

let pg;

async function setupTestData() {
  console.log('--- 1. Initializing Deterministic & Idempotent Multi-Tenant Fixtures ---');
  pg = new PgClient(DB_CONFIG);
  await pg.connect();

  // 1. Ensure Contacts exist
  await pg.query(`
    INSERT INTO public.contacts (id, organization_id, first_name, last_name, email, is_primary)
    VALUES ($1, $2, 'Alpha', 'Director', $3, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = $3, first_name = 'Alpha';
  `, [CONTACT_ALPHA_ID, ORG_ALPHA_ID, CLIENT_ALPHA_EMAIL]);

  await pg.query(`
    INSERT INTO public.contacts (id, organization_id, first_name, last_name, email, is_primary)
    VALUES ($1, $2, 'Beta', 'Manager', $3, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = $3, first_name = 'Beta';
  `, [CONTACT_BETA_ID, ORG_BETA_ID, CLIENT_BETA_EMAIL]);

  // 2. Ensure Profiles exist
  await pg.query(`
    INSERT INTO public.profiles (id, email, full_name, global_role)
    VALUES ($1, $2, 'Client Alpha Tester', 'client')
    ON CONFLICT (id) DO UPDATE SET email = $2, full_name = 'Client Alpha Tester', global_role = 'client';
  `, [CLIENT_ALPHA_USER_ID, CLIENT_ALPHA_EMAIL]);

  await pg.query(`
    INSERT INTO public.profiles (id, email, full_name, global_role)
    VALUES ($1, $2, 'Client Beta Tester', 'client')
    ON CONFLICT (id) DO UPDATE SET email = $2, full_name = 'Client Beta Tester', global_role = 'client';
  `, [CLIENT_BETA_USER_ID, CLIENT_BETA_EMAIL]);

  // 3. Setup Organization & Project Memberships
  await pg.query(`
    INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active)
    VALUES ($1, $2, 'client', TRUE)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET org_role = 'client', is_active = TRUE;
  `, [ORG_ALPHA_ID, CLIENT_ALPHA_USER_ID]);

  await pg.query(`
    INSERT INTO public.project_memberships (project_id, user_id, project_role)
    VALUES ($1, $2, 'client_rep')
    ON CONFLICT (project_id, user_id) DO UPDATE SET project_role = 'client_rep';
  `, [PROJ_ALPHA_1_ID, CLIENT_ALPHA_USER_ID]);

  // Unassign Alpha from Proj Alpha 2
  await pg.query(`
    DELETE FROM public.project_memberships WHERE project_id = $1 AND user_id = $2;
  `, [PROJ_ALPHA_2_ID, CLIENT_ALPHA_USER_ID]);

  // Beta memberships
  await pg.query(`
    INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active)
    VALUES ($1, $2, 'client', TRUE)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET org_role = 'client', is_active = TRUE;
  `, [ORG_BETA_ID, CLIENT_BETA_USER_ID]);

  await pg.query(`
    INSERT INTO public.project_memberships (project_id, user_id, project_role)
    VALUES ($1, $2, 'client_rep')
    ON CONFLICT (project_id, user_id) DO UPDATE SET project_role = 'client_rep';
  `, [PROJ_BETA_1_ID, CLIENT_BETA_USER_ID]);

  // 4. Setup client_portal_access records
  await pg.query(`
    DELETE FROM public.client_portal_access 
    WHERE organization_id IN ($1, $2)
      AND id NOT IN ('11111111-1111-4000-a000-000000000091', '22222222-2222-4000-b000-000000000091');
  `, [ORG_ALPHA_ID, ORG_BETA_ID]);

  await pg.query(`
    INSERT INTO public.client_portal_access (id, organization_id, contact_id, user_id, status, activated_at)
    VALUES ('11111111-1111-4000-a000-000000000091', $1, $2, $3, 'active', NOW())
    ON CONFLICT (id) DO UPDATE SET
      organization_id = EXCLUDED.organization_id,
      contact_id = EXCLUDED.contact_id,
      user_id = EXCLUDED.user_id,
      status = 'active',
      revoked_at = NULL,
      updated_at = NOW();
  `, [ORG_ALPHA_ID, CONTACT_ALPHA_ID, CLIENT_ALPHA_USER_ID]);

  await pg.query(`
    INSERT INTO public.client_portal_access (id, organization_id, contact_id, user_id, status, activated_at)
    VALUES ('22222222-2222-4000-b000-000000000091', $1, $2, $3, 'active', NOW())
    ON CONFLICT (id) DO UPDATE SET
      organization_id = EXCLUDED.organization_id,
      contact_id = EXCLUDED.contact_id,
      user_id = EXCLUDED.user_id,
      status = 'active',
      revoked_at = NULL,
      updated_at = NOW();
  `, [ORG_BETA_ID, CONTACT_BETA_ID, CLIENT_BETA_USER_ID]);

  // 5. Setup Stages & Milestones: Visible vs Hidden (Canonical Business Names)
  await pg.query(`
    INSERT INTO public.project_stages (id, organization_id, project_id, name, status, sort_order, is_client_visible)
    VALUES 
      ($1, $2, $3, 'Аудит і діагностика', 'in_progress', 1, TRUE),
      ($4, $2, $3, 'Внутрішнє планування', 'not_started', 2, FALSE),
      ($5, $6, $7, 'Beta Етап 1', 'in_progress', 1, TRUE)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      status = EXCLUDED.status,
      sort_order = EXCLUDED.sort_order,
      is_client_visible = EXCLUDED.is_client_visible;
  `, [STAGE_ALPHA_VIS_ID, ORG_ALPHA_ID, PROJ_ALPHA_1_ID, STAGE_ALPHA_HID_ID, STAGE_BETA_1_ID, ORG_BETA_ID, PROJ_BETA_1_ID]);

  await pg.query(`
    INSERT INTO public.milestones (id, organization_id, project_id, stage_id, name, status, sort_order, is_client_visible)
    VALUES 
      ($1, $2, $3, $4, 'Звіт з аудиту погоджено', 'pending', 1, TRUE),
      ($5, $2, $3, $4, 'Внутрішня оцінка ризиків', 'pending', 2, FALSE),
      ($6, $7, $8, $9, 'Beta Точка 1', 'pending', 1, TRUE)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      status = EXCLUDED.status,
      stage_id = EXCLUDED.stage_id,
      sort_order = EXCLUDED.sort_order,
      is_client_visible = EXCLUDED.is_client_visible;
  `, [
    MILESTONE_ALPHA_VIS_ID, ORG_ALPHA_ID, PROJ_ALPHA_1_ID, STAGE_ALPHA_VIS_ID,
    MILESTONE_ALPHA_HID_ID,
    MILESTONE_BETA_1_ID, ORG_BETA_ID, PROJ_BETA_1_ID, STAGE_BETA_1_ID
  ]);

  // 6. Setup Tasks: Client Actions & Internal Tasks
  await pg.query(`
    INSERT INTO public.tasks (id, organization_id, project_id, title, description, status, priority, responsibility_type, client_contact_id, is_client_visible, due_date)
    VALUES 
      ($1, $2, $3, 'Надати доступ до CRM', 'Будь ласка, надайте доступ адміністратора для налаштування API', 'todo', 'high', 'client', $4, TRUE, NOW() + INTERVAL '2 days'),
      ($5, $2, $3, 'Підтвердити перелік KPI', 'Узгодьте список ключових метрик воронки перед фіналізацією звіту', 'in_progress', 'medium', 'client', $4, TRUE, NOW() + INTERVAL '5 days'),
      ($6, $2, $3, 'Ознайомитися зі звітом аудиту', 'Перегляньте презентацію аудиту продажів та залиште зворотний зв''язок', 'done', 'low', 'client', $4, TRUE, NOW() - INTERVAL '1 day'),
      ($7, $2, $3, 'Внутрішня задача розробки', 'Підготовка архітектури CRM інтеграції', 'todo', 'medium', 'internal', NULL, FALSE, NOW() + INTERVAL '3 days'),
      ($8, $9, $10, 'Надати доступ до аналітики Beta', 'Потрібні доступи до Google Analytics', 'todo', 'high', 'client', $11, TRUE, NOW() + INTERVAL '2 days')
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      priority = EXCLUDED.priority,
      responsibility_type = EXCLUDED.responsibility_type,
      client_contact_id = EXCLUDED.client_contact_id,
      is_client_visible = EXCLUDED.is_client_visible,
      due_date = EXCLUDED.due_date;
  `, [
    ACTION_ALPHA_1_ID, ORG_ALPHA_ID, PROJ_ALPHA_1_ID, CONTACT_ALPHA_ID,
    ACTION_ALPHA_2_ID,
    ACTION_ALPHA_3_ID,
    TASK_ALPHA_HID_ID,
    TASK_BETA_1_ID, ORG_BETA_ID, PROJ_BETA_1_ID, CONTACT_BETA_ID
  ]);

  // 7. Setup Documents: Client-Visible vs Management
  await pg.query(`
    INSERT INTO public.documents (id, organization_id, project_id, title, category, status, internal_access_scope, is_client_visible)
    VALUES 
      ($1, $2, $3, 'Звіт з аудиту продажів', 'Аудит', 'client_review', 'project_team', TRUE),
      ($4, $2, $3, 'Комерційна пропозиція', 'Стратегія', 'approved', 'project_team', TRUE),
      ($5, $2, $3, 'Фінансовий кошторис (Management Only)', 'Стратегія', 'draft', 'management', FALSE),
      ($6, $7, $8, 'Звіт Beta аудиту', 'Аудит', 'client_review', 'project_team', TRUE)
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      category = EXCLUDED.category,
      status = EXCLUDED.status,
      internal_access_scope = EXCLUDED.internal_access_scope,
      is_client_visible = EXCLUDED.is_client_visible;
  `, [
    DOC_ALPHA_VIS_ID, ORG_ALPHA_ID, PROJ_ALPHA_1_ID,
    DOC_ALPHA_2_ID,
    DOC_ALPHA_MGMT_ID,
    DOC_BETA_1_ID, ORG_BETA_ID, PROJ_BETA_1_ID
  ]);

  await pg.query(`
    INSERT INTO public.document_versions (document_id, organization_id, project_id, version_number, storage_path, original_filename)
    VALUES 
      ($1, $2, $3, 1, 'alpha-audit-v1.pdf', 'alpha-audit.pdf'),
      ($4, $2, $3, 1, 'alpha-proposal-v1.pdf', 'alpha-proposal.pdf'),
      ($5, $6, $7, 1, 'beta-audit-v1.pdf', 'beta-audit.pdf')
    ON CONFLICT (document_id, version_number) DO UPDATE SET
      storage_path = EXCLUDED.storage_path,
      original_filename = EXCLUDED.original_filename;
  `, [
    DOC_ALPHA_VIS_ID, ORG_ALPHA_ID, PROJ_ALPHA_1_ID,
    DOC_ALPHA_2_ID,
    DOC_BETA_1_ID, ORG_BETA_ID, PROJ_BETA_1_ID
  ]);

  // 8. Setup Meetings: Client-Visible vs Internal
  await pg.query(`
    INSERT INTO public.meetings (id, organization_id, project_id, title, meeting_type, status, start_at, end_at, is_client_visible, meeting_url)
    VALUES 
      ($1, $2, $3, 'Презентація результатів аудиту', 'status_sync', 'scheduled', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '1 hour', TRUE, 'https://meet.google.com/test-alpha'),
      ($4, $2, $3, 'Внутрішній синхрон команди', 'status_sync', 'scheduled', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day' + INTERVAL '30 minutes', FALSE, NULL),
      ($5, $6, $7, 'Beta установча зустріч', 'status_sync', 'scheduled', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '1 hour', TRUE, 'https://meet.google.com/test-beta')
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      meeting_type = EXCLUDED.meeting_type,
      status = EXCLUDED.status,
      start_at = EXCLUDED.start_at,
      end_at = EXCLUDED.end_at,
      is_client_visible = EXCLUDED.is_client_visible,
      meeting_url = EXCLUDED.meeting_url;
  `, [
    MEET_ALPHA_VIS_ID, ORG_ALPHA_ID, PROJ_ALPHA_1_ID,
    MEET_ALPHA_HID_ID,
    MEET_BETA_1_ID, ORG_BETA_ID, PROJ_BETA_1_ID
  ]);

  await pg.query(`
    INSERT INTO public.meeting_notes (id, meeting_id, organization_id, project_id, note_type, body, is_client_visible)
    VALUES 
      ($1, $2, $3, $4, 'general', 'Погоджено таймлайн впровадження CRM', TRUE),
      ($5, $2, $3, $4, 'internal', 'Внутрішні коментарі PM про ризики клієнта', FALSE)
    ON CONFLICT (id) DO UPDATE SET
      note_type = EXCLUDED.note_type,
      body = EXCLUDED.body,
      is_client_visible = EXCLUDED.is_client_visible;
  `, [NOTE_ALPHA_VIS_ID, MEET_ALPHA_VIS_ID, ORG_ALPHA_ID, PROJ_ALPHA_1_ID, NOTE_ALPHA_HID_ID]);

  console.log('✓ Deterministic multi-tenant fixtures initialized successfully!');
  return {
    contactAlphaId: CONTACT_ALPHA_ID,
    contactBetaId: CONTACT_BETA_ID,
    clientActionId: ACTION_ALPHA_1_ID,
    docVisId: DOC_ALPHA_VIS_ID,
    docMgmtId: DOC_ALPHA_MGMT_ID,
    meetVisId: MEET_ALPHA_VIS_ID
  };
}

async function runSessionTest(userId, testName, testFn) {
  const client = new PgClient(DB_CONFIG);
  await client.connect();
  try {
    await client.query("BEGIN;");
    await client.query("SET LOCAL role = 'authenticated';");
    await client.query("SELECT set_config('request.jwt.claims', $1, true);", [
      JSON.stringify({ sub: userId, role: 'authenticated' })
    ]);
    await testFn(client);
    await client.query("COMMIT;");
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    await client.end();
  }
}

async function runSecurityTests(testIds) {
  console.log('\n--- 2. Testing Organization Tenant Isolation ---');
  await runSessionTest(CLIENT_ALPHA_USER_ID, 'Alpha Org Isolation', async (c) => {
    const orgs = await c.query('SELECT id, name FROM public.organizations;');
    console.log('Client Alpha sees Orgs:', orgs.rows.map(r => r.name));
    if (orgs.rows.length !== 1 || orgs.rows[0].id !== ORG_ALPHA_ID) {
      throw new Error(`FAIL: Alpha sees unexpected organizations: ${JSON.stringify(orgs.rows)}`);
    }

    const orgBetaDirect = await c.query('SELECT id, name FROM public.organizations WHERE id = $1;', [ORG_BETA_ID]);
    if (orgBetaDirect.rows.length > 0) {
      throw new Error('FAIL: Alpha was able to query Org Beta!');
    }
  });
  console.log('✓ Client Alpha strictly isolated to Org Alpha only');

  await runSessionTest(CLIENT_BETA_USER_ID, 'Beta Org Isolation', async (c) => {
    const orgs = await c.query('SELECT id, name FROM public.organizations;');
    console.log('Client Beta sees Orgs:', orgs.rows.map(r => r.name));
    if (orgs.rows.length !== 1 || orgs.rows[0].id !== ORG_BETA_ID) {
      throw new Error(`FAIL: Beta sees unexpected organizations: ${JSON.stringify(orgs.rows)}`);
    }
  });
  console.log('✓ Client Beta strictly isolated to Org Beta only');

  console.log('\n--- 3. Testing Project Scope & Unassigned Projects Protection ---');
  await runSessionTest(CLIENT_ALPHA_USER_ID, 'Alpha Project Scope', async (c) => {
    const projects = await c.query('SELECT id, name FROM public.projects;');
    console.log('Client Alpha sees Projects:', projects.rows.map(r => r.name));
    if (projects.rows.length !== 1 || projects.rows[0].id !== PROJ_ALPHA_1_ID) {
      throw new Error(`FAIL: Alpha sees unpermitted projects: ${JSON.stringify(projects.rows)}`);
    }

    // Direct query for unassigned Project Alpha 2
    const projAlpha2 = await c.query('SELECT id, name FROM public.projects WHERE id = $1;', [PROJ_ALPHA_2_ID]);
    if (projAlpha2.rows.length > 0) {
      throw new Error('FAIL: Alpha was able to query unassigned Project Alpha 2!');
    }

    // Direct query for Project Beta 1
    const projBeta = await c.query('SELECT id, name FROM public.projects WHERE id = $1;', [PROJ_BETA_1_ID]);
    if (projBeta.rows.length > 0) {
      throw new Error('FAIL: Alpha was able to query Project Beta!');
    }
  });
  console.log('✓ Client Alpha only sees explicitly permitted Project Alpha 1');

  console.log('\n--- 4. Testing Roadmap Visibility (Hidden Stages/Milestones Protection) ---');
  await runSessionTest(CLIENT_ALPHA_USER_ID, 'Alpha Roadmap Visibility', async (c) => {
    const stages = await c.query('SELECT id, name, is_client_visible FROM public.project_stages;');
    console.log('Client Alpha sees Stages:', stages.rows.map(r => r.name));
    if (stages.rows.some(s => !s.is_client_visible)) {
      throw new Error('FAIL: Alpha sees internal hidden stages!');
    }

    const milestones = await c.query('SELECT id, name, is_client_visible FROM public.milestones;');
    console.log('Client Alpha sees Milestones:', milestones.rows.map(r => r.name));
    if (milestones.rows.some(m => !m.is_client_visible)) {
      throw new Error('FAIL: Alpha sees internal hidden milestones!');
    }
  });
  console.log('✓ Internal Roadmap stages and milestones are hidden from Client');

  console.log('\n--- 5. Testing Documents & Storage Access Security ---');
  await runSessionTest(CLIENT_ALPHA_USER_ID, 'Alpha Document Visibility', async (c) => {
    const docs = await c.query('SELECT id, title, internal_access_scope, is_client_visible FROM public.documents;');
    console.log('Client Alpha sees Documents:', docs.rows.map(r => r.title));
    if (docs.rows.some(d => d.internal_access_scope === 'management' || !d.is_client_visible)) {
      throw new Error('FAIL: Alpha sees management or internal documents!');
    }

    // Direct query for Management Document
    const docMgmt = await c.query('SELECT id, title FROM public.documents WHERE id = $1;', [testIds.docMgmtId]);
    if (docMgmt.rows.length > 0) {
      throw new Error('FAIL: Alpha was able to query Management Document!');
    }
  });

  await runSessionTest(CLIENT_BETA_USER_ID, 'Beta Document Isolation', async (c) => {
    const docAlphaDirect = await c.query('SELECT id, title FROM public.documents WHERE id = $1;', [testIds.docVisId]);
    if (docAlphaDirect.rows.length > 0) {
      throw new Error('FAIL: Beta was able to query Alpha document!');
    }
  });
  console.log('✓ Management documents and cross-tenant documents are protected');

  console.log('\n--- 6. Testing Meetings & Meeting Notes Visibility ---');
  await runSessionTest(CLIENT_ALPHA_USER_ID, 'Alpha Meetings Visibility', async (c) => {
    const meetings = await c.query('SELECT id, title, is_client_visible FROM public.meetings;');
    console.log('Client Alpha sees Meetings:', meetings.rows.map(r => r.title));
    if (meetings.rows.some(m => !m.is_client_visible)) {
      throw new Error('FAIL: Alpha sees internal meetings!');
    }

    const notes = await c.query('SELECT id, body, is_client_visible FROM public.meeting_notes;');
    console.log('Client Alpha sees Meeting Notes count:', notes.rows.length);
    if (notes.rows.some(n => !n.is_client_visible)) {
      throw new Error('FAIL: Alpha sees internal meeting notes!');
    }
  });
  console.log('✓ Internal meetings and notes are hidden from Client');

  console.log('\n--- 7. Testing Client Actions & RPC (complete_client_action & reopen_client_action) ---');
  await runSessionTest(CLIENT_ALPHA_USER_ID, 'Alpha Complete Action', async (c) => {
    const tasks = await c.query('SELECT id, title, status, responsibility_type FROM public.tasks;');
    console.log('Client Alpha sees Tasks:', tasks.rows.map(r => `${r.title} (${r.status})`));
    if (tasks.rows.some(t => t.responsibility_type !== 'client')) {
      throw new Error('FAIL: Alpha sees internal tasks!');
    }

    // Call RPC complete_client_action
    const rpcRes = await c.query('SELECT public.complete_client_action($1);', [testIds.clientActionId]);
    console.log('complete_client_action RPC result:', rpcRes.rows[0]);

    // Check status in tasks table
    const taskAfter = await c.query('SELECT status, completed_at FROM public.tasks WHERE id = $1;', [testIds.clientActionId]);
    if (taskAfter.rows[0].status !== 'done' || !taskAfter.rows[0].completed_at) {
      throw new Error('FAIL: Task status was not updated to done');
    }

    // Reopen action
    await c.query('SELECT public.reopen_client_action($1);', [testIds.clientActionId]);
    const taskReopened = await c.query('SELECT status FROM public.tasks WHERE id = $1;', [testIds.clientActionId]);
    if (taskReopened.rows[0].status !== 'todo') {
      throw new Error('FAIL: Task status was not updated to todo on reopen');
    }
  });
  console.log('✓ Client Action completion and reopening RPC verified');

  // Cross-tenant execution block test
  let betaBlocked = false;
  try {
    await runSessionTest(CLIENT_BETA_USER_ID, 'Beta Cross-tenant Action Block', async (c) => {
      await c.query('SELECT public.complete_client_action($1);', [testIds.clientActionId]);
    });
  } catch (err) {
    betaBlocked = true;
    console.log('Expected error on cross-tenant action:', err.message);
  }
  if (!betaBlocked) {
    throw new Error('FAIL: Beta was able to execute complete_client_action on Alpha action!');
  }
  console.log('✓ Cross-tenant action execution strictly blocked by RPC');

  console.log('\n--- 8. Testing Access Revocation ---');
  // Revoke Alpha access
  await pg.query(`
    UPDATE public.client_portal_access
    SET status = 'revoked', revoked_at = NOW()
    WHERE organization_id = $1 AND user_id = $2;
  `, [ORG_ALPHA_ID, CLIENT_ALPHA_USER_ID]);

  await runSessionTest(CLIENT_ALPHA_USER_ID, 'Alpha Post-Revocation Isolation', async (c) => {
    const orgs = await c.query('SELECT id, name FROM public.organizations;');
    const projects = await c.query('SELECT id, name FROM public.projects;');
    const docs = await c.query('SELECT id, title FROM public.documents;');
    const tasks = await c.query('SELECT id, title FROM public.tasks;');

    console.log('Post-revoke visible Orgs count:', orgs.rows.length);
    console.log('Post-revoke visible Projects count:', projects.rows.length);
    console.log('Post-revoke visible Docs count:', docs.rows.length);
    console.log('Post-revoke visible Tasks count:', tasks.rows.length);

    if (orgs.rows.length > 0 || projects.rows.length > 0 || docs.rows.length > 0 || tasks.rows.length > 0) {
      throw new Error('FAIL: Revoked client was still able to query data!');
    }
  });
  console.log('✓ Revocation immediate access denial verified');

  // Restore Alpha active access and predictable initial task state for manual review in browser UI
  await pg.query(`
    UPDATE public.client_portal_access
    SET status = 'active', revoked_at = NULL, activated_at = NOW()
    WHERE organization_id = $1 AND user_id = $2;
  `, [ORG_ALPHA_ID, CLIENT_ALPHA_USER_ID]);
  await pg.query(`
    UPDATE public.organization_memberships
    SET is_active = TRUE
    WHERE organization_id = $1 AND user_id = $2;
  `, [ORG_ALPHA_ID, CLIENT_ALPHA_USER_ID]);

  // Reset canonical task status to initial predictable states (1 todo, 1 in_progress, 1 done)
  await pg.query(`UPDATE public.tasks SET status = 'todo', completed_at = NULL WHERE id = $1;`, [ACTION_ALPHA_1_ID]);
  await pg.query(`UPDATE public.tasks SET status = 'in_progress', completed_at = NULL WHERE id = $1;`, [ACTION_ALPHA_2_ID]);
  await pg.query(`UPDATE public.tasks SET status = 'done', completed_at = NOW() WHERE id = $1;`, [ACTION_ALPHA_3_ID]);

  console.log('✓ Restored test Client Alpha to active state & predictable initial fixtures for manual testing');

  console.log('\n=============================================================');
  console.log('🎉 ALL 8 MULTI-TENANT & RLS SECURITY VERIFICATION TESTS PASSED! 🎉');
  console.log('=============================================================\n');
}

async function main() {
  try {
    const testIds = await setupTestData();
    await runSecurityTests(testIds);
  } catch (err) {
    console.error('\n❌ SECURITY TEST FAILED:', err);
    process.exit(1);
  } finally {
    if (pg) await pg.end();
  }
}

main();
