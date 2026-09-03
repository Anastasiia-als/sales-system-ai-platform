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

// Reconciled Canonical 8 Formats from Frozen Architecture Contract
const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx', 'zip', 'csv'];
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
            return { valid: false, error: `Формат файлу «${f.name}» не підтримується. Дозволено: ${ALLOWED_EXTENSIONS.join(', ')}.` };
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
        console.log("1. Testing File Count, Size & Reconciled 8-Extension Allowlist...");
        
        // Canonical 8 extensions tested individually
        for (const ext of ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx', 'zip', 'csv']) {
            const check = validateFiles([{ name: `document.${ext}`, size: 5000 }]);
            assert(check.valid === true, `Canonical extension .${ext} accepted`);
        }

        // Explicit check: .jpeg is accepted
        const jpegCheck = validateFiles([{ name: "photo_scan.jpeg", size: 20480 }]);
        assert(jpegCheck.valid === true, "Explicit check: .jpeg is accepted");

        // Explicit check: .txt is rejected as attachment (text responses are submitted via text input)
        const txtCheck = validateFiles([{ name: "notes.txt", size: 1024 }]);
        assert(txtCheck.valid === false && txtCheck.error.includes("не підтримується"), "Explicit check: .txt is rejected as attachment file");

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
            { name: "f6.csv", size: 1000 }
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

        // 3. Database Server-Side Validation Verification
        console.log("3. Testing DB Authoritative Server-Side Validation...");
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;

        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org Reconcile Test', 'active') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdOrgIds.push(orgId);

        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status, title) VALUES ($1, 'Project Validation', 'active', 'Project Title') RETURNING id",
            [orgId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const tRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, description, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Task For Validation', 'Desc', 'todo', 'client', true) RETURNING id",
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

        // Server-Side Rejection 1: Invalid extension (.exe) in attachments
        let serverExeBlocked = false;
        try {
            await pool.query("SELECT public.submit_public_client_action($1, $2)", [
                token.raw_token,
                JSON.stringify({
                    text: "Trying invalid file",
                    attachments: [{ name: "evil.exe", size: 1024, type: "application/x-msdownload" }]
                })
            ]);
        } catch(e) {
            serverExeBlocked = true;
            assert(e.message.includes("File format of evil.exe is not allowed"), "Server rejected non-allowlisted format evil.exe");
        }
        assert(serverExeBlocked, "Server-side authoritative validation blocked .exe file");

        // Server-Side Rejection 2: .txt file rejected on server
        let serverTxtBlocked = false;
        try {
            await pool.query("SELECT public.submit_public_client_action($1, $2)", [
                token.raw_token,
                JSON.stringify({
                    text: "Trying txt file",
                    attachments: [{ name: "notes.txt", size: 1024, type: "text/plain" }]
                })
            ]);
        } catch(e) {
            serverTxtBlocked = true;
            assert(e.message.includes("File format of notes.txt is not allowed"), "Server rejected non-allowlisted format notes.txt");
        }
        assert(serverTxtBlocked, "Server-side authoritative validation blocked .txt file");

        // Server-Side Rejection 3: More than 5 files on server
        let server6FilesBlocked = false;
        try {
            await pool.query("SELECT public.submit_public_client_action($1, $2)", [
                token.raw_token,
                JSON.stringify({
                    text: "Trying 6 files",
                    attachments: [
                        { name: "1.pdf", size: 100 }, { name: "2.pdf", size: 100 },
                        { name: "3.pdf", size: 100 }, { name: "4.pdf", size: 100 },
                        { name: "5.pdf", size: 100 }, { name: "6.pdf", size: 100 }
                    ]
                })
            ]);
        } catch(e) {
            server6FilesBlocked = true;
            assert(e.message.includes("maximum 5 files allowed"), "Server rejected >5 files");
        }
        assert(server6FilesBlocked, "Server-side authoritative validation blocked >5 files");

        // Server-Side Success: Valid canonical attachments (.pdf, .jpeg, .xlsx)
        const validSubmit = await pool.query("SELECT public.submit_public_client_action($1, $2) AS res", [
            token.raw_token,
            JSON.stringify({
                text: "Legitimate client submission",
                attachments: [
                    { name: "scan.jpeg", size: 50000, type: "image/jpeg" },
                    { name: "financials.xlsx", size: 100000, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
                    { name: "brief.pdf", size: 200000, type: "application/pdf" }
                ]
            })
        ]);
        assert(validSubmit.rows[0].res.success === true, "Server-side authoritative validation accepted canonical files (.jpeg, .xlsx, .pdf)");

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
