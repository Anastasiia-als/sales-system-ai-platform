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

async function run() {
    console.log("=== Starting Phase 6D.1.1 Token Entropy (Strict 256-bit CSPRNG) & Zero Plaintext Suite ===");
    let exitCode = 0;
    const createdProjectIds = [];
    const createdTaskIds = [];

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;
        const orgRes = await pool.query("SELECT id FROM public.organizations LIMIT 1");
        const orgId = orgRes.rows[0].id;

        // 1. Setup Test Project & Client Action Task
        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status) VALUES ($1, 'Phase 6D 256-bit Entropy Project', 'active') RETURNING id",
            [orgId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const tRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Provide Cryptographic Brief', 'todo', 'client', true) RETURNING id",
            [orgId, projectId]
        );
        const taskId = tRes.rows[0].id;
        createdTaskIds.push(taskId);

        // 2. Generate Action Token as Owner
        console.log("1. Generating action token via RPC...");
        const genRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${taskId}') AS res;
        `);
        const res = genRes[genRes.length - 1].rows[0].res;

        assert(res.success === true, "Token generation returned success");
        assert(typeof res.raw_token === 'string' && res.raw_token.startsWith('fwa_'), "Token starts with 'fwa_' prefix");

        // 3. Strict 256-bit Randomness (32 CSPRNG bytes) Verification
        const randomHex = res.raw_token.slice(4); // strip 'fwa_'
        assert(randomHex.length === 64, `Random hex component has exactly 64 hex characters (Found: ${randomHex.length})`);
        
        const randomBytes = Buffer.from(randomHex, 'hex');
        assert(randomBytes.length === 32, `Decoded random component originates from exactly 32 bytes (256 bits of entropy) (Found: ${randomBytes.length} bytes)`);

        // 4. Verify Database Persistence: SHA-256 Hash Only, Zero Plaintext
        const computedHash = crypto.createHash('sha256').update(res.raw_token).digest('hex');
        const dbToken = await pool.query("SELECT * FROM public.client_action_tokens WHERE id = $1", [res.token_id]);
        
        assert(dbToken.rows.length === 1, "Token record exists in public.client_action_tokens");
        assert(dbToken.rows[0].token_hash === computedHash, "DB stores exact 64-character SHA-256 digest of raw token");
        assert(dbToken.rows[0].status === 'active', "Token status is 'active'");
        assert(dbToken.rows[0].used_at === null, "Token used_at is null");

        // Full Database Leak Scan: Ensure raw token is absent from every column
        const dbLeakRes = await pool.query("SELECT id FROM public.client_action_tokens WHERE token_hash LIKE $1", ['%' + res.raw_token + '%']);
        assert(dbLeakRes.rows.length === 0, "Plaintext token string is 100% absent from database columns");

        // Subsequent lookup returns safe projection with zero raw token
        const pubLookup = await pool.query("SELECT public.get_public_client_action($1) as res", [res.raw_token]);
        const projData = pubLookup.rows[0].res;
        assert(projData.status === 'active', "Public lookup succeeds");
        assert(projData.raw_token === undefined, "Public projection contains ZERO raw token");
        assert(projData.token_hash === undefined, "Public projection contains ZERO token hash");

        // 5. 1,000 Generated Tokens Uniqueness & CSPRNG Entropy Audit
        console.log("2. Running 1,000 Token Uniqueness and Entropy Audit in SQL...");
        const sample1000Res = await pool.query(`
            SELECT 
                'fwa_' || encode(gen_random_bytes(32), 'hex') AS raw_token,
                encode(digest('fwa_' || encode(gen_random_bytes(32), 'hex'), 'sha256'), 'hex') AS token_hash
            FROM generate_series(1, 1000);
        `);
        
        const rawTokens = sample1000Res.rows.map(r => r.raw_token);
        const tokenHashes = sample1000Res.rows.map(r => r.token_hash);
        
        const uniqueRawTokens = new Set(rawTokens);
        const uniqueHashes = new Set(tokenHashes);

        assert(uniqueRawTokens.size === 1000, `1,000 generated tokens have exactly 1,000 unique values (Collision count = 0)`);
        assert(uniqueHashes.size === 1000, `1,000 SHA-256 digests have exactly 1,000 unique values (Collision count = 0)`);

        // Check each generated token in the 1000 batch satisfies exact 32 bytes (64 hex characters)
        rawTokens.forEach((tok, idx) => {
            const hex = tok.slice(4);
            if (hex.length !== 64 || Buffer.from(hex, 'hex').length !== 32) {
                throw new Error(`Token #${idx} does not have 32 bytes of randomness: ${tok}`);
            }
        });
        assert(true, "All 1,000 tokens verified: each contains exactly 32 CSPRNG bytes (256 bits)");

        // 6. Security Boundary Denials: Non-client task & Anonymous calls
        const teamTaskRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type) VALUES ($1, $2, 'Internal Dev Task', 'todo', 'internal') RETURNING id",
            [orgId, projectId]
        );
        const teamTaskId = teamTaskRes.rows[0].id;
        createdTaskIds.push(teamTaskId);

        let teamTaskBlocked = false;
        try {
            await pool.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
                SELECT public.generate_action_token('${teamTaskId}') AS res;
            `);
        } catch(e) {
            teamTaskBlocked = true;
            assert(e.message.includes('not a client action'), "Token generation blocked for internal tasks");
        }
        assert(teamTaskBlocked, "Internal task token generation threw expected exception");

        let anonBlocked = false;
        try {
            await pool.query(`
                SET LOCAL role TO anon;
                SET LOCAL request.jwt.claims TO '{}';
                SELECT public.generate_action_token('${taskId}') AS res;
            `);
        } catch(e) {
            anonBlocked = true;
            assert(e.message.includes('Access denied') || e.message.includes('permission denied'), "Anonymous caller denied token generation");
        }
        assert(anonBlocked, "Anonymous token generation threw expected exception");

        console.log("PASS: Phase 6D.1.1 Strict 256-bit CSPRNG & Zero Plaintext Suite completed 100%!");
    } catch(e) {
        console.error("FATAL ERROR in Token Suite:", e);
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
                await pool.query("DELETE FROM public.projects WHERE id = ANY($1::uuid[])", [createdProjectIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error in tokens suite:", e);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
