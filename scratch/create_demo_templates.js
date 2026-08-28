const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    await client.connect();
    
    try {
        await client.query("BEGIN");
        await client.query("SET LOCAL role TO authenticated");
        await client.query("SET LOCAL request.jwt.claims TO '{\"sub\":\"27852879-0d5f-4c72-889d-69a0989302d2\"}'");

        const ownerId = "27852879-0d5f-4c72-889d-69a0989302d2"; // Anastasiia

        // --- Template A: Sales Department Audit ---
        const t1Res = await client.query(`
            INSERT INTO public.project_templates (name, description, project_type, category, estimated_duration_days, created_by, status)
            VALUES ('Sales Department Audit', 'Standard 4-week sales department diagnostic playbook.', 'consulting', 'Audit', 30, $1, 'active')
            RETURNING id;
        `, [ownerId]);
        const t1Id = t1Res.rows[0].id;

        const v1Res = await client.query(`
            INSERT INTO public.template_versions (template_id, version_number, status, is_locked, created_by)
            VALUES ($1, 1, 'published', true, $2)
            RETURNING id;
        `, [t1Id, ownerId]);
        const v1Id = v1Res.rows[0].id;

        // Stages
        const stages = [
            { title: 'Discovery & Onboarding', offset: 0, duration: 5 },
            { title: 'Audit & Diagnostics', offset: 5, duration: 10 },
            { title: 'Strategy & Recommendations', offset: 15, duration: 10 },
            { title: 'Final Review & Handover', offset: 25, duration: 5 }
        ];
        
        let s1Map = {};
        for (let i = 0; i < stages.length; i++) {
            const sRes = await client.query(`
                INSERT INTO public.template_stages (version_id, order_idx, title, offset_days, estimated_duration_days)
                VALUES ($1, $2, $3, $4, $5) RETURNING id;
            `, [v1Id, i + 1, stages[i].title, stages[i].offset, stages[i].duration]);
            s1Map[i] = sRes.rows[0].id;
        }

        // Milestones
        const mRes1 = await client.query(`
            INSERT INTO public.template_milestones (version_id, stage_id, order_idx, title, relative_due_offset)
            VALUES ($1, $2, 1, 'Diagnostic Report Approved', 15) RETURNING id;
        `, [v1Id, s1Map[1]]);
        
        const mRes2 = await client.query(`
            INSERT INTO public.template_milestones (version_id, stage_id, order_idx, title, relative_due_offset)
            VALUES ($1, $2, 2, 'Final Presentation Delivered', 30) RETURNING id;
        `, [v1Id, s1Map[3]]);

        // Tasks
        await client.query(`
            INSERT INTO public.template_tasks (version_id, stage_id, title, role_placeholder, relative_due_offset)
            VALUES 
            ($1, $2, 'Setup client workspace', 'pm', 1),
            ($1, $2, 'Request initial CRM access', 'specialist', 2),
            ($1, $3, 'Analyze sales funnel data', 'specialist', 10),
            ($1, $3, 'Interview Head of Sales', 'pm', 12),
            ($1, $4, 'Draft Recommendations', 'specialist', 20),
            ($1, $5, 'Prepare final presentation', 'pm', 28);
        `, [v1Id, s1Map[0], s1Map[1], s1Map[2], s1Map[3]]);

        // Client Actions
        await client.query(`
            INSERT INTO public.template_client_actions (version_id, stage_id, title, deadline_offset)
            VALUES 
            ($1, $2, 'Provide CRM access credentials', 3),
            ($1, $2, 'Fill in initial business questionnaire', 5),
            ($1, $3, 'Sign project acceptance act', 30);
        `, [v1Id, s1Map[0], s1Map[3]]);
        
        // Documents
        await client.query(`
            INSERT INTO public.template_documents (version_id, stage_id, title, category, approval_required)
            VALUES 
            ($1, $2, 'NDA & MSA', 'Legal', true),
            ($1, $3, 'Diagnostic Findings Report', 'Deliverable', false),
            ($1, $4, 'Strategic Roadmap', 'Deliverable', true);
        `, [v1Id, s1Map[0], s1Map[1], s1Map[2]]);

        // Meetings
        await client.query(`
            INSERT INTO public.template_meetings (version_id, stage_id, title, meeting_type, scheduling_offset_days)
            VALUES 
            ($1, $2, 'Project Kickoff', 'kickoff', 2),
            ($1, $3, 'Weekly Sync 1', 'sync', 10),
            ($1, $4, 'Weekly Sync 2', 'sync', 17),
            ($1, $5, 'Final Review & Handover', 'presentation', 29);
        `, [v1Id, s1Map[0], s1Map[1], s1Map[2], s1Map[3]]);

        
        // --- Template B: CRM Implementation ---
        const t2Res = await client.query(`
            INSERT INTO public.project_templates (name, description, project_type, category, estimated_duration_days, created_by, status)
            VALUES ('CRM Implementation Blueprint', 'Technical deployment of CRM system.', 'implementation', 'Tech', 60, $1, 'active')
            RETURNING id;
        `, [ownerId]);
        const t2Id = t2Res.rows[0].id;

        const v2Res = await client.query(`
            INSERT INTO public.template_versions (template_id, version_number, status, is_locked, created_by)
            VALUES ($1, 1, 'published', true, $2)
            RETURNING id;
        `, [t2Id, ownerId]);
        const v2Id = v2Res.rows[0].id;

        await client.query(`
            INSERT INTO public.template_stages (version_id, order_idx, title, offset_days, estimated_duration_days)
            VALUES ($1, 1, 'Technical Discovery', 0, 10),
                   ($1, 2, 'System Architecture', 10, 15),
                   ($1, 3, 'Data Migration', 25, 20),
                   ($1, 4, 'Go-Live & Training', 45, 15);
        `, [v2Id]);

        await client.query("COMMIT");
        console.log("Demo templates created successfully.");
    } catch (e) {
        console.error("Failed:", e);
    } finally {
        await client.end();
    }
}

run();
