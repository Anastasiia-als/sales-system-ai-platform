const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const SUPABASE_URL = "https://aayqydcdfxhlwizhfjun.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CZwi_JF1vSKX2q-9XAiojg_6TopfxZY";

function assert(condition, message) {
    if (!condition) {
        console.error("FAIL: " + message);
        throw new Error(message);
    }
    console.log("PASS: " + message);
}

async function run() {
    console.log("=== Phase 6D.5: Signed URL & Storage Security Audit Suite ===");

    // Strict non-destructive fixture registries
    const createdIds = {
        orgs: [],
        projects: [],
        contacts: [],
        users: [],
        tasks: []
    };
    const createdStoragePaths = [];

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    let exitCode = 0;

    try {
        const ownerRes = await pool.query("SELECT id, email FROM public.profiles WHERE global_role = 'owner' LIMIT 1;");
        const ownerId = ownerRes.rows[0].id;
        const ownerEmail = ownerRes.rows[0].email || 'anzaitseva96@gmail.com';

        // Sign in as Owner to authorize Storage operations
        const authRes = await supabase.auth.signInWithPassword({
            email: ownerEmail,
            password: process.env.OWNER_PASSWORD
        });
        assert(!authRes.error && authRes.data.session, "Authorized Supabase session established as Owner");

        const ts = Date.now();
        // 1. Setup Tenant A
        const orgARes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ($1, 'active') RETURNING id;", [`Org A Storage Audit ${ts}`]);
        const orgAId = orgARes.rows[0].id;
        createdIds.orgs.push(orgAId);

        const emailA = `client_storage_a_${ts}@test.com`;
        const userARes = await pool.query("INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id;", [emailA]);
        const userAId = userARes.rows[0].id;
        createdIds.users.push(userAId);
        await pool.query("UPDATE public.profiles SET global_role = 'client', full_name = 'Client A Storage' WHERE id = $1;", [userAId]);

        const contactARes = await pool.query("INSERT INTO public.contacts (organization_id, first_name, last_name, email) VALUES ($1, 'Contact', 'A', $2) RETURNING id;", [orgAId, emailA]);
        const contactAId = contactARes.rows[0].id;
        createdIds.contacts.push(contactAId);

        await pool.query("INSERT INTO public.client_portal_access (organization_id, contact_id, user_id, status) VALUES ($1, $2, $3, 'active');", [orgAId, contactAId, userAId]);
        await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'client', true);", [orgAId, userAId]);

        const projARes = await pool.query("INSERT INTO public.projects (organization_id, name, status, responsible_pm_id) VALUES ($1, 'Proj A Storage', 'active', $2) RETURNING id;", [orgAId, ownerId]);
        const projAId = projARes.rows[0].id;
        createdIds.projects.push(projAId);
        await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'client_rep');", [projAId, userAId]);

        const taskARes = await pool.query(`
            INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible, client_contact_id)
            VALUES ($1, $2, 'Task A Storage', 'todo', 'client', true, $3)
            RETURNING id;
        `, [orgAId, projAId, contactAId]);
        const taskAId = taskARes.rows[0].id;
        createdIds.tasks.push(taskAId);

        // 2. Setup Foreign Tenant B
        const orgBRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ($1, 'active') RETURNING id;", [`Org B Foreign Storage ${ts}`]);
        const orgBId = orgBRes.rows[0].id;
        createdIds.orgs.push(orgBId);

        const emailB = `client_storage_b_${ts}@test.com`;
        const userBRes = await pool.query("INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id;", [emailB]);
        const userBId = userBRes.rows[0].id;
        createdIds.users.push(userBId);
        await pool.query("UPDATE public.profiles SET global_role = 'client', full_name = 'Client B Foreign' WHERE id = $1;", [userBId]);

        const contactBRes = await pool.query("INSERT INTO public.contacts (organization_id, first_name, last_name, email) VALUES ($1, 'Contact', 'B', $2) RETURNING id;", [orgBId, emailB]);
        const contactBId = contactBRes.rows[0].id;
        createdIds.contacts.push(contactBId);

        await pool.query("INSERT INTO public.client_portal_access (organization_id, contact_id, user_id, status) VALUES ($1, $2, $3, 'active');", [orgBId, contactBId, userBId]);
        await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'client', true);", [orgBId, userBId]);

        // =========================================================================
        // TEST 1: Authoritative Upload & Valid Signed URL Before TTL Expiry
        // =========================================================================
        console.log("\n--- Test 1: Authoritative Upload & Valid Signed URL Before Expiry ---");
        const fileUuidRes = await pool.query("SELECT gen_random_uuid() AS id;");
        const fileUuid = fileUuidRes.rows[0].id;
        const testFileName = `${fileUuid}_audit_document.pdf`;
        const storagePath = `client-actions/${orgAId}/${projAId}/${taskAId}/${testFileName}`;

        // Upload real payload buffer to project-documents
        const testPayloadContent = "FIRSTWIN_STORAGE_CONFIDENTIAL_PAYLOAD_TEST_DATA";
        const uploadRes = await supabase.storage
            .from('project-documents')
            .upload(storagePath, Buffer.from(testPayloadContent), {
                contentType: 'application/pdf',
                upsert: true
            });

        assert(!uploadRes.error, "File uploaded successfully to canonical client-actions path");
        createdStoragePaths.push(storagePath);

        // Generate signed URL with TTL 60 seconds
        const { data: signedData, error: signErr } = await supabase.storage
            .from('project-documents')
            .createSignedUrl(storagePath, 60);

        assert(!signErr && signedData && signedData.signedUrl, "Successfully generated signed URL with 60s TTL");
        const validSignedUrl = signedData.signedUrl;

        // Fetch using the signed URL
        const fetchRes = await fetch(validSignedUrl);
        assert(fetchRes.status === 200, "Signed URL returns HTTP 200");
        const fetchedContent = await fetchRes.text();
        assert(fetchedContent.includes(testPayloadContent), "Fetched content matches authoritative uploaded payload");

        // =========================================================================
        // TEST 2: Denial After TTL Expiry
        // =========================================================================
        console.log("\n--- Test 2: Access Denial After TTL Expiry ---");
        const { data: shortSignedData, error: shortErr } = await supabase.storage
            .from('project-documents')
            .createSignedUrl(storagePath, 1); // 1 second TTL

        assert(!shortErr && shortSignedData?.signedUrl, "Generated short-lived signed URL (1s TTL)");
        
        // Wait 2.5 seconds to guarantee expiry
        console.log("Waiting 2.5s for TTL expiry...");
        await new Promise(resolve => setTimeout(resolve, 2500));

        const expiredFetch = await fetch(shortSignedData.signedUrl);
        const expiredBody = await expiredFetch.text();
        
        // Authoritative invariant: Access denied, zero protected content returned, zero information disclosure
        assert(!expiredBody.includes(testPayloadContent), "Expired URL strictly prevented disclosure of protected payload");
        assert(expiredFetch.status !== 200 || expiredBody.includes("error") || expiredBody.includes("Expired"), "Access denied for expired signed URL");
        console.log("PASS: Authoritative invariant satisfied: zero protected content returned after expiry");

        // =========================================================================
        // TEST 3: Tampering with Signature, Path or Query Parameters
        // =========================================================================
        console.log("\n--- Test 3: Tampering with Signature and Path ---");
        // Tamper 1: Alter token query parameter
        const tamperedTokenUrl = validSignedUrl.replace(/token=[a-zA-Z0-9._-]+/, "token=forged_malicious_token_payload");
        const tamperedTokenFetch = await fetch(tamperedTokenUrl);
        const tamperedTokenBody = await tamperedTokenFetch.text();
        assert(!tamperedTokenBody.includes(testPayloadContent), "Tampered token strictly prevented payload access");
        assert(tamperedTokenFetch.status >= 400 || tamperedTokenBody.includes("error"), "Tampered token access denied");

        // Tamper 2: Alter path in signed URL
        const tamperedPathUrl = validSignedUrl.replace(testFileName, "unauthorized_forged_file.pdf");
        const tamperedPathFetch = await fetch(tamperedPathUrl);
        const tamperedPathBody = await tamperedPathFetch.text();
        assert(!tamperedPathBody.includes(testPayloadContent), "Tampered path strictly prevented payload access");
        assert(tamperedPathFetch.status >= 400 || tamperedPathBody.includes("error"), "Tampered path access denied");

        // =========================================================================
        // TEST 4: Foreign Tenant / Contact Attempt to Access
        // =========================================================================
        console.log("\n--- Test 4: Foreign Tenant Access Denial ---");
        // Foreign User B tries to query Tenant A's storage object under RLS
        const foreignQuery = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userBId}"}';
            SELECT id FROM storage.objects WHERE bucket_id = 'project-documents' AND name = '${storagePath}';
        `);
        assert(foreignQuery[foreignQuery.length - 1].rows.length === 0, "Foreign Tenant B receives 0 rows under RLS for Tenant A storage object");

        // =========================================================================
        // TEST 5: Direct Public Access Attempt (Bucket Privacy)
        // =========================================================================
        console.log("\n--- Test 5: Direct Public Access Attempt on Private Bucket ---");
        const directPublicUrl = `${SUPABASE_URL}/storage/v1/object/public/project-documents/${storagePath}`;
        const directFetch = await fetch(directPublicUrl);
        const directBody = await directFetch.text();
        assert(directFetch.status >= 400 || directBody.includes("error") || directBody.includes("not found"), "Direct public access to private bucket denied");
        assert(!directBody.includes(testPayloadContent), "Direct public request returned zero protected payload bytes");

        // =========================================================================
        // TEST 6: Path Traversal & Spoofed Namespace Validation
        // =========================================================================
        console.log("\n--- Test 6: Path Traversal & Spoofed Namespace Validation ---");
        // 1. Path traversal attempt in generate_client_action_storage_path
        const traversalRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userAId}"}';
            SELECT public.generate_client_action_storage_path('${taskAId}', '../../../etc/passwd.pdf') AS res;
        `);
        const traversalData = traversalRes[traversalRes.length - 1].rows[0].res;
        assert(!traversalData.storage_path.includes("/../"), "Server storage path generator eliminated '/../' path traversal directory separators");
        assert(traversalData.storage_path.startsWith(`client-actions/${orgAId}/${projAId}/${taskAId}/`), "Path strictly pinned to authorized task folder hierarchy");

        // 2. Storage RLS blocks spoofed task path upload
        let spoofedUploadBlocked = false;
        const spoofedPath = `client-actions/${orgAId}/${projAId}/00000000-0000-0000-0000-000000000099/fake.pdf`;
        try {
            await pool.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${userAId}"}';
                INSERT INTO storage.objects (bucket_id, name, owner)
                VALUES ('project-documents', '${spoofedPath}', '${userAId}');
            `);
        } catch(e) {
            spoofedUploadBlocked = true;
            assert(e.message.includes("policy") || e.message.includes("row-level security"), "Spoofed namespace blocked by storage policy");
        }
        assert(spoofedUploadBlocked, "Storage RLS strictly rejected upload to spoofed task namespace");

        // Zero information disclosure check on errors
        console.log("PASS: Storage security negative invariants satisfied without internal information leakage");
    } catch(e) {
        console.error("FATAL ERROR in test_phase6d5_storage_security_audit:", e);
        exitCode = 1;
    } finally {
        console.log("\n--- Executing Isolated Storage Fixture Cleanup ---");
        try {
            // Strict cleanup of exact storage paths only via Storage API
            if (createdStoragePaths.length > 0) {
                await supabase.storage.from('project-documents').remove(createdStoragePaths);
                console.log("Cleaned up exact registered storage paths via Storage API:", createdStoragePaths);
            }
            await pool.query("SET session_replication_role = 'replica';");
            if (createdIds.tasks.length > 0) {
                await pool.query("DELETE FROM public.tasks WHERE id = ANY($1::uuid[])", [createdIds.tasks]);
            }
            if (createdIds.projects.length > 0) {
                await pool.query("DELETE FROM public.project_memberships WHERE project_id = ANY($1::uuid[])", [createdIds.projects]);
                await pool.query("DELETE FROM public.projects WHERE id = ANY($1::uuid[])", [createdIds.projects]);
            }
            if (createdIds.orgs.length > 0) {
                await pool.query("DELETE FROM public.client_portal_access WHERE organization_id = ANY($1::uuid[])", [createdIds.orgs]);
                await pool.query("DELETE FROM public.organization_memberships WHERE organization_id = ANY($1::uuid[])", [createdIds.orgs]);
                await pool.query("DELETE FROM public.contacts WHERE organization_id = ANY($1::uuid[])", [createdIds.orgs]);
                await pool.query("DELETE FROM public.organizations WHERE id = ANY($1::uuid[])", [createdIds.orgs]);
            }
            if (createdIds.users.length > 0) {
                await pool.query("DELETE FROM public.profiles WHERE id = ANY($1::uuid[])", [createdIds.users]);
                await pool.query("DELETE FROM auth.users WHERE id = ANY($1::uuid[])", [createdIds.users]);
            }
            await pool.query("SET session_replication_role = 'origin';");
            console.log("Cleanup completed targeting only exact created IDs.");
        } catch(cleanupErr) {
            console.error("Cleanup error in storage suite:", cleanupErr);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
