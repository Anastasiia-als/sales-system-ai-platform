// scratch/test_phase7b_rbac_matrix.js
// Tests Phase 7B: Strict RBAC & Tenant Isolation Matrix (Owner/Org Admin Only, Default Deny for Clients)

const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const createdIds = {
    organizations: [],
    users: [],
    destinations: [],
    vaultSecrets: []
};

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
        console.log('--- Phase 7B: RBAC & Tenant Isolation Matrix Suite ---');

        // 1. Setup two organizations
        const orgARes = await client.query("INSERT INTO public.organizations (name) VALUES ('Org A 7B RBAC') RETURNING id");
        const orgAId = orgARes.rows[0].id;
        createdIds.organizations.push(orgAId);

        const orgBRes = await client.query("INSERT INTO public.organizations (name) VALUES ('Org B 7B RBAC') RETURNING id");
        const orgBId = orgBRes.rows[0].id;
        createdIds.organizations.push(orgBId);

        // 2. Setup users:
        const suffix = Date.now() + '_' + Math.floor(Math.random() * 10000);
        const adminEmail = `admin_7b_${suffix}@example.com`;
        const clientEmail = `client_7b_${suffix}@example.com`;

        // User 1: Org A Admin
        const userAdminRes = await client.query(`
            INSERT INTO auth.users (id, email, raw_user_meta_data)
            VALUES (gen_random_uuid(), $1, '{"role":"authenticated"}')
            RETURNING id
        `, [adminEmail]);
        const adminUserId = userAdminRes.rows[0].id;
        createdIds.users.push(adminUserId);

        await client.query(`
            UPDATE public.profiles
            SET global_role = 'client'
            WHERE id = $1
        `, [adminUserId]);

        await client.query(`
            INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active)
            VALUES ($1, $2, 'admin', true)
        `, [orgAId, adminUserId]);

        // User 2: Org A Client (non-admin)
        const userClientRes = await client.query(`
            INSERT INTO auth.users (id, email, raw_user_meta_data)
            VALUES (gen_random_uuid(), $1, '{"role":"authenticated"}')
            RETURNING id
        `, [clientEmail]);
        const clientUserId = userClientRes.rows[0].id;
        createdIds.users.push(clientUserId);

        await client.query(`
            UPDATE public.profiles
            SET global_role = 'client'
            WHERE id = $1
        `, [clientUserId]);

        await client.query(`
            INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active)
            VALUES ($1, $2, 'client', true)
        `, [orgAId, clientUserId]);

        const botToken = '1122334455:ABC_RBAC_Test_Bot_Token_123';
        const chatId = '-1005544332211';

        // Check 1: Org Admin can create destination in Org A
        let adminCreatedDestId = null;
        try {
            await client.query('BEGIN');
            await client.query("SET LOCAL \"request.jwt.claim.role\" = 'authenticated'");
            await client.query(`SET LOCAL "request.jwt.claim.sub" = '${adminUserId}'`);
            const res = await client.query(`
                SELECT public.create_telegram_destination(
                    p_organization_id => $1,
                    p_name => 'Admin Channel',
                    p_bot_token => $2,
                    p_chat_id => $3
                ) as res
            `, [orgAId, botToken, chatId]);
            adminCreatedDestId = res.rows[0].res.id;
            createdIds.destinations.push(adminCreatedDestId);
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Admin create failed:', err);
        }
        assert(Boolean(adminCreatedDestId), 'Org Admin successfully creates Telegram destination in their organization');

        if (adminCreatedDestId) {
            const secRow = await client.query("SELECT bot_token_vault_id FROM public.telegram_destinations WHERE id = $1", [adminCreatedDestId]);
            if (secRow.rows.length) createdIds.vaultSecrets.push(secRow.rows[0].bot_token_vault_id);
        }

        // Check 2: Org Admin cannot create destination in Org B (Tenant isolation)
        let adminCrossOrgBlocked = false;
        try {
            await client.query('BEGIN');
            await client.query("SET LOCAL \"request.jwt.claim.role\" = 'authenticated'");
            await client.query(`SET LOCAL "request.jwt.claim.sub" = '${adminUserId}'`);
            await client.query(`
                SELECT public.create_telegram_destination(
                    p_organization_id => $1,
                    p_name => 'Cross Org Channel',
                    p_bot_token => $2,
                    p_chat_id => $3
                ) as res
            `, [orgBId, botToken, '-1009988112233']);
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            adminCrossOrgBlocked = err.code === '42501';
        }
        assert(adminCrossOrgBlocked, 'Org Admin is blocked with 42501 when attempting cross-tenant destination creation in Org B');

        // Check 3: Client role is blocked from creating Telegram destination (Default Deny)
        let clientCreateBlocked = false;
        try {
            await client.query('BEGIN');
            await client.query("SET LOCAL \"request.jwt.claim.role\" = 'authenticated'");
            await client.query(`SET LOCAL "request.jwt.claim.sub" = '${clientUserId}'`);
            await client.query(`
                SELECT public.create_telegram_destination(
                    p_organization_id => $1,
                    p_name => 'Client Disallowed Channel',
                    p_bot_token => $2,
                    p_chat_id => $3
                ) as res
            `, [orgAId, botToken, '-1007766554433']);
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            clientCreateBlocked = err.code === '42501';
        }
        assert(clientCreateBlocked, 'Client user is blocked with 42501 from creating Telegram destinations');

        // Check 4: Client role is blocked from viewing Telegram destinations
        let clientListBlocked = false;
        try {
            await client.query('BEGIN');
            await client.query("SET LOCAL \"request.jwt.claim.role\" = 'authenticated'");
            await client.query(`SET LOCAL "request.jwt.claim.sub" = '${clientUserId}'`);
            await client.query("SELECT public.get_telegram_destinations($1)", [orgAId]);
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            clientListBlocked = err.code === '42501';
        }
        assert(clientListBlocked, 'Client user is blocked with 42501 from viewing Telegram destinations');

        // Check 5: Client role is blocked from toggling active status
        let clientToggleBlocked = false;
        try {
            await client.query('BEGIN');
            await client.query("SET LOCAL \"request.jwt.claim.role\" = 'authenticated'");
            await client.query(`SET LOCAL "request.jwt.claim.sub" = '${clientUserId}'`);
            await client.query("SELECT public.toggle_telegram_destination_active($1, false)", [adminCreatedDestId]);
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            clientToggleBlocked = err.code === '42501';
        }
        assert(clientToggleBlocked, 'Client user is blocked with 42501 from toggling Telegram destination status');

        // Check 6: Client role is blocked from deleting destination
        let clientDeleteBlocked = false;
        try {
            await client.query('BEGIN');
            await client.query("SET LOCAL \"request.jwt.claim.role\" = 'authenticated'");
            await client.query(`SET LOCAL "request.jwt.claim.sub" = '${clientUserId}'`);
            await client.query("SELECT public.delete_telegram_destination($1)", [adminCreatedDestId]);
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            clientDeleteBlocked = err.code === '42501';
        }
        assert(clientDeleteBlocked, 'Client user is blocked with 42501 from deleting Telegram destination');

        console.log(`\nResults: ${passed} passed, ${failed} failed`);
        if (failed > 0) process.exit(1);
    } finally {
        for (const destId of createdIds.destinations) {
            await client.query("DELETE FROM public.telegram_destinations WHERE id = $1", [destId]);
        }
        for (const secId of createdIds.vaultSecrets) {
            await client.query("DELETE FROM vault.secrets WHERE id = $1", [secId]);
        }
        for (const uId of createdIds.users) {
            await client.query("DELETE FROM public.organization_memberships WHERE user_id = $1", [uId]);
            await client.query("DELETE FROM public.profiles WHERE id = $1", [uId]);
            await client.query("DELETE FROM auth.users WHERE id = $1", [uId]);
        }
        for (const orgId of createdIds.organizations) {
            await client.query("DELETE FROM public.organizations WHERE id = $1", [orgId]);
        }
        client.release();
    }
}

run().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
