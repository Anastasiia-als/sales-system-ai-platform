/* js/portal/api/dispatcher-worker.js - Autonomous Outbox Dispatcher Worker
 * Phase 7A & 7B: Integration Core, Webhook & Telegram Delivery Engine
 *
 * Responsibilities:
 * 1. Transactionally claims pending/retrying deliveries from public.integration_outbox (SKIP LOCKED)
 * 2. Fetches decrypted endpoint URLs, HMAC secrets, and Telegram Bot tokens from Supabase Vault
 * 3. Enforces SSRF and DNS rebinding protections
 * 4. Enforces HTTP 3xx redirect rejection (marks rejected_ssrf)
 * 5. Webhook delivery: generates exact-byte HMAC-SHA256 signatures (X-Firstwin-Signature-256)
 * 6. Telegram delivery: formats MarkdownV2, escapes reserved chars, handles HTTP 429 parameters.retry_after
 * 7. Server connection verification for Telegram (getMe + getChat + topic check)
 * 8. Manages Outbox lifecycle: pending -> processing -> delivered / retrying / dead_letter / rejected_ssrf
 */

const { Pool } = require('pg');
const {
    validateDestinationUrl,
    signWebhookPayload,
    calculateNextRetry,
    buildWebhookEnvelope,
    escapeTelegramMarkdownV2,
    formatTelegramMessage,
    validateTelegramApiEndpoint,
    calculateTelegram429Retry
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
let mockTelegramMode = process.env.TELEGRAM_MOCK_TRANSPORT === 'true';

function setTelegramMockMode(enabled) {
    mockTelegramMode = Boolean(enabled);
    console.log(`[OUTBOX WORKER] Telegram mock mode set to: ${mockTelegramMode}`);
}

function getTelegramMockMode() {
    return mockTelegramMode;
}

/**
 * Dispatches a single Webhook Outbox row.
 */
async function dispatchWebhookOutbox(pool, row) {
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

            // HTTP 3xx redirects strictly rejected as rejected_ssrf
            if (fetchErr.message && (fetchErr.message.includes('redirect') || fetchErr.message.includes('Redirect'))) {
                await pool.query(
                    "UPDATE public.integration_outbox SET status = 'rejected_ssrf', last_error = 'HTTP 3xx redirect rejected by SSRF guard', updated_at = NOW() WHERE id = $1",
                    [outboxId]
                );
                return { id: outboxId, status: 'rejected_ssrf', reason: 'redirect_rejected' };
            }

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
        console.error(`[OUTBOX DISPATCHER] Unexpected error processing webhook outbox ${outboxId}:`, err.message);
        await pool.query(
            "UPDATE public.integration_outbox SET status = 'retrying', last_error = $1, updated_at = NOW() WHERE id = $2",
            [err.message, outboxId]
        );
        return { id: outboxId, status: 'retrying', error: err.message };
    }
}

/**
 * Dispatches a single Telegram Outbox row (Phase 7B).
 */
