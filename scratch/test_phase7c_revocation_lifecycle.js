/**
 * scratch/test_phase7c_revocation_lifecycle.js
 * Phase 7C: Calendar Subscription Revocation & Token Rotation Lifecycle Test
 *
 * Verifies:
 * 1. Revocation: setting is_active = false immediately makes the feed return HTTP 404.
 * 2. Token rotation: updating token_hash invalidates the old token immediately (HTTP 404),
 *    while the new token immediately returns HTTP 200.
 * 3. Creator membership deactivation: when creator is deactivated in the organization,
 *    the feed immediately becomes inaccessible (HTTP 404 creator_membership_revoked).
 */

const http = require('http');
const crypto = require('crypto');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';

function httpRequest(url) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, (res) => {
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
    console.log('--- START: Phase 7C Revocation & Rotation Lifecycle Test ---');
    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        // Fetch Org, Active Project, and User
        const orgRes = await pool.query(`
            SELECT o.id as org_id, o.name as org_name, p.id as project_id, pr.id as user_id
            FROM public.organizations o
            JOIN public.projects p ON p.organization_id = o.id AND p.status = 'active'
            CROSS JOIN (SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1) pr
            WHERE o.name = 'Demo Client Corp'
            LIMIT 1;
        `);
        const { org_id, project_id, user_id } = orgRes.rows[0];

        // -----------------------------------------------------------------
        // 1. Revocation Test
        // -----------------------------------------------------------------
        const t1 = crypto.randomBytes(32).toString('hex');
        const h1 = crypto.createHash('sha256').update(t1).digest('hex');

        const s1 = await pool.query(`
            INSERT INTO public.calendar_feed_subscriptions (
                organization_id, created_by, project_id, name, feed_scope, token_hash, token_preview, is_active
            ) VALUES ($1, $2, $3, 'Revocation Test Feed', 'project', $4, 'revk01', true)
            RETURNING id;
        `, [org_id, user_id, project_id, h1]);
        const s1Id = s1.rows[0].id;

        // Verify active -> 200
        const res1Active = await httpRequest(`http://127.0.0.1:8002/api/calendar/feed/${t1}.ics`);
        if (res1Active.status !== 200) {
            throw new Error(`Expected 200 for active feed, got ${res1Active.status}`);
        }

        // Revoke
        await pool.query(`
            UPDATE public.calendar_feed_subscriptions
            SET is_active = false
            WHERE id = $1;
        `, [s1Id]);

        // Verify revoked -> 404
        const res1Revoked = await httpRequest(`http://127.0.0.1:8002/api/calendar/feed/${t1}.ics`);
        if (res1Revoked.status !== 404) {
            throw new Error(`Expected 404 for revoked feed, got ${res1Revoked.status}`);
        }
        console.log('[PASS] Revoked calendar subscription immediately returns HTTP 404.');

        // -----------------------------------------------------------------
        // 2. Token Rotation Test
        // -----------------------------------------------------------------
        const t2Old = crypto.randomBytes(32).toString('hex');
        const h2Old = crypto.createHash('sha256').update(t2Old).digest('hex');

        const s2 = await pool.query(`
            INSERT INTO public.calendar_feed_subscriptions (
                organization_id, created_by, project_id, name, feed_scope, token_hash, token_preview, is_active
            ) VALUES ($1, $2, $3, 'Rotation Test Feed', 'project', $4, 'rot001', true)
            RETURNING id;
        `, [org_id, user_id, project_id, h2Old]);
        const s2Id = s2.rows[0].id;

        // Old token works
        const res2Old = await httpRequest(`http://127.0.0.1:8002/api/calendar/feed/${t2Old}.ics`);
        if (res2Old.status !== 200) {
            throw new Error(`Expected 200 for initial token, got ${res2Old.status}`);
        }

        // Rotate token
        const t2New = crypto.randomBytes(32).toString('hex');
        const h2New = crypto.createHash('sha256').update(t2New).digest('hex');

        await pool.query(`
            UPDATE public.calendar_feed_subscriptions
            SET token_hash = $1, token_preview = $2, updated_at = now()
            WHERE id = $3;
        `, [h2New, t2New.substring(0, 6), s2Id]);

        // Old token must return 404
        const res2OldAfter = await httpRequest(`http://127.0.0.1:8002/api/calendar/feed/${t2Old}.ics`);
        if (res2OldAfter.status !== 404) {
            throw new Error(`Expected 404 for rotated old token, got ${res2OldAfter.status}`);
        }

        // New token must return 200
        const res2New = await httpRequest(`http://127.0.0.1:8002/api/calendar/feed/${t2New}.ics`);
        if (res2New.status !== 200) {
            throw new Error(`Expected 200 for rotated new token, got ${res2New.status}`);
        }
        console.log('[PASS] Token rotation immediately invalidates old token and activates new token.');

        // -----------------------------------------------------------------
        // 3. Creator Membership Deactivation Test
        // -----------------------------------------------------------------
        // Pick an existing non-owner user from profiles
        const nonOwnerRes = await pool.query(`
            SELECT id FROM public.profiles WHERE global_role != 'owner' LIMIT 1;
        `);
        const tempUserId = nonOwnerRes.rows[0].id;

        const tempMemberRes = await pool.query(`
            INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active)
            VALUES ($1, $2, 'pm', true)
            RETURNING id;
        `, [org_id, tempUserId]);
        const membershipId = tempMemberRes.rows[0].id;

        const t3 = crypto.randomBytes(32).toString('hex');
        const h3 = crypto.createHash('sha256').update(t3).digest('hex');

        const s3 = await pool.query(`
            INSERT INTO public.calendar_feed_subscriptions (
                organization_id, created_by, project_id, name, feed_scope, token_hash, token_preview, is_active
            ) VALUES ($1, $2, $3, 'Membership Lifecycle Feed', 'project', $4, 'memb01', true)
            RETURNING id;
        `, [org_id, tempUserId, project_id, h3]);
        const s3Id = s3.rows[0].id;

        // While member is active -> 200
        const res3Active = await httpRequest(`http://127.0.0.1:8002/api/calendar/feed/${t3}.ics`);
        if (res3Active.status !== 200) {
            throw new Error(`Expected 200 for active member feed, got ${res3Active.status}: ${res3Active.body}`);
        }

        // Deactivate member in organization
        await pool.query(`
            UPDATE public.organization_memberships
            SET is_active = false
            WHERE id = $1;
        `, [membershipId]);

        // After member is deactivated -> 404
        const res3Deactivated = await httpRequest(`http://127.0.0.1:8002/api/calendar/feed/${t3}.ics`);
        if (res3Deactivated.status !== 404) {
            throw new Error(`Expected 404 when creator membership is deactivated, got ${res3Deactivated.status}`);
        }
        console.log('[PASS] Deactivating creator membership immediately invalidates the calendar feed (HTTP 404).');

        // Cleanup fixtures
        await pool.query('DELETE FROM public.calendar_feed_subscriptions WHERE id IN ($1, $2, $3)', [s1Id, s2Id, s3Id]);
        await pool.query('DELETE FROM public.organization_memberships WHERE id = $1', [membershipId]);
        console.log('Cleaned up test fixtures.');

        console.log('--- RESULT: Phase 7C Revocation & Rotation Lifecycle PASSED ---');
    } finally {
        await pool.end();
    }
}

runTest().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
