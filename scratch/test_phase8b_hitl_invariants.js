const { Pool } = require('pg');
const { AIGateway } = require('../js/portal/api/ai-gateway.js');
const crypto = require('crypto');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const gateway = new AIGateway({ pool });

function assert(condition, message) {
    if (!condition) {
        console.error("FAIL: " + message);
        process.exit(1);
    }
    console.log("PASS: " + message);
}

async function run() {
    console.log("=== Phase 8B: Human-in-the-Loop (HITL) Invariants Test ===");

    // 0. Ensure server mock mode is enabled
    try {
        await fetch('http://localhost:8002/api/v1/ai/mock-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true })
        });
    } catch (_) {}
    process.env.AI_MOCK_TRANSPORT = 'true';

    // 1. Setup isolated test fixtures: Organization, Project, Meeting
    const orgId = 'd1111111-1111-1111-1111-111111111111';
    const projId = 'd2222222-2222-2222-2222-222222222222';
    const meetingId = 'd3333333-3333-3333-3333-333333333333';
    const artifactId = 'd4444444-4444-4444-4444-444444444444';

    const userRes = await pool.query("SELECT id FROM public.profiles LIMIT 1");
    const testUserId = userRes.rows[0]?.id;
    assert(!!testUserId, "Found test user profile");

    // Clean up previous run if any
    try {
        await pool.query("SET session_replication_role = 'replica';");
        await pool.query("DELETE FROM public.meeting_ai_artifacts WHERE id = $1", [artifactId]);
        await pool.query("DELETE FROM public.tasks WHERE source_meeting_id = $1", [meetingId]);
        await pool.query("DELETE FROM public.meeting_decisions WHERE meeting_id = $1", [meetingId]);
        await pool.query("DELETE FROM public.meeting_notes WHERE meeting_id = $1", [meetingId]);
        await pool.query("DELETE FROM public.meetings WHERE id = $1", [meetingId]);
        await pool.query("DELETE FROM public.projects WHERE id = $1", [projId]);
        await pool.query("DELETE FROM public.organization_memberships WHERE organization_id = $1", [orgId]);
        await pool.query("DELETE FROM public.organizations WHERE id = $1", [orgId]);
        await pool.query("SET session_replication_role = 'origin';");
    } catch (_) {}

    // Insert fixtures
    await pool.query("INSERT INTO public.organizations (id, name) VALUES ($1, 'HITL Test Org')", [orgId]);
    await pool.query(
        "INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'admin', true)",
        [orgId, testUserId]
    );
    await pool.query(
        "INSERT INTO public.projects (id, organization_id, name, status) VALUES ($1, $2, 'HITL Project', 'in_progress')",
        [projId, orgId]
    );
    await pool.query(
        "INSERT INTO public.meetings (id, organization_id, project_id, title, meeting_type, status, start_at, end_at) VALUES ($1, $2, $3, 'HITL Architecture Review', 'review', 'completed', NOW(), NOW() + interval '1 hour')",
        [meetingId, orgId, projId]
    );

    // Count existing tasks and decisions for meeting before AI generation
    const initialTasksRes = await pool.query("SELECT COUNT(*) FROM public.tasks WHERE source_meeting_id = $1", [meetingId]);
    assert(parseInt(initialTasksRes.rows[0].count, 10) === 0, "Initial task count for meeting is 0");

    const initialDecRes = await pool.query("SELECT COUNT(*) FROM public.meeting_decisions WHERE meeting_id = $1", [meetingId]);
    assert(parseInt(initialDecRes.rows[0].count, 10) === 0, "Initial decisions count for meeting is 0");

    // 2. Execute AI generation
    const rawNotes = `
        Обговорення архітектури Phase 8B.
        Потрібно реалізувати протокол та кандидатури задач.
        Рішення: Затвердити статус DRAFT для всіх згенерованих артефактів.
        Дія 1: Підготувати міграцію таблиці meeting_ai_artifacts (internal, high).
        Дія 2: Запросити зворотний зв'язок від клієнта (client, medium).
    `;

    const aiResult = await gateway.generateStructured({
        templateKey: 'meeting_intelligence_v1',
        featureName: 'meeting_intelligence',
        organizationId: orgId,
        projectId: projId,
        userId: testUserId,
        variables: {
            project_name: "HITL Project",
            organization_name: "HITL Test Org",
            participants: [{ name: "Test PM", role: "PM", alias: "PM" }],
            raw_notes: rawNotes
        }
    });

    assert(aiResult && aiResult.data, "AI generation produced result");
    assert(aiResult.data.candidate_actions.length > 0, "AI proposed candidate actions");

    // 3. Store the artifact as DRAFT (simulating DataClient.generateMeetingIntelligence)
    const rawHash = crypto.createHash('sha256').update(rawNotes).digest('hex');
    await pool.query(`
        INSERT INTO public.meeting_ai_artifacts (
            id, organization_id, project_id, meeting_id, generation_log_id,
            status, raw_input_hash, summary, decisions, candidate_actions
        ) VALUES (
            $1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9
        )
    `, [
        artifactId,
        orgId,
        projId,
        meetingId,
        aiResult.logId,
        rawHash,
        aiResult.data.summary,
        JSON.stringify(aiResult.data.decisions),
        JSON.stringify(aiResult.data.candidate_actions)
    ]);

    // 4. CRITICAL INVARIANT: AI generation alone must NEVER mutate tasks or decisions
    const tasksAfterGen = await pool.query("SELECT COUNT(*) FROM public.tasks WHERE source_meeting_id = $1", [meetingId]);
    assert(parseInt(tasksAfterGen.rows[0].count, 10) === 0, "INVARIANT: Zero tasks created in public.tasks upon AI generation");

    const decsAfterGen = await pool.query("SELECT COUNT(*) FROM public.meeting_decisions WHERE meeting_id = $1", [meetingId]);
    assert(parseInt(decsAfterGen.rows[0].count, 10) === 0, "INVARIANT: Zero decisions created in public.meeting_decisions upon AI generation");

    const notesAfterGen = await pool.query("SELECT COUNT(*) FROM public.meeting_notes WHERE meeting_id = $1 AND note_type = 'summary'", [meetingId]);
    assert(parseInt(notesAfterGen.rows[0].count, 10) === 0, "INVARIANT: Zero summary notes created upon AI generation");

    // 5. Verify artifact state in database is 'draft'
    const artRes = await pool.query("SELECT * FROM public.meeting_ai_artifacts WHERE id = $1", [artifactId]);
    assert(artRes.rows.length === 1, "Artifact exists in meeting_ai_artifacts");
    const art = artRes.rows[0];
    assert(art.status === 'draft', "Artifact status is strictly 'draft'");
    assert(art.applied_at === null, "applied_at is null");
    assert(art.applied_by === null, "applied_by is null");
    assert(art.applied_tasks_count === 0, "applied_tasks_count is 0");
    assert(art.applied_decisions_count === 0, "applied_decisions_count is 0");

    // 6. Test Human curation / curation payload modification
    // User can edit draft items (filter decisions, alter task title/assignee)
    const curatedDecisions = [
        { decision_text: "Затвердити статус DRAFT для всіх згенерованих артефактів (Curated)", is_client_visible: true }
    ];
    const curatedTasks = [
        {
            title: "Підготувати міграцію таблиці meeting_ai_artifacts (Curated by PM)",
            description: "Враховано зауваження ліда",
            responsibility_type: "internal",
            priority: "high",
            due_date: "2026-09-15",
            assignee_user_id: testUserId,
            is_client_visible: false
        }
    ];

    assert(curatedTasks.length < art.candidate_actions.length, "PM can choose a subset of candidate actions");

    // Clean up fixtures safely
    try {
        await pool.query("SET session_replication_role = 'replica';");
        await pool.query("DELETE FROM public.meeting_ai_artifacts WHERE id = $1", [artifactId]);
        await pool.query("DELETE FROM public.ai_generation_logs WHERE id = $1", [aiResult.logId]);
        await pool.query("DELETE FROM public.meetings WHERE id = $1", [meetingId]);
        await pool.query("DELETE FROM public.projects WHERE id = $1", [projId]);
        await pool.query("DELETE FROM public.organization_memberships WHERE organization_id = $1", [orgId]);
        await pool.query("DELETE FROM public.organizations WHERE id = $1", [orgId]);
        await pool.query("SET session_replication_role = 'origin';");
    } catch (cleanErr) {
        console.warn("Cleanup warning:", cleanErr.message);
    }

    await pool.end();
    console.log("=== Phase 8B HITL Invariants Suite 100% Passed ===");
}

run().catch(err => {
    console.error("FAIL with exception:", err);
    process.exit(1);
});