async function dispatchTelegramOutbox(pool, row) {
    const outboxId = row.id;

    try {
        // 1. Validate destination status and tenant matching
        if (!row.td_is_active || row.td_org_id !== row.organization_id) {
            await pool.query(
                "UPDATE public.integration_outbox SET status = 'failed', last_error = 'Telegram destination inactive or tenant mismatch', updated_at = NOW() WHERE id = $1",
                [outboxId]
            );
            return { id: outboxId, status: 'failed', reason: 'inactive_or_mismatch' };
        }

        // 2. Fetch decrypted bot token from Vault
        const secRes = await pool.query(
            'SELECT * FROM public.get_telegram_destination_secret_internal($1, $2)',
            [row.destination_id, row.organization_id]
        );

        if (!secRes.rows.length || !secRes.rows[0].decrypted_bot_token) {
            await pool.query(
                "UPDATE public.integration_outbox SET status = 'failed', last_error = 'Failed to decrypt Telegram bot token from Vault', updated_at = NOW() WHERE id = $1",
                [outboxId]
            );
            return { id: outboxId, status: 'failed', reason: 'missing_vault_secret' };
        }

        const { decrypted_bot_token, chat_id, thread_id } = secRes.rows[0];

        // 3. Construct Telegram URL and validate SSRF restriction
        const tgUrl = `https://api.telegram.org/bot${decrypted_bot_token}/sendMessage`;
        const urlValidation = validateTelegramApiEndpoint(tgUrl);
        if (!urlValidation.valid) {
            await pool.query(
                "UPDATE public.integration_outbox SET status = 'rejected_ssrf', last_error = $1, updated_at = NOW() WHERE id = $2",
                ['SSRF guard rejected Telegram endpoint: ' + urlValidation.reason, outboxId]
            );
            return { id: outboxId, status: 'rejected_ssrf', reason: urlValidation.reason };
        }

        // 4. Format canonical message in MarkdownV2
        const messageText = formatTelegramMessage({
            id: row.ev_id,
            event_type: row.event_type,
            created_at: row.ev_created_at,
            organization_id: row.ev_org_id,
            project_id: row.ev_project_id,
            payload_json: row.payload_json,
            organization_name: row.organization_name
        });

        const tgPayload = {
            chat_id: chat_id,
            text: messageText,
            parse_mode: 'MarkdownV2'
        };

        if (thread_id) {
            tgPayload.message_thread_id = Number(thread_id);
        }

        // Mock mode interceptor: validate and format message without external HTTP calls
        if (mockTelegramMode || process.env.TELEGRAM_MOCK_TRANSPORT === 'true') {
            console.log(`[OUTBOX DISPATCHER MOCK] Intercepted Telegram delivery for outbox ${outboxId} (chat_id: ${chat_id}) in mock mode`);
            const mockResponse = {
                ok: true,
                result: {
                    message_id: 999999,
                    chat: { id: chat_id },
                    date: Math.floor(Date.now() / 1000),
                    text: messageText,
                    mock: true
                }
            };
            await pool.query(
                "UPDATE public.integration_outbox SET status = 'delivered', delivered_at = NOW(), last_http_status = 200, last_error = NULL, response_body_preview = $1, updated_at = NOW() WHERE id = $2",
                [JSON.stringify(mockResponse).slice(0, 1000), outboxId]
            );
            return { id: outboxId, status: 'delivered', http_status: 200, mock: true };
        }

        // 5. Execute HTTPS POST delivery
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        let response;
        let responseBody = null;
        try {
            response = await fetch(tgUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tgPayload),
                redirect: 'error',
                signal: controller.signal
            });

            try {
                responseBody = await response.json();
            } catch (_) {
                responseBody = null;
            }
        } catch (fetchErr) {
            clearTimeout(timeout);

            if (fetchErr.message && (fetchErr.message.includes('redirect') || fetchErr.message.includes('Redirect'))) {
                await pool.query(
                    "UPDATE public.integration_outbox SET status = 'rejected_ssrf', last_error = 'HTTP 3xx redirect rejected by Telegram SSRF guard', updated_at = NOW() WHERE id = $1",
                    [outboxId]
                );
                return { id: outboxId, status: 'rejected_ssrf', reason: 'redirect_rejected' };
            }

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

        // 6. Handle Telegram Response
        if (response.ok && responseBody && responseBody.ok) {
            await pool.query(
                "UPDATE public.integration_outbox SET status = 'delivered', delivered_at = NOW(), last_http_status = $1, last_error = NULL, updated_at = NOW() WHERE id = $2",
                [response.status, outboxId]
            );
            console.log(`[OUTBOX DISPATCHER] Successfully delivered Telegram message for outbox ${outboxId} (HTTP ${response.status})`);
            return { id: outboxId, status: 'delivered', http_status: response.status };
        } else if (response.status === 429) {
            // Telegram Rate Limit (Too Many Requests)
            const retryAfterSec = responseBody?.parameters?.retry_after || 5;
            const nextRetry = calculateTelegram429Retry(retryAfterSec);
            const errMsg = `Telegram 429 Too Many Requests (retry_after: ${retryAfterSec}s)`;

            await pool.query(
                "UPDATE public.integration_outbox SET status = 'retrying', next_retry_at = $1, last_http_status = 429, last_error = $2, updated_at = NOW() WHERE id = $3",
                [nextRetry, errMsg, outboxId]
            );
            console.warn(`[OUTBOX DISPATCHER] Telegram 429 rate limit for ${outboxId}, scheduled retry at ${nextRetry.toISOString()}`);
            return { id: outboxId, status: 'retrying', http_status: 429, retry_after: retryAfterSec };
        } else {
            const isFinal = row.attempts_count >= row.max_attempts;
            const nextRetry = isFinal ? null : calculateNextRetry(row.attempts_count);
            const newStatus = isFinal ? 'dead_letter' : 'retrying';
            const desc = responseBody?.description || response.statusText || 'Telegram delivery failed';

            await pool.query(
                "UPDATE public.integration_outbox SET status = $1, next_retry_at = $2, last_http_status = $3, last_error = $4, updated_at = NOW() WHERE id = $5",
                [newStatus, nextRetry, response.status, `HTTP ${response.status}: ${desc}`, outboxId]
            );
            console.warn(`[OUTBOX DISPATCHER] Telegram delivery failed for ${outboxId} (HTTP ${response.status}): ${desc}`);
            return { id: outboxId, status: newStatus, http_status: response.status, error: desc };
        }
    } catch (err) {
        console.error(`[OUTBOX DISPATCHER] Unexpected error processing Telegram outbox ${outboxId}:`, err.message);
        await pool.query(
            "UPDATE public.integration_outbox SET status = 'retrying', last_error = $1, updated_at = NOW() WHERE id = $2",
            [err.message, outboxId]
        );
        return { id: outboxId, status: 'retrying', error: err.message };
    }
}

