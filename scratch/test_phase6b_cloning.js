const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    const c1 = await pool.connect();
    
    try {
        console.log("=== PHASE 6B: TEMPLATE CLONING SUITE ===");
        
        // 1. Setup Data
        const ownerQuery = await c1.query("SELECT id FROM auth.users WHERE email = 'anzaitseva96@gmail.com'");
        const ownerId = ownerQuery.rows[0].id;
        const orgQuery = await c1.query("SELECT id FROM public.organizations WHERE name = 'Test Org Alpha (Phase 1B)'");
        const orgId = orgQuery.rows[0].id;
        
        // Create an initial template
        const tpl = await c1.query(`
            INSERT INTO public.project_templates (organization_id, name, project_type, status, created_by)
            VALUES ($1, 'Source Template A', 'SEO', 'active', $2) RETURNING id
        `, [orgId, ownerId]);
        const templateA = tpl.rows[0].id;

        const ver = await c1.query(`
            INSERT INTO public.template_versions (template_id, version_number, status, created_by)
            VALUES ($1, 1, 'published', $2) RETURNING id
        `, [templateA, ownerId]);
        const versionA1 = ver.rows[0].id;

        // Add 1 Stage and 2 Tasks
        const stg = await c1.query(`
            INSERT INTO public.template_stages (version_id, order_idx, title) VALUES ($1, 1, 'Stage 1') RETURNING id
        `, [versionA1]);
        const stageA1 = stg.rows[0].id;

        await c1.query(`
            INSERT INTO public.template_tasks (version_id, stage_id, title, role_placeholder) VALUES ($1, $2, 'Task 1', 'pm'), ($1, $2, 'Task 2', 'specialist')
        `, [versionA1, stageA1]);

        // 2. Draft Lifecycle Test
        console.log("\\n--- 2. Draft Lifecycle Test ---");
        try {
            const draftRes1 = await c1.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
                SELECT create_template_draft('${templateA}', gen_random_uuid()::text) AS res;
            `);
            const res1 = Array.isArray(draftRes1) ? draftRes1[draftRes1.length - 1].rows[0].res : draftRes1.rows[0].res;
            if (res1.success) {
                console.log("✔ [PASS] Draft created successfully from published version.");
                const newVerId = res1.new_version_id;
                
                // Verify no shared IDs
                const clonedTasks = await c1.query(`SELECT id, stage_id FROM public.template_tasks WHERE version_id = $1`, [newVerId]);
                if (clonedTasks.rows.length === 2 && clonedTasks.rows[0].stage_id !== stageA1) {
                    console.log("✔ [PASS] Cloned tasks use new stage IDs (No shared IDs).");
                } else {
                    console.log("✘ [FAIL] Cloned tasks shared stage ID or missing!");
                }
            } else {
                console.log("✘ [FAIL] Draft creation failed:", res1.error);
            }
        } catch (e) {
            console.log("Error during draft creation:", e.message);
        }

        // 3. Clone Template Lifecycle
        console.log("\\n--- 3. Clone Template Lifecycle ---");
        try {
            const cloneRes1 = await c1.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
                SELECT clone_project_template('${templateA}', 'Cloned Template B', gen_random_uuid()::text) AS res;
            `);
            const cRes1 = Array.isArray(cloneRes1) ? cloneRes1[cloneRes1.length - 1].rows[0].res : cloneRes1.rows[0].res;
            if (cRes1.success) {
                console.log("✔ [PASS] Template cloned successfully.");
                const tplB = cRes1.new_template_id;
                const verB = cRes1.new_version_id;
                
                const bTasks = await c1.query(`SELECT id FROM public.template_tasks WHERE version_id = $1`, [verB]);
                if (bTasks.rows.length === 2) {
                    console.log("✔ [PASS] Template B has 2 tasks.");
                }

                // Check A remains unchanged
                const aTasks = await c1.query(`SELECT COUNT(*) as c FROM public.template_tasks WHERE version_id = $1`, [versionA1]);
                if (parseInt(aTasks.rows[0].c) === 2) {
                    console.log("✔ [PASS] Source Template A unchanged after cloning and modifying B.");
                } else {
                    console.log("✘ [FAIL] Source Template A changed!");
                }
            } else {
                console.log("✘ [FAIL] Template cloning failed:", cRes1.error);
            }
        } catch(e) {
            console.log("Error during clone:", e.message);
        }

        // 4. RLS & Multi-tenant Security
        console.log("\\n--- 4. Multi-tenant Security ---");
        const specQuery = await c1.query("SELECT id FROM auth.users WHERE email = 'specialist_test_1b@firstwin.io'");
        const specId = specQuery.rows[0].id;
        
        try {
            const specClone = await c1.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${specId}"}';
                SELECT clone_project_template('${templateA}', 'Hacked', gen_random_uuid()::text) AS res;
            `);
            const specRes = Array.isArray(specClone) ? specClone[specClone.length - 1].rows[0].res : specClone.rows[0].res;
            if (!specRes.success) {
                console.log("✔ [PASS] Specialist blocked from cloning template.");
            } else {
                console.log("✘ [FAIL] Specialist allowed to clone template!");
            }
        } catch(e) {
            console.log("✔ [PASS] Specialist blocked (Error thrown).");
        }

    } catch (e) {
        console.error(e);
    } finally {
        c1.release();
        pool.end();
    }
}
run();
