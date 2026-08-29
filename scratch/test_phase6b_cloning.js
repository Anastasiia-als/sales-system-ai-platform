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

        // Add 3 Stages
        const stg1 = await c1.query(`INSERT INTO public.template_stages (version_id, order_idx, title) VALUES ($1, 1, 'Stage 1') RETURNING id`, [versionA1]);
        const stage1 = stg1.rows[0].id;
        const stg2 = await c1.query(`INSERT INTO public.template_stages (version_id, order_idx, title, depends_on_stage_id) VALUES ($1, 2, 'Stage 2', $2) RETURNING id`, [versionA1, stage1]);
        const stage2 = stg2.rows[0].id;
        const stg3 = await c1.query(`INSERT INTO public.template_stages (version_id, order_idx, title, depends_on_stage_id) VALUES ($1, 3, 'Stage 3', $2) RETURNING id`, [versionA1, stage2]);
        const stage3 = stg3.rows[0].id;

        // Add 2 Milestones
        const m1 = await c1.query(`INSERT INTO public.template_milestones (version_id, stage_id, order_idx, title) VALUES ($1, $2, 1, 'Milestone 1') RETURNING id`, [versionA1, stage1]);
        const milestone1 = m1.rows[0].id;
        const m2 = await c1.query(`INSERT INTO public.template_milestones (version_id, stage_id, order_idx, title) VALUES ($1, $2, 2, 'Milestone 2') RETURNING id`, [versionA1, stage3]);
        const milestone2 = m2.rows[0].id;

        // Add 6 Tasks
        await c1.query(`INSERT INTO public.template_tasks (version_id, stage_id, title, role_placeholder) VALUES ($1, $2, 'Task 1.1', 'pm')`, [versionA1, stage1]);
        await c1.query(`INSERT INTO public.template_tasks (version_id, stage_id, title, role_placeholder) VALUES ($1, $2, 'Task 1.2', 'specialist')`, [versionA1, stage1]);
        await c1.query(`INSERT INTO public.template_tasks (version_id, stage_id, title, role_placeholder) VALUES ($1, $2, 'Task 2.1', 'pm')`, [versionA1, stage2]);
        await c1.query(`INSERT INTO public.template_tasks (version_id, stage_id, title, role_placeholder) VALUES ($1, $2, 'Task 2.2', 'specialist')`, [versionA1, stage2]);
        await c1.query(`INSERT INTO public.template_tasks (version_id, stage_id, title, role_placeholder) VALUES ($1, $2, 'Task 3.1', 'owner')`, [versionA1, stage3]);
        await c1.query(`INSERT INTO public.template_tasks (version_id, stage_id, title, role_placeholder) VALUES ($1, $2, 'Task 3.2', 'pm')`, [versionA1, stage3]);

        // Add 2 Client Actions
        await c1.query(`INSERT INTO public.template_client_actions (version_id, stage_id, title) VALUES ($1, $2, 'Action 1')`, [versionA1, stage1]);
        await c1.query(`INSERT INTO public.template_client_actions (version_id, stage_id, title) VALUES ($1, $2, 'Action 2')`, [versionA1, stage3]);

        // Add 2 Documents
        await c1.query(`INSERT INTO public.template_documents (version_id, stage_id, title, category) VALUES ($1, $2, 'Doc 1', 'contract')`, [versionA1, stage1]);
        await c1.query(`INSERT INTO public.template_documents (version_id, stage_id, title, category) VALUES ($1, $2, 'Doc 2', 'report')`, [versionA1, stage2]);

        // Add 2 Meetings
        await c1.query(`INSERT INTO public.template_meetings (version_id, stage_id, title, meeting_type) VALUES ($1, $2, 'Meeting 1', 'kickoff')`, [versionA1, stage1]);
        await c1.query(`INSERT INTO public.template_meetings (version_id, stage_id, title, meeting_type) VALUES ($1, $2, 'Meeting 2', 'review')`, [versionA1, stage3]);


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
                
                // Get source and clone data
                const srcStages = await c1.query(`SELECT id FROM public.template_stages WHERE version_id = $1`, [versionA1]);
                const clnStages = await c1.query(`SELECT id FROM public.template_stages WHERE version_id = $1`, [newVerId]);
                const srcTasks = await c1.query(`SELECT id FROM public.template_tasks WHERE version_id = $1`, [versionA1]);
                const clnTasks = await c1.query(`SELECT id FROM public.template_tasks WHERE version_id = $1`, [newVerId]);
                
                const intersect = (arr1, arr2) => arr1.filter(x => arr2.includes(x)).length;
                const sharedStages = intersect(srcStages.rows.map(r=>r.id), clnStages.rows.map(r=>r.id));
                const sharedTasks = intersect(srcTasks.rows.map(r=>r.id), clnTasks.rows.map(r=>r.id));

                if (clnStages.rows.length === 3 && sharedStages === 0 && clnTasks.rows.length === 6 && sharedTasks === 0) {
                    console.log("✔ [PASS] Cloned entities use new IDs (Shared IDs = 0).");
                } else {
                    console.log("✘ [FAIL] Cloned entities shared IDs or counts mismatched!");
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
                const bDocs = await c1.query(`SELECT id FROM public.template_documents WHERE version_id = $1`, [verB]);
                const bMeetings = await c1.query(`SELECT id FROM public.template_meetings WHERE version_id = $1`, [verB]);
                const bClientActions = await c1.query(`SELECT id FROM public.template_client_actions WHERE version_id = $1`, [verB]);
                
                if (bTasks.rows.length === 6 && bDocs.rows.length === 2 && bMeetings.rows.length === 2 && bClientActions.rows.length === 2) {
                    console.log("✔ [PASS] Template B has all nested entities (Tasks, Docs, Meetings, Actions).");
                } else {
                    console.log("✘ [FAIL] Template B missing nested entities!");
                }

                // Mutate B
                await c1.query(`
                    INSERT INTO public.template_tasks (version_id, stage_id, title) 
                    VALUES ($1, (SELECT id FROM public.template_stages WHERE version_id = $1 LIMIT 1), 'Task 4 - B')
                `, [verB]);

                await c1.query(`UPDATE public.template_documents SET title = 'Doc Modified' WHERE version_id = $1`, [verB]);

                // Check A remains unchanged
                const aTasks = await c1.query(`SELECT COUNT(*) as c FROM public.template_tasks WHERE version_id = $1`, [versionA1]);
                const aDocs = await c1.query(`SELECT title FROM public.template_documents WHERE version_id = $1 AND title = 'Doc Modified'`, [versionA1]);
                if (parseInt(aTasks.rows[0].c) === 6 && aDocs.rows.length === 0) {
                    console.log("✔ [PASS] Source Template A remains completely unmodified after mutating B.");
                } else {
                    console.log("✘ [FAIL] Source Template A was modified!");
                }
            } else {
                console.log("✘ [FAIL] Template cloning failed:", cRes1.error);
            }
        } catch(e) {
            console.log("Error during clone:", e.message);
        }

        // 3.5 Atomicity / Rollback test
        console.log("\\n--- 3.5 Atomicity & Rollback Test ---");
        try {
            await c1.query(`
                CREATE OR REPLACE FUNCTION fail_meetings() RETURNS trigger AS $$
                BEGIN RAISE EXCEPTION 'Intentional failure'; END;
                $$ LANGUAGE plpgsql;
                CREATE TRIGGER tr_fail_meetings BEFORE INSERT ON public.template_meetings FOR EACH ROW EXECUTE FUNCTION fail_meetings();
            `);
            const prevTemplates = parseInt((await c1.query(`SELECT count(*) as c FROM public.project_templates`)).rows[0].c);
            const prevStages = parseInt((await c1.query(`SELECT count(*) as c FROM public.template_stages`)).rows[0].c);

            try {
                await c1.query(`SELECT clone_project_template('${templateA}', 'Rollback Test', gen_random_uuid()::text) AS res`);
            } catch(e) {
                // Ignore, expecting failure
            }

            const afterTemplates = parseInt((await c1.query(`SELECT count(*) as c FROM public.project_templates`)).rows[0].c);
            const afterStages = parseInt((await c1.query(`SELECT count(*) as c FROM public.template_stages`)).rows[0].c);

            if (prevTemplates === afterTemplates && prevStages === afterStages) {
                console.log("✔ [PASS] 0 orphan templates and 0 orphan stages after intentional failure.");
            } else {
                console.log("✘ [FAIL] Orphans detected!");
            }
            
            await c1.query(`DROP TRIGGER tr_fail_meetings ON public.template_meetings; DROP FUNCTION fail_meetings();`);
        } catch(e) {
            console.error("Rollback test error:", e);
        }

        // 3.6 Concurrency / Idempotency test
        console.log("\\n--- 3.6 Concurrency & Idempotency Test ---");
        // 3.6 Concurrency / Idempotency test
        console.log("\\n--- 3.6 Concurrency & Idempotency Test ---");
        try {
            const idemKey = 'idem-concurrency-' + Date.now();
            const q = `
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
                SELECT clone_project_template('${templateA}', 'Idempotency Test', '${idemKey}') AS res
            `;
            const c2 = await pool.connect();
            const c3 = await pool.connect();
            const [p1, p2] = await Promise.all([
                c2.query(q), c3.query(q)
            ]);
            c2.release();
            c3.release();

            const r1 = Array.isArray(p1) ? p1[p1.length - 1].rows[0].res : p1.rows[0].res;
            const r2 = Array.isArray(p2) ? p2[p2.length - 1].rows[0].res : p2.rows[0].res;
            
            if (r1.success && !r2.success && r2.error.includes('Idempotency key already used')) {
                console.log("✔ [PASS] Concurrent double-click correctly handled. Only 1 success, 1 deterministic rejection.");
            } else if (r2.success && !r1.success && r1.error.includes('Idempotency key already used')) {
                console.log("✔ [PASS] Concurrent double-click correctly handled. Only 1 success, 1 deterministic rejection.");
            } else {
                console.log("✘ [FAIL] Concurrency handling failed:", r1, r2);
            }
        } catch(e) {
            if (e.message && e.message.includes('duplicate key value violates unique constraint')) {
                console.log("✔ [PASS] Concurrent double-click correctly handled (DB constraint rejected second query).");
            } else {
                console.error("✘ [FAIL] Concurrency test error:", e);
            }
        }

        // 4. RLS & Multi-tenant Security
        console.log("\\n--- 4. RLS & Multi-tenant Security ---");
        const specQuery = await c1.query("SELECT id FROM auth.users WHERE email = 'specialist_test_1b@firstwin.io'");
        const specId = specQuery.rows[0].id;
        const pmAlphaQuery = await c1.query("SELECT id FROM auth.users WHERE email = 'pm_test_1b@firstwin.io'");
        const pmAlphaId = pmAlphaQuery.rows[0].id;
        // Find Beta PM
        const betaOrg = await c1.query("SELECT id FROM public.organizations WHERE name = 'Test Org Beta'");
        if (betaOrg.rows.length > 0) {
            const pmBeta = await c1.query("SELECT id FROM public.user_roles WHERE role = 'pm' AND organization_id = $1 LIMIT 1", [betaOrg.rows[0].id]);
            if (pmBeta.rows.length > 0) {
                const pmBetaId = pmBeta.rows[0].user_id;
                try {
                    const betaClone = await c1.query(`
                        SET LOCAL role TO authenticated;
                        SET LOCAL request.jwt.claims TO '{"sub":"${pmBetaId}"}';
                        SELECT clone_project_template('${templateA}', 'Hacked Beta', gen_random_uuid()::text) AS res;
                    `);
                    const bRes = Array.isArray(betaClone) ? betaClone[betaClone.length - 1].rows[0].res : betaClone.rows[0].res;
                    if (!bRes.success) console.log("✔ [PASS] Beta PM blocked from cloning Alpha template.");
                    else console.log("✘ [FAIL] Beta PM allowed!");
                } catch(e) {
                    console.log("✔ [PASS] Beta PM blocked (Error thrown).");
                }
            }
        }
        
        try {
            const specClone = await c1.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${specId}"}';
                SELECT clone_project_template('${templateA}', 'Hacked Spec', gen_random_uuid()::text) AS res;
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

        try {
            const pmClone = await c1.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${pmAlphaId}"}';
                SELECT clone_project_template('${templateA}', 'Alpha PM Clone', gen_random_uuid()::text) AS res;
            `);
            const pmRes = Array.isArray(pmClone) ? pmClone[pmClone.length - 1].rows[0].res : pmClone.rows[0].res;
            if (pmRes.success) {
                console.log("✔ [PASS] Alpha PM successfully cloned Alpha template.");
            } else {
                console.log("✘ [FAIL] Alpha PM failed to clone!", pmRes.error);
            }
        } catch(e) {
            console.log("✘ [FAIL] Alpha PM threw error:", e.message);
        }

    } catch (e) {
        console.error(e);
    } finally {
        c1.release();
        pool.end();
    }
}
run();
