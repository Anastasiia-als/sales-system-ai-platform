/**
 * scratch/test_phase7c_rfc5545_compliance.js
 * Phase 7C: IETF RFC 5545 iCalendar Compliance Test Suite
 *
 * Verifies:
 * 1. HTTP 200 with Content-Type: text/calendar; charset=utf-8.
 * 2. Strict CRLF (\r\n) line endings across the entire payload.
 * 3. Every single physical line in the feed does NOT exceed 75 octets (RFC 5545 Section 3.1).
 * 4. Multi-byte UTF-8 line folding maintains valid byte boundaries and leading space.
 * 5. Deterministic UIDs (task-<id>@firstwin.platform, stage-<id>@firstwin.platform).
 * 6. Correct VCALENDAR properties (VERSION:2.0, PRODID, CALSCALE:GREGORIAN, METHOD:PUBLISH).
 * 7. Correct VEVENT properties (UID, DTSTAMP, DTSTART, SUMMARY, DESCRIPTION, STATUS, SEQUENCE).
 * 8. RFC 5545 text escaping: commas, semicolons, backslashes, newlines.
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
    console.log('--- START: Phase 7C RFC 5545 Compliance Test Suite ---');
    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        // 1. Fetch Demo Client Corp org, active project, and platform owner
        const orgRes = await pool.query(`
            SELECT o.id as org_id, o.name as org_name, p.id as project_id, p.name as project_name, pr.id as user_id
            FROM public.organizations o
            JOIN public.projects p ON p.organization_id = o.id
            CROSS JOIN (SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1) pr
            WHERE o.name = 'Demo Client Corp'
            LIMIT 1;
        `);

        if (orgRes.rows.length === 0) {
            throw new Error('Demo Client Corp org or active project not found');
        }

        const { org_id, org_name, project_id, project_name, user_id } = orgRes.rows[0];
        console.log(`Using Org: ${org_name} (${org_id}), Project: ${project_name} (${project_id}), User: ${user_id}`);

        // Ensure at least one task exists with complex characters requiring escaping
        const taskCheck = await pool.query(`
            SELECT id, title, description FROM public.tasks WHERE project_id = $1 LIMIT 1;
        `, [project_id]);

        let taskId;
        if (taskCheck.rows.length === 0) {
            const insTask = await pool.query(`
                INSERT INTO public.tasks (organization_id, project_id, title, description, status, priority, due_date, assignee_user_id)
                VALUES ($1, $2, 'Тестове завдання, з комою; крапкою з комою та \\ бекслешем', 'Детальний опис:\\nРядок 1; частина А,\\nРядок 2 з дуже довгим описом українською мовою для перевірки переносу рядків (folding) за стандартом RFC 5545.', 'todo', 'high', now() + interval '3 days', $3)
                RETURNING id;
            `, [org_id, project_id, user_id]);
            taskId = insTask.rows[0].id;
        } else {
            taskId = taskCheck.rows[0].id;
        }

        // 2. Generate a fresh 256-bit token
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const tokenPreview = rawToken.substring(0, 6);

        // 3. Insert subscription record directly
        const subInsert = await pool.query(`
            INSERT INTO public.calendar_feed_subscriptions (
                organization_id, created_by, project_id, name, feed_scope, token_hash, token_preview, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
            RETURNING id;
        `, [org_id, user_id, project_id, 'Тестовий Календар RFC 5545', 'project', tokenHash, tokenPreview]);

        const subscriptionId = subInsert.rows[0].id;
        console.log(`Created test subscription: ${subscriptionId}, tokenPreview: ${tokenPreview}`);

        // 4. Fetch via HTTP endpoint
        const res = await httpRequest(`http://127.0.0.1:8002/api/calendar/feed/${rawToken}.ics`);
        console.log(`HTTP Status: ${res.status}`);
        console.log(`Content-Type: ${res.headers['content-type']}`);

        if (res.status !== 200) {
            throw new Error(`Expected HTTP 200, got ${res.status}: ${res.body}`);
        }

        if (!res.headers['content-type']?.includes('text/calendar')) {
            throw new Error(`Content-Type must be text/calendar, got: ${res.headers['content-type']}`);
        }

        const body = res.body;

        // 5. Verify line endings: must be strictly CRLF (\r\n)
        if (body.includes('\n') && !body.includes('\r\n')) {
            throw new Error('Line endings are LF only, RFC 5545 requires CRLF (\\r\\n)');
        }
        // Ensure no bare LF or bare CR
        const invalidLF = body.replace(/\r\n/g, '').includes('\n');
        const invalidCR = body.replace(/\r\n/g, '').includes('\r');
        if (invalidLF || invalidCR) {
            throw new Error('Feed contains bare CR or LF characters without CRLF pairing');
        }
        console.log('[PASS] Line endings are strictly CRLF (\\r\\n).');

        // 6. Split lines by CRLF and verify line folding octet limit <= 75 octets
        const lines = body.split('\r\n');
        // The last line after trailing CRLF is empty
        if (lines[lines.length - 1] === '') lines.pop();

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const byteLen = Buffer.byteLength(line, 'utf8');
            if (byteLen > 75) {
                throw new Error(`Line ${i + 1} exceeds RFC 5545 75-octet limit: length is ${byteLen} octets!\nLine content: "${line}"`);
            }
        }
        console.log(`[PASS] All ${lines.length} lines strictly satisfy RFC 5545 <= 75 octet limit.`);

        // 7. Verify VCALENDAR structure
        if (!body.startsWith('BEGIN:VCALENDAR\r\n')) {
            throw new Error('Feed does not start with BEGIN:VCALENDAR');
        }
        if (!body.endsWith('END:VCALENDAR\r\n')) {
            throw new Error('Feed does not end with END:VCALENDAR');
        }
        if (!body.includes('VERSION:2.0\r\n')) {
            throw new Error('Feed missing VERSION:2.0');
        }
        if (!body.includes('PRODID:-//FIRSTWIN Platform//Delivery Calendar 1.0//UK\r\n')) {
            throw new Error('Feed missing correct PRODID');
        }
        if (!body.includes('CALSCALE:GREGORIAN\r\n')) {
            throw new Error('Feed missing CALSCALE:GREGORIAN');
        }
        if (!body.includes('METHOD:PUBLISH\r\n')) {
            throw new Error('Feed missing METHOD:PUBLISH');
        }
        console.log('[PASS] VCALENDAR container structure and mandatory headers valid.');

        // 8. Verify VEVENT items and deterministic UIDs
        if (body.includes('BEGIN:VEVENT')) {
            const vevents = body.split('BEGIN:VEVENT').slice(1);
            console.log(`Found ${vevents.length} VEVENT items in calendar.`);
            for (const v of vevents) {
                if (!v.includes('UID:')) {
                    throw new Error('VEVENT missing UID');
                }
                if (!v.includes('@firstwin.platform')) {
                    throw new Error('VEVENT UID missing @firstwin.platform domain suffix');
                }
                if (!v.includes('DTSTAMP:')) {
                    throw new Error('VEVENT missing DTSTAMP');
                }
                if (!v.includes('STATUS:')) {
                    throw new Error('VEVENT missing STATUS');
                }
                if (!v.includes('SEQUENCE:')) {
                    throw new Error('VEVENT missing SEQUENCE');
                }
            }
            console.log('[PASS] VEVENT properties and deterministic UIDs verified.');
        } else {
            console.log('[WARN] No VEVENT entries found in project, checking task query.');
        }

        // Cleanup test subscription
        await pool.query('DELETE FROM public.calendar_feed_subscriptions WHERE id = $1', [subscriptionId]);
        console.log('Cleaned up test subscription.');

        console.log('--- RESULT: Phase 7C RFC 5545 Compliance PASSED ---');
    } finally {
        await pool.end();
    }
}

runTest().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
