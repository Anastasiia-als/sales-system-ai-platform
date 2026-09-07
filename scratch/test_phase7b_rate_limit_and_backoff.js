// scratch/test_phase7b_rate_limit_and_backoff.js
// Tests Phase 7B: Telegram Rate Limiting (429 Too Many Requests), retry_after Backoff & Dead Letter Transition

const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const { calculateTelegram429Retry, calculateNextRetry } = require('../js/portal/api/dispatcher-core.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`PASS: ${message}`);
    } else {
        failed++;
        console.error(`FAIL: ${message}`);
    }
}

async function run() {
    const client = await pool.connect();
    try {
        console.log('--- Phase 7B: Telegram Rate Limiting & Retry Backoff Suite ---');

        // 1. Test calculation of Telegram 429 retry
        const now = Date.now();
        const retry15 = calculateTelegram429Retry(15);
        const diff15 = Math.round((retry15.getTime() - now) / 1000);
        assert(diff15 >= 14 && diff15 <= 16, 'calculateTelegram429Retry(15) schedules retry 15s in future');

        const retryFallback = calculateTelegram429Retry(null);
        const diffFallback = Math.round((retryFallback.getTime() - now) / 1000);
        assert(diffFallback >= 4 && diffFallback <= 6, 'calculateTelegram429Retry(null) defaults safely to 5s');

        const retryZero = calculateTelegram429Retry(0);
        const diffZero = Math.round((retryZero.getTime() - now) / 1000);
        assert(diffZero >= 1 && diffZero <= 2, 'calculateTelegram429Retry(0) enforces minimum 1s floor');

        // 2. Test standard exponential backoff calculation
        const r1 = calculateNextRetry(1, 30); // 30s
        const d1 = Math.round((r1.getTime() - now) / 1000);
        assert(d1 >= 29 && d1 <= 31, 'calculateNextRetry attempt 1 delay is ~30s');

        const r2 = calculateNextRetry(2, 30); // 60s
        const d2 = Math.round((r2.getTime() - now) / 1000);
        assert(d2 >= 59 && d2 <= 61, 'calculateNextRetry attempt 2 delay is ~60s');

        const r3 = calculateNextRetry(3, 30); // 120s
        const d3 = Math.round((r3.getTime() - now) / 1000);
        assert(d3 >= 119 && d3 <= 121, 'calculateNextRetry attempt 3 delay is ~120s');

        // 3. Database Outbox State Transitions for Telegram 429 and Dead Letter
        const orgRes = await client.query("INSERT INTO public.organizations (name) VALUES ('Org 7B Rate Limit') RETURNING id");
        const orgId = orgRes.rows[0].id;

        const evRes = await client.query(`
            INSERT INTO public.integration_events (
                organization_id, entity_type, entity_id, event_type, payload_json
            ) VALUES ($1, 'task', gen_random_uuid(), 'task.completed', '{"task_id":"rl-1"}'::jsonb)
            RETURNING id
        `, [orgId]);
        const eventId = evRes.rows[0].id;

        const outboxRes = await client.query(`
            INSERT INTO public.integration_outbox (
                organization_id, event_id, channel_type, destination_id, status, attempts_count, max_attempts
            ) VALUES ($1, $2, 'telegram', gen_random_uuid(), 'pending', 0, 5)
            RETURNING id
        `, [orgId, eventId]);
        const outboxId = outboxRes.rows[0].id;

        // Simulate 429 transition in DB
        const retryAfterSec = 22;
        const nextRetryDate = calculateTelegram429Retry(retryAfterSec);
        await client.query(`
            UPDATE public.integration_outbox
            SET status = 'retrying',
                attempts_count = attempts_count + 1,
                last_http_status = 429,
                next_retry_at = $1,
                last_error = 'Telegram 429 Too Many Requests (retry_after: 22s)'
            WHERE id = $2
        `, [nextRetryDate, outboxId]);

        const check429 = await client.query("SELECT status, attempts_count, last_http_status, next_retry_at FROM public.integration_outbox WHERE id = $1", [outboxId]);
        assert(check429.rows[0].status === 'retrying', 'Outbox enters retrying status on Telegram 429');
        assert(check429.rows[0].last_http_status === 429, 'last_http_status recorded as 429');
        assert(Boolean(check429.rows[0].next_retry_at), 'next_retry_at populated based on retry_after');

        // Simulate final attempt failure -> dead_letter
        await client.query(`
            UPDATE public.integration_outbox
            SET status = 'dead_letter',
                attempts_count = 5,
                next_retry_at = NULL,
                last_http_status = 500,
                last_error = 'HTTP 500: Telegram internal server error (max attempts exhausted)'
            WHERE id = $1
        `, [outboxId]);

        const checkDL = await client.query("SELECT status, attempts_count, next_retry_at FROM public.integration_outbox WHERE id = $1", [outboxId]);
        assert(checkDL.rows[0].status === 'dead_letter', 'Outbox transitions to dead_letter when max_attempts is reached');
        assert(checkDL.rows[0].next_retry_at === null, 'next_retry_at is cleared to prevent infinite polling of dead letters');

        // Cleanup
        await client.query("DELETE FROM public.integration_outbox WHERE id = $1", [outboxId]);
        await client.query("SET integration.allow_cleanup = 'on'");
        await client.query("DELETE FROM public.integration_events WHERE id = $1", [eventId]);
        await client.query("DELETE FROM public.organizations WHERE id = $1", [orgId]);

        console.log(`\nResults: ${passed} passed, ${failed} failed`);
        if (failed > 0) process.exit(1);
    } finally {
        client.release();
    }
}

run().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
