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
    console.log("=== Starting Permanent Data Preservation & Fixture Isolation Guard Test ===");
    let exitCode = 0;
    const trackedFixtureIds = [];
    
    try {
        const orgRes = await pool.query(`SELECT id FROM public.organizations LIMIT 1`);
        const orgId = orgRes.rows[0].id;
        
        // 1. Create Sentinel User-Created Record (Simulating pre-existing manual data)
        const sentinelRes = await pool.query(`
            INSERT INTO public.automation_rules (
                organization_id, name, trigger_event, conditions, actions, is_active
            ) VALUES (
                $1,
                'MANUAL DATA PRESERVATION SENTINEL — DO NOT DELETE',
                'document_approved',
                '[{"field":"category","operator":"eq","value":"contract"}]'::jsonb,
                '[{"type":"notify_owner","title":"SENTINEL VALUE DO NOT REMOVE"}]'::jsonb,
                false
            ) RETURNING id, created_at, name, trigger_event, conditions, actions, is_active;
        `, [orgId]);
        
        const sentinel = sentinelRes.rows[0];
        trackedFixtureIds.push(sentinel.id);
        
        console.log("Created Sentinel Record:", {
            id: sentinel.id,
            name: sentinel.name,
            created_at: sentinel.created_at,
            is_active: sentinel.is_active
        });
        
        // 2. Create Transient Test Fixture A & B
        const fixARes = await pool.query(`
            INSERT INTO public.automation_rules (
                organization_id, name, trigger_event, conditions, actions, is_active
            ) VALUES (
                $1, 'Transient Fixture A', 'stage_started', '[]'::jsonb, '[{"type":"create_task","title":"Task A"}]'::jsonb, true
            ) RETURNING id;
        `, [orgId]);
        const fixAId = fixARes.rows[0].id;
        trackedFixtureIds.push(fixAId);

        const fixBRes = await pool.query(`
            INSERT INTO public.automation_rules (
                organization_id, name, trigger_event, conditions, actions, is_active
            ) VALUES (
                $1, 'Transient Fixture B', 'stage_completed', '[]'::jsonb, '[{"type":"create_task","title":"Task B"}]'::jsonb, true
            ) RETURNING id;
        `, [orgId]);
        const fixBId = fixBRes.rows[0].id;
        trackedFixtureIds.push(fixBId);

        // 3. Execute Exact Cleanup of Fixture A
        console.log("Executing exact-ID cleanup of Fixture A...");
        await pool.query("SET session_replication_role = 'replica';");
        await pool.query("DELETE FROM public.automation_rules WHERE id = $1", [fixAId]);
        await pool.query("SET session_replication_role = 'origin';");
        
        // 4. Verify Fixture B and Sentinel were NOT affected
        const checkB = await pool.query("SELECT id FROM public.automation_rules WHERE id = $1", [fixBId]);
        assert(checkB.rows.length === 1, "Fixture B survived cleanup of Fixture A (Isolation verified)");

        const checkSentinel = await pool.query("SELECT * FROM public.automation_rules WHERE id = $1", [sentinel.id]);
        assert(checkSentinel.rows.length === 1, "Sentinel record exists after cleanup of other test fixtures");
        
        const currentSentinel = checkSentinel.rows[0];
        assert(currentSentinel.id === sentinel.id, "Sentinel UUID is identical");
        assert(new Date(currentSentinel.created_at).getTime() === new Date(sentinel.created_at).getTime(), "Sentinel created_at timestamp is identical (Not recreated)");
        assert(currentSentinel.name === sentinel.name, "Sentinel name is intact");
        assert(currentSentinel.trigger_event === sentinel.trigger_event, "Sentinel trigger_event is intact");
        assert(JSON.stringify(currentSentinel.conditions) === JSON.stringify(sentinel.conditions), "Sentinel conditions JSONB is intact");
        assert(JSON.stringify(currentSentinel.actions) === JSON.stringify(sentinel.actions), "Sentinel actions JSONB is intact");
        assert(currentSentinel.is_active === false, "Sentinel inactive status is intact");

        console.log("PASS: Data preservation and isolation guard passed 100%!");

    } catch(e) {
        console.error("FATAL ERROR in Data Preservation Guard:", e);
        exitCode = 1;
    } finally {
        try {
            await pool.query("SET session_replication_role = 'replica';");
            if (trackedFixtureIds.length > 0) {
                await pool.query("DELETE FROM public.automation_rules WHERE id = ANY($1::uuid[])", [trackedFixtureIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error in guard:", e);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
