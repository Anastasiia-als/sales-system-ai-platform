/* js/portal/api/dispatcher-worker.js - Autonomous Outbox Dispatcher Worker
 * Phase 7A: Integration Core & Outbound Webhook Delivery
 *
 * Responsibilities:
 * 1. Transactionally claims pending/retrying deliveries from public.integration_outbox
 * 2. Fetches decrypted endpoint URLs and HMAC secrets from Supabase Vault
 * 3. Enforces SSRF and DNS rebinding protections (rejects private IPs, metadata, userinfo)
 * 4. Enforces HTTP 3xx redirect rejection (marks rejected_ssrf)
 * 5. Generates exact-byte HMAC-SHA256 signatures (X-Firstwin-Signature-256)
 * 6. Dispatches HTTPS POST requests to external endpoints (e.g. webhook.site)
 * 7. Manages Outbox lifecycle: pending -> processing -> delivered / retrying / dead_letter / rejected_ssrf
 */

const { Pool } = require('pg');
const {
    validateDestinationUrl,
    signWebhookPayload,
    calculateNextRetry,
    buildWebhookEnvelope
} = require('./dispatcher-core.js');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';

let poolInstance = null;
function getPool() {
    if (!poolInstance) {
        poolInstance = new Pool({
            connectionString: DATABASE_URL,
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000
        });
        poolInstance.on('error', (err) => {
            console.error('[OUTBOX WORKER DB POOL ERROR]:', err.message);
        });
    }
    return poolInstance;
}

let isProcessing = false;
let timerId = null;

/**
 * Dispatches a single Outbox row.
 */
async function dispatchSingleOutbox(pool, row) {
    const outboxId = row.id;

    try {
        // 1. Validate endpoint status and tenant matching
        if (!row.ep_is_active || row.ep_org_id !== row.organization_id) {
            await pool.query(
                "UPDATE public.integration_outbox SET status = 'failed', last_error = 'Endpoint inactive or tenant mismatch', updated_at = NOW() WHERE id = $1",
                [outboxId]
            );
            return { id: outboxId, status: 'failed', reason: 'inactive_or_mismatch' };
        }

        // 2. Fetch decrypted secrets from Vault
        const secRes = await pool.query(
            'SELECT * FROM public.get_endpoint_secrets_internal($1, $2)',
            [row.url_secret_id, row.signing_secret_id]
        );

        if (!secRes.rows.length || !secRes.rows[0].decrypted_url || !secRes.rows[0].decrypted_signing_secret) {
            await pool.query(
                "UPDATE public.integration_outbox SET status = 'failed', last_error = 'Failed to decrypt secrets from Vault', updated_at = NOW() WHERE id = $1",
                [outboxId]
            );
            return { id: outboxId, status: 'failed', reason: 'missing_vault_secrets' };
        }

        const { decrypted_url, decrypted_signing_secret } = secRes.rows[0];

        // 3. Enforce SSRF & DNS Rebinding protection
        const isLocalMock = decrypted_url.includes('127.0.0.1') || decrypted_url.includes('localhost');
        const validation = await validateDestinationUrl(decrypted_url, { allowHttp: isLocalMock });

        if (!validation.valid) {
            await pool.query(
                "UPDATE public.integration_outbox SET status = 'rejected_ssrf', last_error = $1, updated_at = NOW() WHERE id = $2",
                ['SSRF policy rejected destination: ' + validation.reason, outboxId]
            );
            return { id: outboxId, status: 'rejected_ssrf', reason: validation.reason };
        }

        // 4. Construct canonical payload envelope
        const envelope = buildWebhookEnvelope({
            id: row.ev_id,
            event_type: row.event_type,
            created_at: row.ev_created_at,
            organization_id: row.ev_org_id,
            project_id: row.ev_project_id,
            payload_json: row.payload_json
        });

        const rawBody = JSON.stringify(envelope);
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = signWebhookPayload(decrypted_signing_secret, timestamp, rawBody);

        // 5. Execute HTTPS POST delivery
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        let response;
        try {
            response = await fetch(decrypted_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Firstwin-Timestamp': timestamp,
                    'X-Firstwin-Signature': 'sha256=' + signature,
                    'X-Firstwin-Signature-256': 'sha256=' + signature,
                    'X-Firstwin-Delivery': outboxId,
                    'X-Firstwin-Event': row.event_type
                },
                body: rawBody,
                redirect: 'error',
                signal: controller.signal
            });
        } catch (fetchErr) {
            clearTimeout(timeout);

            // Invariant #6: HTTP 3xx redirects strictly rejected as rejected_ssrf
            if (fetchErr.message && (fetchErr.message.includes('redirect') || fetchErr.message.includes('Redirect'))) {
                await pool.query(
                    "UPDATE public.integration_outbox SET status = 'rejected_ssrf', last_error = 'HTTP 3xx redirect rejected by SSRF guard', updated_at = NOW() WHERE id = $1",
                    [outboxId]
                );
                return { id: outboxId, status: 'rejected_ssrf', reason: 'redirect_rejected' };
            }

            // Other network error or timeout
            const isFinal = row.attempts_count >= row.max_attempts;
            const nextRetry = isFinal ? null : calculateNextRetry(row.attempts_count);
            const newStatus = isFinal ? 'dead_letter' : 'retrying';

            await pool.query(
                "UPDATE public.integration_outbox SET status = $1, next_retry_at = $2, last_error = $3, updated_at = NOW() WHERE id = $4",
                [newStatus, nextRetry, fetchErr.name === 'AbortError' ? 'Delivery timeout (10s)' : fetchErr.message, outboxId]
            );
            return { id: outboxId, status: newStatus, error: fetchErr.message };
        }

        clearTimeout(timeout);

        // 6. Handle HTTP Response
        if (response.ok) {
            await pool.query(
                "UPDATE public.integration_outbox SET status = 'delivered', delivered_at = NOW(), last_http_status = $1, last_error = NULL, updated_at = NOW() WHERE id = $2",
                [response.status, outboxId]
            );
            console.log(`[OUTBOX DISPATCHER] Successfully delivered outbox ${outboxId} (HTTP ${response.status}) to ${row.url_hostname}`);
            return { id: outboxId, status: 'delivered', http_status: response.status };
        } else {
            const isFinal = row.attempts_count >= row.max_attempts;
            const nextRetry = isFinal ? null : calculateNextRetry(row.attempts_count);
            const newStatus = isFinal ? 'dead_letter' : 'retrying';

            await pool.query(
                "UPDATE public.integration_outbox SET status = $1, next_retry_at = $2, last_http_status = $3, last_error = $4, updated_at = NOW() WHERE id = $5",
                [newStatus, nextRetry, response.status, `HTTP ${response.status} ${response.statusText}`, outboxId]
            );
            console.warn(`[OUTBOX DISPATCHER] Delivery failed for ${outboxId} (HTTP ${response.status}), transitioned to ${newStatus}`);
            return { id: outboxId, status: newStatus, http_status: response.status };
        }
    } catch (err) {
        console.error(`[OUTBOX DISPATCHER] Unexpected error processing outbox ${outboxId}:`, err.message);
        await pool.query(
            "UPDATE public.integration_outbox SET status = 'retrying', last_error = $1, updated_at = NOW() WHERE id = $2",
            [err.message, outboxId]
        );
        return { id: outboxId, status: 'retrying', error: err.message };
    }
}

