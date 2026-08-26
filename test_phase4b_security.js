// test_phase4b_security.js - Phase 4B Automated Security & Functionality Verification (Idempotent)
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
const ORG_BETA_ID = '59f079d0-c8c9-4703-88a7-c4934f64b69e';
const PROJ_BETA_1_ID = 'e02cb139-64c5-45f3-af3d-b7725a306581';

const CONTACT_ALPHA_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CONTACT_BETA_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const CLIENT_ALPHA_USER_ID = '44444444-4444-4444-4444-444444444444';
const CLIENT_BETA_USER_ID = '55555555-5555-5555-5555-555555555555';
const OWNER_USER_ID = '27852879-0d5f-4c72-889d-69a0989302d2'; // Real global owner

// Roadmap canonical IDs
const STAGE_ALPHA_VIS_ID = '11111111-1111-4000-a000-000000000001';
const STAGE_ALPHA_HID_ID = '11111111-1111-4000-a000-000000000002';
const MILESTONE_ALPHA_VIS_ID = '11111111-1111-4000-a000-000000000011';
const MILESTONE_ALPHA_HID_ID = '11111111-1111-4000-a000-000000000012';

// Action items
const ACTION_ALPHA_1_ID = '11111111-1111-4000-a000-000000000101';
const TASK_ALPHA_HID_ID = '11111111-1111-4000-a000-000000000104';

// Documents & Versions for Phase 4B
const DOC_ALPHA_REVIEW_ID = '11111111-1111-4000-a000-000000000201';
const VER_ALPHA_V1_ID = '11111111-1111-4000-a000-000000000211';
const VER_ALPHA_V2_ID = '11111111-1111-4000-a000-000000000212';
const VER_ALPHA_V3_ID = '11111111-1111-4000-a000-000000000213';

// Meetings & Notes
const MEET_ALPHA_1_ID = '11111111-1111-4000-a000-000000000301';
const NOTE_ALPHA_VIS_ID = '11111111-1111-4000-a000-000000000311';
const NOTE_ALPHA_HID_ID = '11111111-1111-4000-a000-000000000312';

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

