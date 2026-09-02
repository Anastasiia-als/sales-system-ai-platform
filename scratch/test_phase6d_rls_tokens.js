const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

function assert(condition, message) {
    if (!condition) {
        console.error("FAIL: " + message);
        throw new Error(message);
    }
    console.log("PASS: " + message);
}

async function run() {
    console.log("=== Starting Phase 6D.1.1 Token Table Direct Access & RLS Denial Suite ===");
    let exitCode = 0;
    const createdOrgIds = [];
    const createdProjectIds = [];
    const createdTaskIds = [];
    const createdUserIds = [];

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;

        // 1. Setup Organization & Project & Client Task
        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org Tokens RLS', 'active') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdOrgIds.push(orgId);

        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status) VALUES ($1, 'Tokens RLS Project', 'active') RETURNING id",
            [orgId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const tRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Client Task RLS', 'todo', 'client', true) RETURNING id",
            [orgId, projectId]
        );
        const taskId = tRes.rows[0].id;
        createdTaskIds.push(taskId);

        // 2. Create Specialist User & Client User
        const specUserRes = await pool.query(`
            INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'specialist_tokens_rls@example.com') RETURNING id;
        `);
        const specialistUserId = specUserRes.rows[0].id;
        createdUserIds.push(specialistUserId);
        await pool.query("UPDATE public.profiles SET global_role = 'specialist' WHERE id = $1", [specialistUserId]);
        await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'specialist')", [projectId, specialistUserId]);

        const clientUserRes = await pool.query(`
            INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'client_tokens_rls@example.com') RETURNING id;
        `);
        const clientUserId = clientUserRes.rows[0].id;
        createdUserIds.push(clientUserId);
        await pool.query("UPDATE public.profiles SET global_role = 'client' WHERE id = $1", [clientUserId]);
        
        const contactRes = await pool.query(`
            INSERT INTO public.contacts (organization_id, first_name, last_name, email) VALUES ($1, 'Alice', 'Client', 'client_tokens_rls@example.com') RETURNING id;
        `, [orgId]);
        const contactId = contactRes.rows[0].id;
        
        await pool.query(`
            INSERT INTO public.client_portal_access (organization_id, contact_id, user_id, status)
            VALUES ($1, $2, $3, 'active');
        `, [orgId, contactId, clientUserId]);

        // 3. Generate Valid Token as Owner
        const genRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${taskId}') AS res;
        `);
        const tokenRow = genRes[genRes.length - 1].rows[0].res;

        // ==========================================
        // 4. Authenticated Client Direct Table Access: MUST BE DENIED
        // ==========================================
        console.log("1. Testing Authenticated Client direct table access on client_action_tokens...");
        
        // Client SELECT
        const clientSelect = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${clientUserId}"}';
            SELECT * FROM public.client_action_tokens WHERE id = '${tokenRow.token_id}';
        `);
        assert(clientSelect[clientSelect.length - 1].rows.length === 0, "Authenticated Client direct SELECT on client_action_tokens returned 0 rows (DENIED)");

        // Client INSERT
        let clientInsertBlocked = false;
        try {
            await pool.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${clientUserId}"}';
                INSERT INTO public.client_action_tokens (organization_id, task_id, token_hash, status, expires_at)
                VALUES ('${orgId}', '${taskId}', '0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff', 'active', NOW() + interval '1 day');
            `);
        } catch(e) {
            console.log("ACTUAL CLIENT INSERT ERROR:", e.message);
            clientInsertBlocked = true;
            assert(
                e.message.toLowerCase().includes('violates row-level security') || 
                e.message.toLowerCase().includes('permission denied') ||
                e.message.toLowerCase().includes('policy'),
                "Client direct INSERT violates RLS policy"
            );
        }
        assert(clientInsertBlocked, "Authenticated Client direct INSERT was blocked");

        // Client UPDATE
        const clientUpdate = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${clientUserId}"}';
            UPDATE public.client_action_tokens SET status = 'revoked' WHERE id = '${tokenRow.token_id}';
        `);
        assert(clientUpdate[clientUpdate.length - 1].rowCount === 0, "Authenticated Client direct UPDATE affected 0 rows (DENIED)");

        // Client DELETE
        const clientDelete = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${clientUserId}"}';
            DELETE FROM public.client_action_tokens WHERE id = '${tokenRow.token_id}';
        `);
        assert(clientDelete[clientDelete.length - 1].rowCount === 0, "Authenticated Client direct DELETE affected 0 rows (DENIED)");

        // ==========================================
        // 5. Anonymous Direct Table Access: MUST BE DENIED
        // ==========================================
        console.log("2. Testing Anonymous direct table access on client_action_tokens...");
        const anonSelect = await pool.query(`
            SET LOCAL role TO anon;
            SET LOCAL request.jwt.claims TO '{}';
            SELECT * FROM public.client_action_tokens;
        `);
        assert(anonSelect[anonSelect.length - 1].rows.length === 0, "Anonymous direct SELECT returned 0 rows (DENIED)");

        // ==========================================
        // 6. Specialist Token Management & Direct Access: MUST BE DENIED
        // ==========================================
        console.log("3. Testing Specialist token management and direct table access...");
        
        // Specialist Direct SELECT
        const specSelect = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${specialistUserId}"}';
            SELECT * FROM public.client_action_tokens WHERE id = '${tokenRow.token_id}';
        `);
        assert(specSelect[specSelect.length - 1].rows.length === 0, "Specialist direct SELECT returned 0 rows (DENIED)");

        // Specialist RPC calls
        let specGenBlocked = false;
        try {
            await pool.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${specialistUserId}"}';
                SELECT public.generate_action_token('${taskId}');
            `);
        } catch(e) {
            specGenBlocked = true;
            assert(e.message.includes('Access denied'), "Specialist generate_action_token thrown Access denied");
        }
        assert(specGenBlocked, "Specialist token generation blocked");

        let specRevokeBlocked = false;
        try {
            await pool.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${specialistUserId}"}';
                SELECT public.revoke_action_token('${taskId}', '${tokenRow.token_id}');
            `);
        } catch(e) {
            specRevokeBlocked = true;
            assert(e.message.includes('Access denied'), "Specialist revoke_action_token thrown Access denied");
        }
        assert(specRevokeBlocked, "Specialist token revocation blocked");

        let specRegenBlocked = false;
        try {
            await pool.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${specialistUserId}"}';
                SELECT public.regenerate_action_token('${taskId}');
            `);
        } catch(e) {
            specRegenBlocked = true;
            assert(e.message.includes('Access denied'), "Specialist regenerate_action_token thrown Access denied");
        }
        assert(specRegenBlocked, "Specialist token regeneration blocked");

        console.log("PASS: Phase 6D.1.1 Token Table Direct Access & RLS Denial Suite passed 100%!");
    } catch(e) {
        console.error("FATAL ERROR in Token RLS Suite:", e);
        exitCode = 1;
    } finally {
        try {
            await pool.query("SET session_replication_role = 'replica';");
            if (createdTaskIds.length > 0) {
                await pool.query("DELETE FROM public.task_submissions WHERE task_id = ANY($1::uuid[])", [createdTaskIds]);
                await pool.query("DELETE FROM public.client_action_tokens WHERE task_id = ANY($1::uuid[])", [createdTaskIds]);
                await pool.query("DELETE FROM public.tasks WHERE id = ANY($1::uuid[])", [createdTaskIds]);
            }
            if (createdProjectIds.length > 0) {
                await pool.query("DELETE FROM public.project_memberships WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.projects WHERE id = ANY($1::uuid[])", [createdProjectIds]);
            }
            if (createdOrgIds.length > 0) {
                await pool.query("DELETE FROM public.client_portal_access WHERE organization_id = ANY($1::uuid[])", [createdOrgIds]);
                await pool.query("DELETE FROM public.contacts WHERE organization_id = ANY($1::uuid[])", [createdOrgIds]);
                await pool.query("DELETE FROM public.organizations WHERE id = ANY($1::uuid[])", [createdOrgIds]);
            }
            if (createdUserIds.length > 0) {
                await pool.query("DELETE FROM public.profiles WHERE id = ANY($1::uuid[])", [createdUserIds]);
                await pool.query("DELETE FROM auth.users WHERE id = ANY($1::uuid[])", [createdUserIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error in token RLS suite:", e);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