/**
 * Polls and processes pending / retrying outbox records.
 */
async function processPendingOutbox(limit = 10) {
    if (isProcessing) return { processed: 0, status: 'already_running' };
    isProcessing = true;

    const pool = getPool();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Claim pending / retrying rows
        const claimQuery = `
            SELECT o.id, o.organization_id, o.event_id, o.channel_type, o.destination_id,
                   o.status, o.attempts_count, o.max_attempts,
                   e.id as ev_id, e.event_type, e.created_at as ev_created_at,
                   e.organization_id as ev_org_id, e.project_id as ev_project_id,
                   e.payload_json,
                   ep.is_active as ep_is_active, ep.organization_id as ep_org_id,
                   ep.url_hostname, ep.url_secret_id, ep.signing_secret_id
            FROM public.integration_outbox o
            JOIN public.integration_events e ON o.event_id = e.id
            JOIN public.integration_endpoints ep ON o.destination_id = ep.id
            WHERE o.channel_type = 'webhook'
              AND o.status IN ('pending', 'retrying')
              AND (o.next_retry_at IS NULL OR o.next_retry_at <= NOW())
            ORDER BY o.created_at ASC
            LIMIT $1
            FOR UPDATE OF o SKIP LOCKED
        `;

        const { rows } = await client.query(claimQuery, [limit]);

        if (rows.length === 0) {
            await client.query('COMMIT');
            client.release();
            return { processed: 0, results: [] };
        }

        // Atomically advance claimed rows to 'processing'
        const rowIds = rows.map(r => r.id);
        await client.query(
            "UPDATE public.integration_outbox SET status = 'processing', attempts_count = attempts_count + 1, last_attempt_at = NOW(), updated_at = NOW() WHERE id = ANY($1::uuid[])",
            [rowIds]
        );

        await client.query('COMMIT');
        client.release();

        // Dispatch claimed rows concurrently
        const results = [];
        for (const row of rows) {
            const res = await dispatchSingleOutbox(pool, row);
            results.push(res);
        }

        return { processed: results.length, results };
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch (_) {}
        if (client) client.release();
        console.error('[OUTBOX WORKER] Claim/Process loop error:', err.message);
        return { processed: 0, error: err.message };
    } finally {
        isProcessing = false;
    }
}

/**
 * Starts recurring background outbox worker.
 */
function startOutboxWorker({ pollIntervalMs = 3000 } = {}) {
    if (timerId) {
        console.log('[OUTBOX WORKER] Already active.');
        return;
    }

    console.log(`[OUTBOX WORKER] Starting Outbox Dispatcher Worker (interval: ${pollIntervalMs}ms)...`);

    // Initial immediate tick after 500ms
    setTimeout(() => {
        processPendingOutbox().catch(err => console.error('[OUTBOX WORKER TICK ERROR]:', err));
    }, 500);

    timerId = setInterval(() => {
        processPendingOutbox().catch(err => console.error('[OUTBOX WORKER TICK ERROR]:', err));
    }, pollIntervalMs);

    if (timerId.unref) {
        timerId.unref();
    }
}

/**
 * Stops recurring background outbox worker.
 */
function stopOutboxWorker() {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
        console.log('[OUTBOX WORKER] Outbox Dispatcher Worker stopped.');
    }
}

module.exports = {
    startOutboxWorker,
    stopOutboxWorker,
    processPendingOutbox,
    dispatchSingleOutbox
};
