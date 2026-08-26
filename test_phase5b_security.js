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

  console.log('=== Phase 5B: Notifications & Personal Inbox Security Suite ===\n');

  // 1. Personal Inbox Isolation: Owner sees only Owner's notifications
  await runSession(OWNER_USER_ID, async (c) => {
    const notifs = await c.query(`SELECT id, recipient_user_id, title FROM public.notifications;`);
    assert(notifs.rows.length >= 5, `Owner can fetch their own notifications (count: ${notifs.rows.length})`);
    assert(notifs.rows.every(r => r.recipient_user_id === OWNER_USER_ID), 'Owner sees ONLY notifications where recipient_user_id = Owner ID');
  });

  // 2. Personal Inbox Isolation: PM sees only PM's notifications
  await runSession(PM_USER_ID, async (c) => {
    const notifs = await c.query(`SELECT id, recipient_user_id, title FROM public.notifications;`);
    assert(notifs.rows.length >= 1, `PM Tester Alpha fetches their personal notifications (count: ${notifs.rows.length})`);
    assert(notifs.rows.every(r => r.recipient_user_id === PM_USER_ID), 'PM sees ONLY notifications where recipient_user_id = PM ID');
    assert(!notifs.rows.some(r => r.recipient_user_id === OWNER_USER_ID), 'PM CANNOT see Owner notifications');
  });

  // 3. Personal Inbox Isolation: Specialist sees only Specialist's notifications
  await runSession(SPECIALIST_USER_ID, async (c) => {
    const notifs = await c.query(`SELECT id, recipient_user_id, title FROM public.notifications;`);
    assert(notifs.rows.length >= 1, `Specialist Tester Alpha fetches their personal notifications (count: ${notifs.rows.length})`);
    assert(notifs.rows.every(r => r.recipient_user_id === SPECIALIST_USER_ID), 'Specialist sees ONLY notifications where recipient_user_id = Specialist ID');
    assert(!notifs.rows.some(r => r.recipient_user_id === OWNER_USER_ID || r.recipient_user_id === PM_USER_ID), 'Specialist CANNOT see Owner or PM notifications');
  });

  // 4. Default Deny: Client users cannot read internal notifications
  await runSession(CLIENT_ALPHA_USER_ID, async (c) => {
    const notifs = await c.query(`SELECT id, recipient_user_id, title FROM public.notifications;`);
    assert(notifs.rows.every(r => r.recipient_user_id === CLIENT_ALPHA_USER_ID), 'Client Alpha sees ONLY notifications addressed to their personal user ID');
  });

  await runSession(CLIENT_BETA_USER_ID, async (c) => {
    const notifs = await c.query(`SELECT id, recipient_user_id, title FROM public.notifications;`);
    assert(notifs.rows.every(r => r.recipient_user_id === CLIENT_BETA_USER_ID), 'Client Beta sees ONLY notifications addressed to their personal user ID');
  });

  // 5. Browser Direct Insert Protection (RLS Disallowed)
  await runSession(SPECIALIST_USER_ID, async (c) => {
    let insertFailed = false;
    try {
      await c.query(`
        INSERT INTO public.notifications (
          recipient_user_id, severity, title, message, deep_link, event_type
        ) VALUES (
          $1, 'critical', 'Fake notification', 'Hacked message', '#/portal', 'custom_hack'
        );
      `, [SPECIALIST_USER_ID]);
    } catch (err) {
      insertFailed = true;
    }
    assert(insertFailed, 'Direct arbitrary client INSERT into public.notifications is STRICTLY BLOCKED by RLS');
  });

  // 6. Notification Evaluator & Idempotency
  await runDirectQuery(async (c) => {
    const countBefore = await c.query(`SELECT count(*) FROM public.notifications;`);
    const evalRes1 = await c.query(`SELECT public.evaluate_notifications();`);
    assert(evalRes1.rows[0].evaluate_notifications.success === true, 'evaluate_notifications() executes successfully');

    const countAfter1 = await c.query(`SELECT count(*) FROM public.notifications;`);
    const evalRes2 = await c.query(`SELECT public.evaluate_notifications();`);
    const countAfter2 = await c.query(`SELECT count(*) FROM public.notifications;`);

    assert(parseInt(countAfter1.rows[0].count, 10) === parseInt(countAfter2.rows[0].count, 10),
      `evaluate_notifications() is strictly IDEMPOTENT via dedupe_key (count stable at ${countAfter2.rows[0].count})`);
  });

  // 7. Mark as Read & Mark All as Read RPCs
  await runSession(OWNER_USER_ID, async (c) => {
    const notifs = await c.query(`SELECT id, is_read FROM public.notifications WHERE is_read = false LIMIT 1;`);
    if (notifs.rows.length > 0) {
      const targetId = notifs.rows[0].id;
      const res = await c.query(`SELECT public.mark_notification_as_read($1);`, [targetId]);
      assert(res.rows[0].mark_notification_as_read.success === true, 'mark_notification_as_read() executes successfully');

      const check = await c.query(`SELECT is_read, read_at FROM public.notifications WHERE id = $1;`, [targetId]);
      assert(check.rows[0].is_read === true && check.rows[0].read_at !== null, 'Notification marked as read with non-null read_at timestamp');
    }

    const unreadCountBefore = await c.query(`SELECT public.get_unread_notifications_count();`);
    const markAllRes = await c.query(`SELECT public.mark_all_notifications_as_read();`);
    assert(markAllRes.rows[0].mark_all_notifications_as_read.success === true, 'mark_all_notifications_as_read() executes successfully');

    const unreadCountAfter = await c.query(`SELECT public.get_unread_notifications_count();`);
    assert(parseInt(unreadCountAfter.rows[0].get_unread_notifications_count, 10) === 0, 'get_unread_notifications_count() returns 0 after mark_all_notifications_as_read()');
  });

  console.log(`\n========================================`);
  console.log(`Phase 5B Security & Logic Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