/**
 * Dispatches a single Outbox row (routes to Webhook or Telegram based on channel_type).
 */
async function dispatchSingleOutbox(pool, row) {
    if (row.channel_type === 'telegram') {
        return dispatchTelegramOutbox(pool, row);
    }
    return dispatchWebhookOutbox(pool, row);
}

/**
 * Polls and processes pending / retrying outbox records across all channels.
 */
async function processPendingOutbox(limit = 10) {
    if (isProcessing) return { processed: 0, status: 'already_running' };
    isProcessing = true;

    const pool = getPool();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Claim pending / retrying rows across Webhook and Telegram channels
        const claimQuery = `
            SELECT o.id, o.organization_id, o.event_id, o.channel_type, o.destination_id,
                   o.status, o.attempts_count, o.max_attempts,
                   e.id as ev_id, e.event_type, e.created_at as ev_created_at,
                   e.organization_id as ev_org_id, e.project_id as ev_project_id,
                   e.payload_json,
                   org.name as organization_name,
                   -- Webhook endpoint fields (nullable for telegram)
                   ep.is_active as ep_is_active, ep.organization_id as ep_org_id,
                   ep.url_hostname, ep.url_secret_id, ep.signing_secret_id,
                   -- Telegram destination fields (nullable for webhook)
                   td.is_active as td_is_active, td.organization_id as td_org_id,
                   td.chat_id as td_chat_id, td.thread_id as td_thread_id,
                   td.bot_username as td_bot_username, td.name as td_name
            FROM public.integration_outbox o
            JOIN public.integration_events e ON o.event_id = e.id
            LEFT JOIN public.organizations org ON o.organization_id = org.id
            LEFT JOIN public.integration_endpoints ep ON o.destination_id = ep.id AND o.channel_type = 'webhook'
            LEFT JOIN public.telegram_destinations td ON o.destination_id = td.id AND o.channel_type = 'telegram'
            WHERE o.channel_type IN ('webhook', 'telegram')
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
 * Server-side connection verification for Telegram:
 * 1. getMe: validates bot token, retrieves bot_id and bot_username
 * 2. getChat: validates chat access, retrieves chat_title, chat_type, and is_forum
 * 3. validates thread_id against is_forum
 * Zero token leakage in logs, response body or tables.
 */
async function verifyTelegramConnection({ bot_token, chat_id, thread_id }) {
    if (!bot_token || typeof bot_token !== 'string') {
        return { ok: false, reason: 'missing_token', error: 'Bot Token обов\'язковий' };
    }
    if (!chat_id || typeof chat_id !== 'string') {
        return { ok: false, reason: 'missing_chat_id', error: 'Chat ID обов\'язковий' };
    }

    const cleanToken = bot_token.trim();
    const cleanChatId = chat_id.trim();

    try {
        // Step 1: Verify Bot Token via getMe
        const meRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            redirect: 'error'
        });
        const meData = await meRes.json();
        if (!meRes.ok || !meData.ok) {
            return {
                ok: false,
                reason: 'invalid_bot_token',
                error: meData.description || 'Недійсний Bot Token'
            };
        }

        const botInfo = {
            id: meData.result.id,
            username: meData.result.username,
            first_name: meData.result.first_name
        };

        // Step 2: Verify Chat Access via getChat
        const chatRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getChat?chat_id=${encodeURIComponent(cleanChatId)}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            redirect: 'error'
        });
        const chatData = await chatRes.json();
        if (!chatRes.ok || !chatData.ok) {
            return {
                ok: false,
                reason: 'chat_not_accessible',
                error: chatData.description || 'Чат не знайдено або бота не додано до чату'
            };
        }

        const chatResult = chatData.result;
        const chatInfo = {
            id: String(chatResult.id),
            title: chatResult.title || chatResult.username || chatResult.first_name || cleanChatId,
            type: chatResult.type,
            is_forum: Boolean(chatResult.is_forum)
        };

        // Step 3: Validate Topic/Thread ID if specified
        if (thread_id !== undefined && thread_id !== null && String(thread_id).trim() !== '') {
            if (chatResult.type !== 'supergroup' || !chatResult.is_forum) {
                return {
                    ok: false,
                    reason: 'topic_requires_forum_supergroup',
                    error: 'Вказання Topic ID можливе лише для супергруп із увімкненими темами (Forum Supergroup)'
                };
            }
        }

        return {
            ok: true,
            bot: botInfo,
            chat: chatInfo
        };
    } catch (err) {
        return {
            ok: false,
            reason: 'network_or_system_error',
            error: err.message
        };
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
    dispatchSingleOutbox,
    verifyTelegramConnection,
    setTelegramMockMode,
    getTelegramMockMode,
    getPool
};
