const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    const taskId = '02f8e8b7-83d1-49af-9e18-3c3206505482';

    const taskRes = await pool.query("SELECT id, title, status, responsibility_type, completed_at, updated_at FROM public.tasks WHERE id = $1", [taskId]);
    console.log("=== Task Record ===");
    console.log(taskRes.rows[0]);

    const tokenRes = await pool.query("SELECT id, task_id, status, created_at, used_at, expires_at, token_hash FROM public.client_action_tokens WHERE task_id = $1", [taskId]);
    console.log("\n=== Token Record ===");
    console.log(tokenRes.rows[0]);

    const subsRes = await pool.query("SELECT id, task_id, submission_type, payload, attachments, created_at FROM public.task_submissions WHERE task_id = $1", [taskId]);
    console.log("\n=== Submissions Records (Count: " + subsRes.rows.length + ") ===");
    console.log(subsRes.rows);

    const eventsRes = await pool.query("SELECT id, trigger_event, evaluated_at, result FROM public.automation_execution_events WHERE rule_id IN (SELECT id FROM public.automation_rules WHERE project_id = (SELECT project_id FROM public.tasks WHERE id = $1))", [taskId]);
    console.log("\n=== Automation Events (Count: " + eventsRes.rows.length + ") ===");
    console.log(eventsRes.rows);

    const notifsRes = await pool.query("SELECT id, recipient_user_id, title, is_read, created_at FROM public.notifications WHERE metadata->>'task_id' = $1", [taskId]);
    console.log("\n=== Notifications (Count: " + notifsRes.rows.length + ") ===");
    console.log(notifsRes.rows);

    await pool.end();
}

run();