async function setupTestData() {
  console.log('--- 1. Setting Up Phase 4B Test Fixtures ---');
  const pg = new PgClient(DB_CONFIG);
  await pg.connect();

  try {
    // 1. Memberships & Access
    await pg.query(`
      INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active)
      VALUES 
        ('${ORG_ALPHA_ID}', '${OWNER_USER_ID}', 'owner', TRUE),
        ('${ORG_ALPHA_ID}', '${CLIENT_ALPHA_USER_ID}', 'client', TRUE),
        ('${ORG_BETA_ID}', '${CLIENT_BETA_USER_ID}', 'client', TRUE)
      ON CONFLICT (organization_id, user_id) DO UPDATE SET org_role = EXCLUDED.org_role, is_active = TRUE;
    `);

    await pg.query(`
      INSERT INTO public.project_memberships (project_id, user_id, project_role)
      VALUES 
        ('${PROJ_ALPHA_1_ID}', '${CLIENT_ALPHA_USER_ID}', 'client_rep'),
        ('${PROJ_BETA_1_ID}', '${CLIENT_BETA_USER_ID}', 'client_rep')
      ON CONFLICT (project_id, user_id) DO UPDATE SET project_role = 'client_rep';
    `);

    await pg.query(`
      INSERT INTO public.client_portal_access (id, organization_id, contact_id, user_id, status, activated_at)
      VALUES 
        ('11111111-1111-4000-a000-000000000091', '${ORG_ALPHA_ID}', '${CONTACT_ALPHA_ID}', '${CLIENT_ALPHA_USER_ID}', 'active', NOW()),
        ('22222222-2222-4000-b000-000000000091', '${ORG_BETA_ID}', '${CONTACT_BETA_ID}', '${CLIENT_BETA_USER_ID}', 'active', NOW())
      ON CONFLICT (id) DO UPDATE SET status = 'active', revoked_at = NULL;
    `);

    // 2. Ensure Multi-Version Document setup for Alpha
    await pg.query(`
      INSERT INTO public.documents (
        id, organization_id, project_id, title, category, status, is_client_visible, internal_access_scope, created_at, updated_at
      ) VALUES (
        '${DOC_ALPHA_REVIEW_ID}', '${ORG_ALPHA_ID}', '${PROJ_ALPHA_1_ID}',
        'Alpha Architecture Document (Review)', 'architecture', 'client_review', TRUE, 'project_team', NOW(), NOW()
      ) ON CONFLICT (id) DO UPDATE SET 
        is_client_visible = TRUE,
        status = 'client_review';
    `);

    // Clean prior review events and versions
    await pg.query(`DELETE FROM public.document_review_events WHERE document_id = '${DOC_ALPHA_REVIEW_ID}';`);
    await pg.query(`DELETE FROM public.document_versions WHERE document_id = '${DOC_ALPHA_REVIEW_ID}';`);

    // Setup 3 Versions:
    // v1: published (is_client_visible = true)
    // v2: internal / unpublished (is_client_visible = false)
    // v3: published (is_client_visible = true)
    await pg.query(`
      INSERT INTO public.document_versions (
        id, document_id, version_number, storage_path, original_filename, mime_type, size_bytes, is_client_visible, created_at
      ) VALUES 
        ('${VER_ALPHA_V1_ID}', '${DOC_ALPHA_REVIEW_ID}', 1, 'docs/alpha_arch_v1.pdf', 'Alpha_Architecture_v1.pdf', 'application/pdf', 102400, TRUE, NOW() - interval '2 days'),
        ('${VER_ALPHA_V2_ID}', '${DOC_ALPHA_REVIEW_ID}', 2, 'docs/alpha_arch_v2_internal.pdf', 'Alpha_Architecture_v2_internal.pdf', 'application/pdf', 105400, FALSE, NOW() - interval '1 day'),
        ('${VER_ALPHA_V3_ID}', '${DOC_ALPHA_REVIEW_ID}', 3, 'docs/alpha_arch_v3_final.pdf', 'Alpha_Architecture_v3_final.pdf', 'application/pdf', 110200, TRUE, NOW());
    `);

    console.log('✔ Fixtures ready.');
  } finally {
    await pg.end();
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

  try {
    await setupTestData();

    console.log('\n--- 2. Version Publication & Direct RLS Visibility Test ---');
    await runSession(CLIENT_ALPHA_USER_ID, async (c) => {
      const clientVerRes = await c.query(`
        SELECT id, version_number, is_client_visible 
        FROM public.document_versions 
        WHERE document_id = '${DOC_ALPHA_REVIEW_ID}'
        ORDER BY version_number ASC;
      `);

      const verNumbers = clientVerRes.rows.map(r => r.version_number);
      assert(verNumbers.length === 2 && verNumbers.includes(1) && verNumbers.includes(3),
        `Client Alpha only sees published versions (v1, v3). Saw: [${verNumbers.join(', ')}]`);

      const hasUnpubV2 = clientVerRes.rows.some(r => r.id === VER_ALPHA_V2_ID);
      assert(!hasUnpubV2, 'Unpublished version v2 is completely invisible to Client Alpha');
    });

    console.log('\n--- 3. Stale Approval Protection Test ---');
    await runSession(CLIENT_ALPHA_USER_ID, async (c) => {
      let staleApprovalFailed = false;
      let staleErrorMsg = '';
      try {
        await c.query(`SELECT public.approve_document_version('${DOC_ALPHA_REVIEW_ID}', '${VER_ALPHA_V1_ID}');`);
      } catch (e) {
        staleApprovalFailed = true;
        staleErrorMsg = e.message;
      }
      assert(staleApprovalFailed && staleErrorMsg.includes('Stale version approval'), 
        `Stale approval of v1 rejected: "${staleErrorMsg}"`);

      let staleChangesFailed = false;
      try {
        await c.query(`SELECT public.request_document_changes('${DOC_ALPHA_REVIEW_ID}', '${VER_ALPHA_V1_ID}', 'Change request');`);
      } catch (e) {
        staleChangesFailed = true;
      }
      assert(staleChangesFailed, 'Stale change request on v1 rejected');
    });

    console.log('\n--- 4. Mandatory Comment for Change Requests ---');
    await runSession(CLIENT_ALPHA_USER_ID, async (c) => {
      let emptyCommentFailed = false;
      let emptyCommentMsg = '';
      try {
        await c.query(`SELECT public.request_document_changes('${DOC_ALPHA_REVIEW_ID}', '${VER_ALPHA_V3_ID}', '   ');`);
      } catch (e) {
        emptyCommentFailed = true;
        emptyCommentMsg = e.message;
      }
      assert(emptyCommentFailed, `Empty comment for request_document_changes rejected: "${emptyCommentMsg}"`);
    });

    console.log('\n--- 5. Controlled Change Request Execution ---');
    await runSession(CLIENT_ALPHA_USER_ID, async (c) => {
      await c.query(`
        SELECT public.request_document_changes(
          '${DOC_ALPHA_REVIEW_ID}', 
          '${VER_ALPHA_V3_ID}', 
          'Please clarify security protocol in section 4.2'
        );
      `);

      const docAfterChanges = await c.query(`SELECT status FROM public.documents WHERE id = '${DOC_ALPHA_REVIEW_ID}';`);
      assert(docAfterChanges.rows[0].status === 'changes_requested', `Document status updated to changes_requested (was: ${docAfterChanges.rows[0].status})`);

      const revEvent1 = await c.query(`
        SELECT action, comment, document_version_id, reviewer_user_id 
        FROM public.document_review_events 
        WHERE document_id = '${DOC_ALPHA_REVIEW_ID}'
        ORDER BY created_at DESC LIMIT 1;
      `);
      assert(revEvent1.rows.length === 1 && 
             revEvent1.rows[0].action === 'changes_requested' && 
             revEvent1.rows[0].comment.includes('security protocol') &&
             revEvent1.rows[0].reviewer_user_id === CLIENT_ALPHA_USER_ID,
        'Immutable review event logged for changes_requested with comment');
    });

    console.log('\n--- 6. Controlled Approval Execution ---');
    await runSession(CLIENT_ALPHA_USER_ID, async (c) => {
      await c.query(`
        SELECT public.approve_document_version('${DOC_ALPHA_REVIEW_ID}', '${VER_ALPHA_V3_ID}');
      `);

      const docAfterApprove = await c.query(`SELECT status FROM public.documents WHERE id = '${DOC_ALPHA_REVIEW_ID}';`);
      assert(docAfterApprove.rows[0].status === 'approved', `Document status updated to approved (was: ${docAfterApprove.rows[0].status})`);

      const revEventsAll = await c.query(`
        SELECT action, document_version_id 
        FROM public.document_review_events 
        WHERE document_id = '${DOC_ALPHA_REVIEW_ID}'
        ORDER BY created_at ASC;
      `);
      assert(revEventsAll.rows.length === 2 && 
             revEventsAll.rows[0].action === 'changes_requested' && 
             revEventsAll.rows[1].action === 'approved',
        'Audit log contains 2 chronological immutable events (changes_requested, approved)');
    });

    console.log('\n--- 7. Client Cannot Call Admin publish_document_version ---');
    await runSession(CLIENT_ALPHA_USER_ID, async (c) => {
      let clientPublishFailed = false;
      try {
        await c.query(`SELECT public.publish_document_version('${VER_ALPHA_V2_ID}', TRUE);`);
      } catch (e) {
        clientPublishFailed = true;
      }
      assert(clientPublishFailed, 'Client Alpha cannot call publish_document_version directly');
    });

    console.log('\n--- 8. Admin Publication Workflow ---');
    await runSession(OWNER_USER_ID, async (c) => {
      await c.query(`SELECT public.publish_document_version('${VER_ALPHA_V2_ID}', TRUE);`);
      const ver2Status = await c.query(`SELECT is_client_visible FROM public.document_versions WHERE id = '${VER_ALPHA_V2_ID}';`);
      assert(ver2Status.rows[0].is_client_visible === true, 'Owner successfully published v2 to client');
    });

    await runSession(CLIENT_ALPHA_USER_ID, async (c) => {
      const clientVerRes2 = await c.query(`
        SELECT id FROM public.document_versions WHERE document_id = '${DOC_ALPHA_REVIEW_ID}';
      `);
      assert(clientVerRes2.rows.length === 3, 'Client Alpha now sees all 3 published versions');
    });

    console.log('\n--- 9. Roadmap Direct API Security ---');
    await runSession(CLIENT_ALPHA_USER_ID, async (c) => {
      const hidStageRes = await c.query(`
        SELECT * FROM public.project_stages WHERE id = '${STAGE_ALPHA_HID_ID}';
      `);
      assert(hidStageRes.rows.length === 0, 'Hidden delivery stage denied via direct API (0 rows)');

      const hidMileRes = await c.query(`
        SELECT * FROM public.milestones WHERE id = '${MILESTONE_ALPHA_HID_ID}';
      `);
      assert(hidMileRes.rows.length === 0, 'Hidden delivery milestone denied via direct API (0 rows)');

      const visStageRes = await c.query(`
        SELECT * FROM public.project_stages WHERE id = '${STAGE_ALPHA_VIS_ID}';
      `);
      assert(visStageRes.rows.length === 1, 'Client-visible delivery stage accessible (1 row)');
    });

    console.log('\n--- 10. Action Center Execution & RPC Security ---');
    await runSession(CLIENT_ALPHA_USER_ID, async (c) => {
      // Complete client action
      await c.query(`SELECT public.complete_client_action('${ACTION_ALPHA_1_ID}');`);
      const actionStatus1 = await c.query(`SELECT status FROM public.tasks WHERE id = '${ACTION_ALPHA_1_ID}';`);
      assert(actionStatus1.rows[0].status === 'done', 'complete_client_action transitioned status to done');

      // Reopen client action
      await c.query(`SELECT public.reopen_client_action('${ACTION_ALPHA_1_ID}');`);
      const actionStatus2 = await c.query(`SELECT status FROM public.tasks WHERE id = '${ACTION_ALPHA_1_ID}';`);
      assert(actionStatus2.rows[0].status === 'todo', 'reopen_client_action transitioned status back to todo');

      // Attempt to complete internal task
      let internalTaskFailed = false;
      try {
        await c.query(`SELECT public.complete_client_action('${TASK_ALPHA_HID_ID}');`);
      } catch (e) {
        internalTaskFailed = true;
      }
      assert(internalTaskFailed, 'Client cannot complete internal non-client task');
    });

    console.log('\n--- 11. Meeting Notes & Decisions Security ---');
    await runSession(CLIENT_ALPHA_USER_ID, async (c) => {
      const clientNotes = await c.query(`
        SELECT id, is_client_visible, note_type FROM public.meeting_notes WHERE meeting_id = '${MEET_ALPHA_1_ID}';
      `);
      const hasHiddenNote = clientNotes.rows.some(n => n.id === NOTE_ALPHA_HID_ID || !n.is_client_visible || n.note_type === 'internal');
      assert(!hasHiddenNote, `Client only sees client-visible meeting notes (Total notes visible: ${clientNotes.rows.length})`);
    });

    console.log('\n--- 12. Cross-Tenant Beta Isolation ---');
    await runSession(CLIENT_BETA_USER_ID, async (c) => {
      const betaDocAccess = await c.query(`SELECT * FROM public.documents WHERE id = '${DOC_ALPHA_REVIEW_ID}';`);
      assert(betaDocAccess.rows.length === 0, 'Client Beta cannot read Alpha documents (0 rows)');

      const betaVerAccess = await c.query(`SELECT * FROM public.document_versions WHERE document_id = '${DOC_ALPHA_REVIEW_ID}';`);
      assert(betaVerAccess.rows.length === 0, 'Client Beta cannot read Alpha document versions (0 rows)');

      const betaStageAccess = await c.query(`SELECT * FROM public.project_stages WHERE id = '${STAGE_ALPHA_VIS_ID}';`);
      assert(betaStageAccess.rows.length === 0, 'Client Beta cannot read Alpha delivery stages (0 rows)');

      const betaMeetAccess = await c.query(`SELECT * FROM public.meetings WHERE id = '${MEET_ALPHA_1_ID}';`);
      assert(betaMeetAccess.rows.length === 0, 'Client Beta cannot read Alpha meetings (0 rows)');
    });

    console.log('\n--- 13. Specialist Role Integrity Check ---');
    const pgAdmin = new PgClient(DB_CONFIG);
    await pgAdmin.connect();
    try {
      const specAccess = await pgAdmin.query(`
        SELECT * FROM public.client_portal_access 
        WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'salessystem.it@gmail.com');
      `);
      assert(specAccess.rows.length === 0, 'salessystem.it@gmail.com has ZERO client portal access records (strictly INTERNAL)');
    } finally {
      await pgAdmin.end();
    }

    console.log('\n========================================');
    console.log(`Phase 4B Security & Verification Summary:`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log('========================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
