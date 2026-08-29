const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    const c1 = await pool.connect();
    
    try {
        console.log("=== PHASE 6B: FINAL GAP CLOSURE SUITE ===");
        
        // Setup
        const ownerQuery = await c1.query("SELECT id FROM auth.users WHERE email = 'anzaitseva96@gmail.com'");
        const ownerId = ownerQuery.rows[0].id;
        const orgQuery = await c1.query("SELECT id FROM public.organizations WHERE name = 'Test Org Alpha (Phase 1B)'");
        const orgId = orgQuery.rows[0].id;
        
        // 1. Create Rich Source Template A
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

        // 3 Stages, 2 Milestones, 6 Tasks, 2 Actions, 2 Docs, 2 Meetings
        const stg1 = await c1.query(`INSERT INTO public.template_stages (version_id, order_idx, title) VALUES ($1, 1, 'Stage 1') RETURNING id`, [versionA1]);
        const stage1 = stg1.rows[0].id;
        const stg2 = await c1.query(`INSERT INTO public.template_stages (version_id, order_idx, title, depends_on_stage_id) VALUES ($1, 2, 'Stage 2', $2) RETURNING id`, [versionA1, stage1]);
        const stage2 = stg2.rows[0].id;
        const stg3 = await c1.query(`INSERT INTO public.template_stages (version_id, order_idx, title, depends_on_stage_id) VALUES ($1, 3, 'Stage 3', $2) RETURNING id`, [versionA1, stage2]);
        const stage3 = stg3.rows[0].id;

        await c1.query(`INSERT INTO public.template_milestones (version_id, stage_id, order_idx, title) VALUES ($1, $2, 1, 'Milestone 1'), ($1, $3, 2, 'Milestone 2')`, [versionA1, stage1, stage3]);
        await c1.query(`INSERT INTO public.template_tasks (version_id, stage_id, title, role_placeholder) VALUES ($1, $2, 'Task 1.1', 'pm'), ($1, $2, 'Task 1.2', 'specialist'), ($1, $3, 'Task 2.1', 'pm'), ($1, $3, 'Task 2.2', 'specialist'), ($1, $4, 'Task 3.1', 'owner'), ($1, $4, 'Task 3.2', 'pm')`, [versionA1, stage1, stage2, stage3]);
        await c1.query(`INSERT INTO public.template_client_actions (version_id, stage_id, title) VALUES ($1, $2, 'Action 1'), ($1, $3, 'Action 2')`, [versionA1, stage1, stage3]);
        await c1.query(`INSERT INTO public.template_documents (version_id, stage_id, title, category) VALUES ($1, $2, 'Doc 1', 'contract'), ($1, $3, 'Doc 2', 'report')`, [versionA1, stage1, stage2]);
        await c1.query(`INSERT INTO public.template_meetings (version_id, stage_id, title, meeting_type) VALUES ($1, $2, 'Meeting 1', 'kickoff'), ($1, $3, 'Meeting 2', 'review')`, [versionA1, stage1, stage3]);

        // Gap 2: Complete Source Immutability Mutation
        console.log("\\n--- Gap 2: Source Immutability Mutation ---");
        const cloneRes1 = await c1.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT clone_project_template('${templateA}', 'Cloned Template B', gen_random_uuid()::text) AS res;
        `);
        const cRes1 = Array.isArray(cloneRes1) ? cloneRes1[cloneRes1.length - 1].rows[0].res : cloneRes1.rows[0].res;
        const verB = cRes1.new_version_id;

        // Mutate Clone B extensively
        const stageB = (await c1.query(`SELECT id FROM public.template_stages WHERE version_id = $1 LIMIT 1`, [verB])).rows[0].id;
        await c1.query(`UPDATE public.template_stages SET title = 'Mutated Stage' WHERE id = $1`, [stageB]);
        await c1.query(`UPDATE public.template_milestones SET title = 'Mutated Milestone' WHERE version_id = $1`, [verB]);
        await c1.query(`UPDATE public.template_client_actions SET title = 'Mutated Action' WHERE version_id = $1`, [verB]);
        await c1.query(`UPDATE public.template_meetings SET title = 'Mutated Meeting' WHERE version_id = $1`, [verB]);
        await c1.query(`UPDATE public.template_documents SET title = 'Mutated Doc' WHERE version_id = $1`, [verB]);
        await c1.query(`INSERT INTO public.template_tasks (version_id, stage_id, title) VALUES ($1, $2, 'New Task B')`, [verB, stageB]);

        // Assert Source A is completely unchanged
        const aStg = await c1.query(`SELECT COUNT(*) as c FROM public.template_stages WHERE version_id = $1 AND title = 'Mutated Stage'`, [versionA1]);
        const aMil = await c1.query(`SELECT COUNT(*) as c FROM public.template_milestones WHERE version_id = $1 AND title = 'Mutated Milestone'`, [versionA1]);
        const aTsk = await c1.query(`SELECT COUNT(*) as c FROM public.template_tasks WHERE version_id = $1`, [versionA1]);
        const aAct = await c1.query(`SELECT COUNT(*) as c FROM public.template_client_actions WHERE version_id = $1 AND title = 'Mutated Action'`, [versionA1]);
        const aMtg = await c1.query(`SELECT COUNT(*) as c FROM public.template_meetings WHERE version_id = $1 AND title = 'Mutated Meeting'`, [versionA1]);
        const aDoc = await c1.query(`SELECT COUNT(*) as c FROM public.template_documents WHERE version_id = $1 AND title = 'Mutated Doc'`, [versionA1]);
        
        if (aStg.rows[0].c == 0 && aMil.rows[0].c == 0 && aTsk.rows[0].c == 6 && aAct.rows[0].c == 0 && aMtg.rows[0].c == 0 && aDoc.rows[0].c == 0) {
            console.log("✔ [PASS] Source Immutability verified. All source nested entities remained unchanged.");
        } else {
            console.log("✘ [FAIL] Source mutated!");
        }

        // Gap 3: Complete Atomic Rollback Matrix
        console.log("\\n--- Gap 3: Atomic Rollback Matrix ---");
        // Create fail trigger on documents
        await c1.query(`
            CREATE OR REPLACE FUNCTION fail_docs() RETURNS trigger AS $$
            BEGIN RAISE EXCEPTION 'Intentional rollback failure'; END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER tr_fail_docs BEFORE INSERT ON public.template_documents FOR EACH ROW EXECUTE FUNCTION fail_docs();
        `);
        
        const countAll = async () => {
            const res = {};
            res.tpl = parseInt((await c1.query(`SELECT count(*) as c FROM public.project_templates`)).rows[0].c);
            res.stg = parseInt((await c1.query(`SELECT count(*) as c FROM public.template_stages`)).rows[0].c);
            res.mil = parseInt((await c1.query(`SELECT count(*) as c FROM public.template_milestones`)).rows[0].c);
            res.tsk = parseInt((await c1.query(`SELECT count(*) as c FROM public.template_tasks`)).rows[0].c);
            res.act = parseInt((await c1.query(`SELECT count(*) as c FROM public.template_client_actions`)).rows[0].c);
            res.doc = parseInt((await c1.query(`SELECT count(*) as c FROM public.template_documents`)).rows[0].c);
            res.mtg = parseInt((await c1.query(`SELECT count(*) as c FROM public.template_meetings`)).rows[0].c);
            return res;
        };

        const beforeCnt = await countAll();
        try {
            await c1.query(`SELECT clone_project_template('${templateA}', 'Rollback', gen_random_uuid()::text) AS res`);
        } catch(e) {} // expected
        const afterCnt = await countAll();

        const diffs = [
            afterCnt.tpl - beforeCnt.tpl,
            afterCnt.stg - beforeCnt.stg,
            afterCnt.mil - beforeCnt.mil,
            afterCnt.tsk - beforeCnt.tsk,
            afterCnt.act - beforeCnt.act,
            afterCnt.doc - beforeCnt.doc,
            afterCnt.mtg - beforeCnt.mtg
        ];
        
        if (diffs.every(d => d === 0)) {
            console.log("✔ [PASS] 0 orphans detected across all 7 nested entity tables.");
        } else {
            console.log("✘ [FAIL] Orphans detected:", diffs);
        }
        await c1.query(`DROP TRIGGER tr_fail_docs ON public.template_documents; DROP FUNCTION fail_docs();`);

        // Gap 4: Explicit Cross-Tenant Attack Evidence
        console.log("\\n--- Gap 4: Explicit Cross-Tenant Attack Evidence ---");
        const betaOrg = await c1.query("SELECT id FROM public.organizations WHERE name = 'Test Org Beta (Phase 1B)'");
        const pmBeta = await c1.query("SELECT user_id FROM public.organization_memberships WHERE organization_id = $1 LIMIT 1", [betaOrg.rows[0].id]);
        const betaPmId = pmBeta.rows[0].user_id;

        // Foreign org injection simulation (RPC signature doesn't take org_id, it infers it securely via RLS).
        // Let's attempt a direct RPC cross-tenant call.
        const beforeTplCnt = (await c1.query(`SELECT COUNT(*) as c FROM public.project_templates WHERE organization_id = $1`, [betaOrg.rows[0].id])).rows[0].c;
        try {
            const attack = await c1.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${betaPmId}"}';
                SELECT clone_project_template('${templateA}', 'Hacked Beta', gen_random_uuid()::text) AS res;
            `);
            const atkRes = Array.isArray(attack) ? attack[attack.length - 1].rows[0].res : attack.rows[0].res;
            console.log("✘ [FAIL] Cross-tenant clone allowed! Returned: " + JSON.stringify(atkRes));
        } catch(e) {
            if (e.message.includes('permission denied') || e.message.includes('Access denied') || e.message.includes('not found')) {
                console.log("✔ [PASS] Direct RPC Cross-Tenant Clone DENIED (Exception).");
            } else {
                console.log("✘ [FAIL] Direct RPC Cross-Tenant Clone DENIED but unexpected error: " + e.message);
            }
        }
        const afterTplCnt = (await c1.query(`SELECT COUNT(*) as c FROM public.project_templates WHERE organization_id = $1`, [betaOrg.rows[0].id])).rows[0].c;
        if (beforeTplCnt === afterTplCnt) console.log("✔ [PASS] 0 templates created in Beta org (Foreign injection mitigated implicitly).");

        // Gap 5: Complete Draft Lifecycle
        console.log("\n--- Gap 5: Complete Draft Lifecycle ---");
        const draftRes1 = await c1.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT create_template_draft('${templateA}', gen_random_uuid()::text) AS res;
        `);
        const dr1 = Array.isArray(draftRes1) ? draftRes1[draftRes1.length - 1].rows[0].res : draftRes1.rows[0].res;
        const v2Id = dr1.new_version_id;
        const v2Num = (await c1.query(`SELECT version_number, status FROM public.template_versions WHERE id = $1`, [v2Id])).rows[0];
        
        if (v2Num.version_number === 2 && v2Num.status === 'draft') console.log("✔ [PASS] Draft v2 created with deterministic numbering.");

        const draftRes2 = await c1.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT create_template_draft('${templateA}', gen_random_uuid()::text) AS res;
        `);
        const dr2 = Array.isArray(draftRes2) ? draftRes2[draftRes2.length - 1].rows[0].res : draftRes2.rows[0].res;
        if (dr2.success === false) console.log("✔ [PASS] Concurrent/duplicate Draft deterministic rejection.");

        // Publish v2
        await c1.query(`UPDATE public.template_versions SET status = 'published' WHERE id = $1`, [v2Id]);
        const finalV2 = (await c1.query(`SELECT status FROM public.template_versions WHERE id = $1`, [v2Id])).rows[0].status;
        const finalV1 = (await c1.query(`SELECT status FROM public.template_versions WHERE id = $1`, [versionA1])).rows[0].status;
        if (finalV2 === 'published' && finalV1 === 'published') console.log("✔ [PASS] Draft v2 published successfully, v1 remains published.");

    } catch (e) {
        console.error(e);
    } finally {
        c1.release();
        pool.end();
    }
}
run();
