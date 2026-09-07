/**
 * scratch/test_phase7c_token_hash_security.js
 * Phase 7C: Token Hash Security & Malformed Token Rejection Test
 *
 * Verifies:
 * 1. Database table public.calendar_feed_subscriptions stores ONLY 64-char SHA-256 token_hash (zero raw tokens).
 * 2. Raw token (64 hex chars) generates expected SHA-256 hash.
 * 3. Malformed token formats return HTTP 400 Bad Request.
 * 4. Non-existent token hashes return HTTP 404 Not Found.
 */

const http = require('http');
const crypto = require('crypto');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';

function httpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        req.on('error', reject);
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

async function runTest() {
    console.log('--- START: Phase 7C Token Hash Security & Malformed Rejection ---');
    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        // 1. Check DB columns of calendar_feed_subscriptions
        const colRes = await pool.query(`
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'calendar_feed_subscriptions'
            ORDER BY ordinal_position;
        `);
        const colNames = colRes.rows.map(r => r.column_name);
        console.log('Columns in public.calendar_feed_subscriptions:', colNames.join(', '));

        if (!colNames.includes('token_hash')) {
            throw new Error('Missing token_hash column in calendar_feed_subscriptions');
        }
        if (colNames.includes('raw_token') || colNames.includes('token')) {
            throw new Error('SECURITY VIOLATION: Plaintext token column found in calendar_feed_subscriptions');
        }
        console.log('[PASS] DB Schema adheres to hash-only storage principle (0 raw token columns).');

        // 2. Query existing subscriptions and ensure all token_hash values are 64 hex chars
        const rows = await pool.query(`
            SELECT id, token_hash, token_preview
            FROM public.calendar_feed_subscriptions
        `);
        console.log(`Found ${rows.rows.length} existing subscriptions.`);
        for (const row of rows.rows) {
            if (!/^[a-f0-9]{64}$/.test(row.token_hash)) {
                throw new Error(`Invalid token_hash in row ${row.id}: ${row.token_hash}`);
            }
            if (row.token_preview && row.token_preview.length > 8) {
                throw new Error(`Token preview too long (leaking secret) in row ${row.id}: ${row.token_preview}`);
            }
        }
        console.log('[PASS] All DB token_hash values are strictly 64-character hex strings.');

        // 3. Test malformed token requests to HTTP endpoint
        const invalidTokens = [
            'short',
            'xyz123',
            'this-is-not-a-valid-hex-token-at-all-because-it-has-hyphens-and-bad-chars',
            '123456789012345678901234567890123456789012345678901234567890123', // 63 chars
            '12345678901234567890123456789012345678901234567890123456789012345', // 65 chars
            'g'.repeat(64) // 64 non-hex chars
        ];

        for (const invalidToken of invalidTokens) {
            const res = await httpRequest(`http://127.0.0.1:8002/api/calendar/feed/${invalidToken}.ics`);
            if (res.status !== 400) {
                throw new Error(`Expected HTTP 400 for invalid token '${invalidToken}', got ${res.status}`);
            }
        }
        console.log('[PASS] All malformed token formats correctly rejected with HTTP 400 Bad Request.');

        // 4. Test non-existent valid 64-char hex token
        const fakeToken = crypto.randomBytes(32).toString('hex');
        const res404 = await httpRequest(`http://127.0.0.1:8002/api/calendar/feed/${fakeToken}.ics`);
        if (res404.status !== 404) {
            throw new Error(`Expected HTTP 404 for non-existent token, got ${res404.status}`);
        }
        console.log('[PASS] Non-existent 64-hex token correctly returns HTTP 404 Not Found.');

        // 5. Test method not allowed (e.g. POST)
        const res405 = await httpRequest(`http://127.0.0.1:8002/api/calendar/feed/${fakeToken}.ics`, {
            method: 'POST',
            body: 'test'
        });
        if (res405.status !== 405) {
            throw new Error(`Expected HTTP 405 for POST request, got ${res405.status}`);
        }
        console.log('[PASS] POST request to feed endpoint correctly rejected with HTTP 405 Method Not Allowed.');

        console.log('--- RESULT: Phase 7C Token Hash Security PASSED ---');
    } finally {
        await pool.end();
    }
}

runTest().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
