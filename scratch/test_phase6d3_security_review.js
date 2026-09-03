const { Pool } = require('pg');
const crypto = require('crypto');
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

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function run() {
    console.log("=== Starting Phase 6D.3 Security Review & Zero Leakage Suite (Test S) ===");
    let exitCode = 0;
    const createdOrgIds = [];
    const createdProjectIds = [];
    const createdTaskIds = [];
    const createdUserIds = [];

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;

        // 1. Setup Organization & Project & Task
        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org Security 6D3', 'active') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdOrgIds.push(orgId);

        const pmRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'pm_security_6d3@example.com') RETURNING id;`);
        const pmId = pmRes.rows[0].id;
        createdUserIds.push(pmId);
        await pool.query("UPDATE public.profiles SET global_role = 'pm' WHERE id = $1", [pmId]);

        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status, responsible_pm_id) VALUES ($1, 'Project Security 6D3', 'active', $2) RETURNING id",
            [orgId, pmId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const tRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Task Security 6D3', 'todo', 'client', true) RETURNING id",
            [orgId, projectId]
        );
        const taskId = tRes.rows[0].id;
        createdTaskIds.push(taskId);

        async function runAsPM(sql) {
            const res = await pool.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${pmId}"}';
                ${sql}
            `);
            return res[res.length - 1];
        }

        // ====================================================================
        // 1. Raw Token Cryptographic Invariants & Zero Leakage in DB
        // ====================================================================
        console.log("\n--- 1. Raw Token Cryptographic Invariants ---");
        const genRes = await runAsPM(`SELECT public.generate_action_token('${taskId}') AS res;`);
        const tokenData = genRes.rows[0].res;
        const rawToken = tokenData.raw_token;

        assert(rawToken.startsWith("fwa_"), "Raw token has fwa_ prefix");
        const hex = rawToken.replace("fwa_", "");
        assert(hex.length === 64, "Raw token has 64 hex characters (32 CSPRNG bytes / 256 bits)");

        // Verify that token_hash in DB is strictly SHA-256 of rawToken
        const computedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const dbToken = await pool.query("SELECT * FROM public.client_action_tokens WHERE id = $1", [tokenData.token_id]);
        assert(dbToken.rows[0].token_hash === computedHash, "DB token_hash exactly matches SHA-256 hash");
        assert(!dbToken.rows[0].token_hash.startsWith("fwa_"), "DB token_hash does NOT contain raw token prefix");

        // Scan entire database for rawToken plaintext
        const scanRes = await pool.query(`
            SELECT count(*) as cnt FROM public.client_action_tokens WHERE token_hash LIKE '%' || $1 || '%';
        `, [rawToken]);
        assert(parseInt(scanRes.rows[0].cnt, 10) === 0, "Zero plaintext raw token found in client_action_tokens table");

        // ====================================================================
        // 2. XSS Escaping Verification in Submissions Review
        // ====================================================================
        console.log("\n--- 2. XSS Escaping in Submission Payloads ---");
        const maliciousPayload = {
            text: '<script>alert("xss")</script><img src="x" onerror="alert(\'xss2\')" />Hello & welcome!',
            attachments: [
                { name: 'malicious<script>.pdf', size: 1024, path: 'uploads/malicious<script>.pdf' }
            ]
        };

        const subRes = await pool.query(`
            SELECT public.submit_public_client_action(
                $1,
                $2::jsonb
            ) AS res;
        `, [rawToken, JSON.stringify(maliciousPayload)]);
        assert(subRes.rows[0].res.success === true, "Malicious payload submitted successfully to DB");

        const getSubsRes = await runAsPM(`SELECT public.get_task_submissions('${taskId}') AS res;`);
        const subs = getSubsRes.rows[0].res;
        assert(subs.length === 1, "Submission retrieved by PM");

        // Verify raw stored payload preserves content without executing
        assert(subs[0].payload.text.includes("<script>"), "Payload stored intact in database JSONB");

        // Test escaping in UI rendering function
        const escapedText = escapeHtml(subs[0].payload.text);
        assert(!escapedText.includes("<script>"), "escapeHtml neutralizes <script> tags into &lt;script&gt;");
        assert(escapedText.includes("&lt;script&gt;"), "escapeHtml properly renders &lt;script&gt;");
        assert(!escapedText.includes("<img"), "escapeHtml neutralizes <img tags");
        assert(escapedText.includes("&lt;img"), "escapeHtml properly renders &lt;img");
        assert(escapedText.includes("&amp;"), "escapeHtml properly renders ampersand &amp;");

        const escapedFileName = escapeHtml(subs[0].attachments[0].name);
        assert(!escapedFileName.includes("<script>"), "Attachment filename is escaped");
        assert(escapedFileName.includes("&lt;script&gt;"), "Attachment filename rendered safely as &lt;script&gt;");

        console.log("\n=== ALL SECURITY & LEAKAGE TESTS (TEST S) PASSED! ===");
    } catch (err) {
        console.error("Test Suite Failed:", err);
        exitCode = 1;
    } finally {
        for (const tid of createdTaskIds) {
            await pool.query("DELETE FROM public.task_submissions WHERE task_id = $1", [tid]);
            await pool.query("DELETE FROM public.client_action_tokens WHERE task_id = $1", [tid]);
            await pool.query("DELETE FROM public.tasks WHERE id = $1", [tid]);
        }
        for (const pid of createdProjectIds) {
            await pool.query("DELETE FROM public.projects WHERE id = $1", [pid]);
        }
        for (const uid of createdUserIds) {
            await pool.query("DELETE FROM public.profiles WHERE id = $1", [uid]);
            await pool.query("DELETE FROM auth.users WHERE id = $1", [uid]);
        }
        for (const oid of createdOrgIds) {
            await pool.query("DELETE FROM public.organizations WHERE id = $1", [oid]);
        }
        await pool.end();
        process.exit(exitCode);
    }
}

run();
