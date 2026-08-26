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
const PM_USER_ID = '11111111-1111-1111-1111-111111111111'; // PM Tester Alpha (non-owner)
const SPECIALIST_USER_ID = '22222222-2222-2222-2222-222222222222'; // Specialist Tester Alpha (non-owner)

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

async function runDirectQuery(queryFn) {
  const client = new PgClient(DB_CONFIG);
  await client.connect();
  try {
    return await queryFn(client);
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

  console.log('=== Phase 5B.1: Notification Mutation Hardening Security Suite ===\n');

  // Find a PM notification ID and an Owner notification ID for testing
  let pmNotifId = null;
  let ownerNotifId = null;

  await runDirectQuery(async (c) => {
    const pmRows = await c.query(`SELECT id FROM public.notifications WHERE recipient_user_id = $1 LIMIT 1;`, [PM_USER_ID]);
    if (pmRows.rows.length > 0) pmNotifId = pmRows.rows[0].id;

    const ownerRows = await c.query(`SELECT id FROM public.notifications WHERE recipient_user_id = $1 LIMIT 1;`, [OWNER_USER_ID]);
    if (ownerRows.rows.length > 0) ownerNotifId = ownerRows.rows[0].id;
  });

  if (!pmNotifId) {
    console.error('No PM notification found for testing');
    process.exit(1);
  }

  // 1. Authenticated Non-Owner (PM): Allow updating own is_read
  await runSession(PM_USER_ID, async (c) => {
    let allowed = false;
    try {
      const res = await c.query(`
        UPDATE public.notifications 
        SET is_read = true 
        WHERE id = $1 AND recipient_user_id = $2
        RETURNING id, is_read, read_at;
      `, [pmNotifId, PM_USER_ID]);
      allowed = (res.rows.length === 1 && res.rows[0].is_read === true);
    } catch (e) {
      allowed = false;
    }
    assert(allowed, 'Authenticated non-owner can update own is_read -> ALLOW');
  });

  // 2. Authenticated Non-Owner (PM): Allow updating own read_at
  await runSession(PM_USER_ID, async (c) => {
    let allowed = false;
    try {
      const customDate = new Date().toISOString();
      const res = await c.query(`
        UPDATE public.notifications 
        SET read_at = $1 
        WHERE id = $2 AND recipient_user_id = $3
        RETURNING id, read_at;
      `, [customDate, pmNotifId, PM_USER_ID]);
      allowed = (res.rows.length === 1);
    } catch (e) {
      allowed = false;
    }
    assert(allowed, 'Authenticated non-owner can update own read_at -> ALLOW');
  });

  // Helper to test blocked mutation
  async function testBlockedUpdate(fieldName, updateValue, testDesc) {
    await runSession(PM_USER_ID, async (c) => {
      let blocked = false;
      try {
        await c.query(`
          UPDATE public.notifications 
          SET ${fieldName} = $1 
          WHERE id = $2;
        `, [updateValue, pmNotifId]);
      } catch (err) {
        blocked = true;
      }
      assert(blocked, `${testDesc} -> DENY`);
    });
  }

  // 3. Authenticated Non-Owner: Deny changing title
  await testBlockedUpdate('title', 'Hacked Title', 'Authenticated non-owner changing title');

  // 4. Authenticated Non-Owner: Deny changing message
  await testBlockedUpdate('message', 'Hacked Message Body', 'Authenticated non-owner changing message');

  // 5. Authenticated Non-Owner: Deny changing severity
  await runSession(PM_USER_ID, async (c) => {
    let blocked = false;
    try {
      const cur = await c.query(`SELECT severity FROM public.notifications WHERE id = $1;`, [pmNotifId]);
      const newSev = cur.rows[0]?.severity === 'critical' ? 'info' : 'critical';
      await c.query(`UPDATE public.notifications SET severity = $1 WHERE id = $2;`, [newSev, pmNotifId]);
    } catch (err) {
      blocked = true;
    }
    assert(blocked, 'Authenticated non-owner changing severity -> DENY');
  });

  // 6. Authenticated Non-Owner: Deny changing deep_link
  await testBlockedUpdate('deep_link', '#/hacked-url', 'Authenticated non-owner changing deep_link');

  // 7. Authenticated Non-Owner: Deny changing event_type
  await testBlockedUpdate('event_type', 'fake_event', 'Authenticated non-owner changing event_type');

  // 8. Authenticated Non-Owner: Deny changing recipient_user_id
  await testBlockedUpdate('recipient_user_id', SPECIALIST_USER_ID, 'Authenticated non-owner changing recipient_user_id');

  // 9. Authenticated Non-Owner: Deny changing dedupe_key
  await testBlockedUpdate('dedupe_key', 'fake_dedupe_key_123', 'Authenticated non-owner changing dedupe_key');

  // 10. Authenticated Non-Owner: Deny changing metadata
  await testBlockedUpdate('metadata', JSON.stringify({ injected: true }), 'Authenticated non-owner changing metadata');

  // 11. Authenticated Non-Owner: Deny changing created_at
  await testBlockedUpdate('created_at', new Date('2020-01-01').toISOString(), 'Authenticated non-owner changing created_at');

  // 12. Authenticated Non-Owner: Deny updating another user's notification (RLS isolation)
  await runSession(PM_USER_ID, async (c) => {
    let affectedRows = 0;
    try {
      const res = await c.query(`
        UPDATE public.notifications 
        SET is_read = true 
        WHERE id = $1;
      `, [ownerNotifId]);
      affectedRows = res.rowCount;
    } catch (e) {
      affectedRows = 0;
    }
    assert(affectedRows === 0, 'Authenticated non-owner updating another user notification -> DENY (0 rows affected)');
  });

  // 13. Authenticated Non-Owner: Deny arbitrary direct INSERT
  await runSession(PM_USER_ID, async (c) => {
    let insertBlocked = false;
    try {
      await c.query(`
        INSERT INTO public.notifications (
          recipient_user_id, severity, title, message, deep_link, event_type
        ) VALUES (
          $1, 'critical', 'Fake notification', 'Hacked message', '#/portal', 'custom_hack'
        );
      `, [PM_USER_ID]);
    } catch (e) {
      insertBlocked = true;
    }
    assert(insertBlocked, 'Authenticated non-owner arbitrary direct INSERT -> DENY');
  });

  // 14. Authenticated Non-Owner: Deny DELETE
  await runSession(PM_USER_ID, async (c) => {
    let deleteBlocked = false;
    try {
      const res = await c.query(`
        DELETE FROM public.notifications WHERE id = $1;
      `, [pmNotifId]);
      deleteBlocked = (res.rowCount === 0);
    } catch (e) {
      deleteBlocked = true;
    }
    assert(deleteBlocked, 'Authenticated non-owner direct DELETE -> DENY (0 rows or blocked)');
  });

  console.log(`\n========================================`);
  console.log(`Phase 5B.1 Mutation Security Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
