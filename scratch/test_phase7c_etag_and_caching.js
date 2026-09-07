/**
 * scratch/test_phase7c_etag_and_caching.js
 * Phase 7C: HTTP Caching (ETag / If-None-Match 304) and Access Metrics Test
 *
 * Verifies:
 * 1. Initial GET returns HTTP 200 with ETag, Last-Modified, Cache-Control headers.
 * 2. Conditional GET with If-None-Match matching ETag returns HTTP 304 Not Modified.
 * 3. Body of HTTP 304 is 0 bytes (saves bandwidth for mobile/external calendar polling).
 * 4. HEAD request returns HTTP 200 with headers but empty body.
 * 5. access_count is incremented and last_accessed_at is recorded in DB.
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
        req.end();
    });
}

async function runTest() {
    console.log('--- START: Phase 7C ETag and Caching Test Suite ---');
    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        // 1. Fetch Demo Client Corp org and owner
        const orgRes = await pool.query(`
            SELECT o.id as org_id, o.name as org_name, p.id as project_id, pr.id as user_id
            FROM public.organizations o
            JOIN public.projects p ON p.organization_id = o.id
            CROSS JOIN (SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1) pr
            WHERE o.name = 'Demo Client Corp'
            LIMIT 1;
        `);

        if (orgRes.rows.length === 0) {
            throw new Error('Demo Client Corp org not found');
        }

        const { org_id, project_id, user_id } = orgRes.rows[0];

        // 2. Create subscription
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const tokenPreview = rawToken.substring(0, 6);

        const subRes = await pool.query(`
            INSERT INTO public.calendar_feed_subscriptions (
                organization_id, created_by, project_id, name, feed_scope, token_hash, token_preview, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
            RETURNING id;
        `, [org_id, user_id, project_id, 'Caching Test Feed', 'project', tokenHash, tokenPreview]);

        const subscriptionId = subRes.rows[0].id;
        console.log(`Created test subscription ${subscriptionId}`);

        // 3. Initial GET request
        const res1 = await httpRequest(`http://127.0.0.1:8002/api/calendar/feed/${rawToken}.ics`);
        console.log(`GET 1 Status: ${res1.status}, ETag: ${res1.headers['etag']}, Last-Modified: ${res1.headers['last-modified']}`);

        if (res1.status !== 200) {
            throw new Error(`Expected HTTP 200, got ${res1.status}`);
        }
        if (!res1.headers['etag']) {
            throw new Error('Missing ETag header in response');
        }
        if (!res1.headers['last-modified']) {
            throw new Error('Missing Last-Modified header in response');
        }
        if (!res1.headers['cache-control']?.includes('no-cache')) {
            throw new Error(`Cache-Control header missing or invalid: ${res1.headers['cache-control']}`);
        }
        console.log('[PASS] Initial GET returned 200 with valid ETag, Last-Modified, Cache-Control.');

        const etag = res1.headers['etag'];

        // 4. Conditional GET with If-None-Match matching ETag
        const res2 = await httpRequest(`http://127.0.0.1:8002/api/calendar/feed/${rawToken}.ics`, {
            headers: {
                'If-None-Match': etag
            }
        });
        console.log(`GET 2 (Conditional) Status: ${res2.status}, Body length: ${res2.body.length}`);

        if (res2.status !== 304) {
            throw new Error(`Expected HTTP 304 Not Modified, got ${res2.status}`);
        }
        if (res2.body.length !== 0) {
            throw new Error(`HTTP 304 response body must be empty, received ${res2.body.length} bytes`);
        }
        console.log('[PASS] Conditional request returned HTTP 304 Not Modified with zero-byte body.');

        // 5. Test HEAD request
        const resHead = await httpRequest(`http://127.0.0.1:8002/api/calendar/feed/${rawToken}.ics`, {
            method: 'HEAD'
        });
        console.log(`HEAD Status: ${resHead.status}, Body length: ${resHead.body.length}`);

        if (resHead.status !== 200) {
            throw new Error(`Expected HTTP 200 for HEAD, got ${resHead.status}`);
        }
        if (resHead.body.length !== 0) {
            throw new Error(`HEAD body must be empty, got ${resHead.body.length} bytes`);
        }
        console.log('[PASS] HEAD request returned HTTP 200 with headers and zero-byte body.');

        // Wait a tick for async access metrics logging
        await new Promise(r => setTimeout(r, 200));

        // 6. Verify access metrics in DB
        const metricRes = await pool.query(`
            SELECT access_count, last_accessed_at
            FROM public.calendar_feed_subscriptions
            WHERE id = $1;
        `, [subscriptionId]);

        const { access_count, last_accessed_at } = metricRes.rows[0];
        console.log(`DB Metrics: access_count = ${access_count}, last_accessed_at = ${last_accessed_at}`);

        if (!last_accessed_at) {
            throw new Error('last_accessed_at was not updated in DB');
        }
        if (access_count < 2) {
            throw new Error(`access_count expected >= 2, got ${access_count}`);
        }
        console.log('[PASS] Access metrics successfully logged and incremented in DB.');

        // Cleanup
        await pool.query('DELETE FROM public.calendar_feed_subscriptions WHERE id = $1', [subscriptionId]);
        console.log('Cleaned up test subscription.');

        console.log('--- RESULT: Phase 7C ETag and Caching PASSED ---');
    } finally {
        await pool.end();
    }
}

runTest().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
