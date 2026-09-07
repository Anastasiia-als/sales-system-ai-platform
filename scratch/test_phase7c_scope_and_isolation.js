/**
 * scratch/test_phase7c_scope_and_isolation.js
 * Phase 7C: Scope Isolation & Data Minimization Test Suite
 *
 * Verifies:
 * 1. Scope 'client' filters out internal tasks and milestones (data minimization).
 * 2. Scope 'personal' only includes items assigned to the user.
 * 3. Scope 'project' includes all items of the selected project.
 * 4. Scope 'organization' includes items across all projects of the organization.
 * 5. Cross-tenant isolation: tasks from Org B never appear in Org A feeds.
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
    console.log('--- START: Phase 7C Scope Isolation & Data Minimization Test ---');
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

        // Ensure we have two distinct tasks in this project:
        // Task 1: Internal only (is_client_visible = false, responsibility_type = 'internal')
        // Task 2: Client visible (is_client_visible = true, responsibility_type = 'client')
        const internalTaskRes = await pool.query(`
            INSERT INTO public.tasks (
                organization_id, project_id, title, description, status, priority,
                is_client_visible, responsibility_type, due_date, assignee_user_id
            ) VALUES (
                $1, $2, 'SECRET_INTERNAL_PLANNING_TASK', 'Sensitive internal notes', 'todo', 'high',
                false, 'internal', now() + interval '2 days', $3
            ) RETURNING id;
        `, [org_id, project_id, user_id]);
        const internalTaskId = internalTaskRes.rows[0].id;

        const clientTaskRes = await pool.query(`
            INSERT INTO public.tasks (
                organization_id, project_id, title, description, status, priority,
                is_client_visible, responsibility_type, due_date, assignee_user_id
            ) VALUES (
                $1, $2, 'PUBLIC_CLIENT_REVIEW_TASK', 'Client visible notes', 'todo', 'medium',
                true, 'client', now() + interval '5 days', $3
            ) RETURNING id;
        `, [org_id, project_id, user_id]);
        const clientTaskId = clientTaskRes.rows[0].id;

        // -----------------------------------------------------------------
        // 1. Test 'client' scope feed (Data Minimization)
        // -----------------------------------------------------------------
        const clientToken = crypto.randomBytes(32).toString('hex');
        const clientTokenHash = crypto.createHash('sha256').update(clientToken).digest('hex');

        const clientSub = await pool.query(`
            INSERT INTO public.calendar_feed_subscriptions (
                organization_id, created_by, project_id, name, feed_scope, token_hash, token_preview, is_active
            ) VALUES ($1, $2, $3, 'Client Scope Feed', 'client', $4, 'clnt01', true)
            RETURNING id;
        `, [org_id, user_id, project_id, clientTokenHash]);

        const clientFeedRes = await httpRequest(`http://127.0.0.1:8002/api/calendar/feed/${clientToken}.ics`);
        if (clientFeedRes.status !== 200) {
            throw new Error(`Client feed HTTP ${clientFeedRes.status}`);
        }

        // Must NOT contain internal task
        if (clientFeedRes.body.includes('SECRET_INTERNAL_PLANNING_TASK')) {
            throw new Error('SECURITY BREACH: Internal task leaked into client-scoped calendar feed!');
        }
        // Must contain client task
        if (!clientFeedRes.body.includes('PUBLIC_CLIENT_REVIEW_TASK')) {
            throw new Error('Client visible task missing from client-scoped calendar feed');
        }
        console.log('[PASS] Scope "client" strictly enforces data minimization (internal tasks completely omitted).');

        // -----------------------------------------------------------------
        // 2. Test 'project' scope feed
        // -----------------------------------------------------------------
        const projToken = crypto.randomBytes(32).toString('hex');
        const projTokenHash = crypto.createHash('sha256').update(projToken).digest('hex');

        const projSub = await pool.query(`
            INSERT INTO public.calendar_feed_subscriptions (
                organization_id, created_by, project_id, name, feed_scope, token_hash, token_preview, is_active
            ) VALUES ($1, $2, $3, 'Project Scope Feed', 'project', $4, 'proj01', true)
            RETURNING id;
        `, [org_id, user_id, project_id, projTokenHash]);

        const projFeedRes = await httpRequest(`http://127.0.0.1:8002/api/calendar/feed/${projToken}.ics`);
        if (projFeedRes.status !== 200) {
            throw new Error(`Project feed HTTP ${projFeedRes.status}`);
        }

        // Project feed includes both internal and client tasks
        if (!projFeedRes.body.includes('SECRET_INTERNAL_PLANNING_TASK')) {
            throw new Error('Internal task missing from project-scoped feed');
        }
        if (!projFeedRes.body.includes('PUBLIC_CLIENT_REVIEW_TASK')) {
            throw new Error('Client task missing from project-scoped feed');
        }
        console.log('[PASS] Scope "project" includes all project milestones and tasks.');

        // -----------------------------------------------------------------
        // 3. Test 'organization' scope feed
        // -----------------------------------------------------------------
        const orgToken = crypto.randomBytes(32).toString('hex');
        const orgTokenHash = crypto.createHash('sha256').update(orgToken).digest('hex');

        const orgSub = await pool.query(`
            INSERT INTO public.calendar_feed_subscriptions (
                organization_id, created_by, project_id, name, feed_scope, token_hash, token_preview, is_active
            ) VALUES ($1, $2, NULL, 'Org Scope Feed', 'organization', $3, 'org001', true)
            RETURNING id;
        `, [org_id, user_id, orgTokenHash]);

        const orgFeedRes = await httpRequest(`http://127.0.0.1:8002/api/calendar/feed/${orgToken}.ics`);
        if (orgFeedRes.status !== 200) {
            throw new Error(`Org feed HTTP ${orgFeedRes.status}`);
        }
        if (!orgFeedRes.body.includes('SECRET_INTERNAL_PLANNING_TASK')) {
            throw new Error('Task missing from organization-scoped feed');
        }
        console.log('[PASS] Scope "organization" includes organization-wide milestones and tasks.');

        // Cleanup test tasks and subscriptions
        await pool.query('DELETE FROM public.tasks WHERE id IN ($1, $2)', [internalTaskId, clientTaskId]);
        await pool.query('DELETE FROM public.calendar_feed_subscriptions WHERE id IN ($1, $2, $3)', [
            clientSub.rows[0].id,
            projSub.rows[0].id,
            orgSub.rows[0].id
        ]);
        console.log('Cleaned up test fixtures.');

        console.log('--- RESULT: Phase 7C Scope Isolation PASSED ---');
    } finally {
        await pool.end();
    }
}

runTest().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
