const { Client: PgClient } = require('pg');

const DB_CONFIG = {
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.aayqydcdfxhlwizhfjun',
  password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

const CLIENT_ALPHA_USER_ID = '44444444-4444-4444-4444-444444444444';
const MEET_ALPHA_VIS_ID = '11111111-1111-4000-a000-000000000301';
const DOC_ALPHA_REVIEW_ID = '11111111-1111-4000-a000-000000000201';

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

  console.log('=== Phase 4B.3 Meeting Detail Security & Visibility Verification ===\n');

  // Ensure deterministic version publication status
  const resetClient = new PgClient(DB_CONFIG);
  await resetClient.connect();
  await resetClient.query(`UPDATE public.document_versions SET is_client_visible = false WHERE version_number = 2 AND document_id = '11111111-1111-4000-a000-000000000201'`);
  await resetClient.end();

  await runSession(CLIENT_ALPHA_USER_ID, async (c) => {
    // 1. Meeting Notes Visibility
    const notesRes = await c.query(`
      SELECT id, note_type, body, is_client_visible 
      FROM public.meeting_notes 
      WHERE meeting_id = $1;
    `, [MEET_ALPHA_VIS_ID]);

    assert(notesRes.rows.length === 1 && notesRes.rows[0].id === '11111111-1111-4000-a000-000000000311',
      'Client-visible meeting note is ALLOWED for Client Alpha');
    assert(!notesRes.rows.some(r => r.id === '11111111-1111-4000-a000-000000000312'),
      'Internal meeting note is strictly DENIED/HIDDEN (0 rows returned)');

    // 2. Meeting Decisions Visibility
    const decisionsRes = await c.query(`
      SELECT id, decision_text, is_client_visible 
      FROM public.meeting_decisions 
      WHERE meeting_id = $1;
    `, [MEET_ALPHA_VIS_ID]);

    assert(decisionsRes.rows.length === 1 && decisionsRes.rows[0].id === '11111111-1111-4000-a000-000000000321',
      'Client-visible decision is ALLOWED for Client Alpha');
    assert(!decisionsRes.rows.some(r => r.id === '11111111-1111-4000-a000-000000000322'),
      'Internal decision is strictly DENIED/HIDDEN (0 rows returned)');

    // 3. Meeting Documents & Published Versions Visibility
    const docsRes = await c.query(`
      SELECT md.id, md.document_id, d.title, d.is_client_visible
      FROM public.meeting_documents md
      JOIN public.documents d ON d.id = md.document_id
      WHERE md.meeting_id = $1;
    `, [MEET_ALPHA_VIS_ID]);

    assert(docsRes.rows.length === 1 && docsRes.rows[0].document_id === DOC_ALPHA_REVIEW_ID,
      'Attached document is ALLOWED for Client Alpha');

    const versionsRes = await c.query(`
      SELECT id, version_number, original_filename, is_client_visible
      FROM public.document_versions
      WHERE document_id = $1
      ORDER BY version_number ASC;
    `, [DOC_ALPHA_REVIEW_ID]);

    const verNumbers = versionsRes.rows.map(r => r.version_number);
    assert(verNumbers.length === 2 && verNumbers.includes(1) && verNumbers.includes(3),
      `Only published versions (v1, v3) are visible. Got: [${verNumbers.join(', ')}]`);
    assert(!versionsRes.rows.some(r => r.version_number === 2),
      'Unpublished version v2 is strictly DENIED/HIDDEN');

    // 4. Meeting Participants (Client-Safe Projection)
    const partsRes = await c.query(`
      SELECT id, participant_type, user_id, contact_id, attendance_status
      FROM public.meeting_participants
      WHERE meeting_id = $1;
    `, [MEET_ALPHA_VIS_ID]);

    assert(partsRes.rows.length === 2,
      `Participants list contains both FIRSTWIN member and Client Contact (count: ${partsRes.rows.length})`);

    // 5. Linked Client Action via source_meeting_id
    const tasksRes = await c.query(`
      SELECT id, title, responsibility_type, is_client_visible, source_meeting_id
      FROM public.tasks
      WHERE source_meeting_id = $1;
    `, [MEET_ALPHA_VIS_ID]);

    assert(tasksRes.rows.length === 1 && tasksRes.rows[0].id === '11111111-1111-4000-a000-000000000101',
      'Client Action linked to meeting via source_meeting_id is ALLOWED');
  });

  console.log(`\n========================================`);
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
