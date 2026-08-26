const { Client } = require('pg');

async function testFullClientFlow() {
    const c = new Client({
        host: 'aws-0-eu-central-1.pooler.supabase.com',
        port: 5432,
        user: 'postgres.aayqydcdfxhlwizhfjun',
        password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
        database: 'postgres',
        ssl: { rejectUnauthorized: false }
    });

    await c.connect();
    const alphaUserId = '44444444-4444-4444-4444-444444444444';
    await c.query('BEGIN;');
    await c.query("SET LOCAL role = 'authenticated';");
    await c.query("SELECT set_config('request.jwt.claims', $1, true);", [
        JSON.stringify({ sub: alphaUserId, role: 'authenticated' })
    ]);

    console.log("=== 1. Client Dashboard Next Meeting & Actions ===");
    const actions = await c.query(`
        SELECT id, title, description, status, responsibility_type, is_client_visible
        FROM public.tasks
        WHERE project_id = '170d3c57-224b-4ae5-a384-0ccdf17252cc'
          AND responsibility_type = 'client'
          AND is_client_visible = true;
    `);
    console.log("Client Actions count:", actions.rows.length);

    const nextMeet = await c.query(`
        SELECT id, title, status, start_at, is_client_visible
        FROM public.meetings
        WHERE project_id = '170d3c57-224b-4ae5-a384-0ccdf17252cc'
          AND is_client_visible = true
          AND status = 'scheduled'
        ORDER BY start_at ASC LIMIT 1;
    `);
    console.log("Dashboard Next Meeting:", nextMeet.rows[0]);

    console.log("\n=== 2. Client Meetings List Query ===");
    const allMeets = await c.query(`
        SELECT id, title, status, start_at, is_client_visible
        FROM public.meetings
        WHERE project_id = '170d3c57-224b-4ae5-a384-0ccdf17252cc'
          AND is_client_visible = true
        ORDER BY start_at ASC;
    `);
    console.log("All Client-Visible Meetings count:", allMeets.rows.length);
    allMeets.rows.forEach(m => console.log(`- [${m.status}] ${m.title} at ${m.start_at}`));

    console.log("\n=== 3. Document Versions Visibility ===");
    const docVersions = await c.query(`
        SELECT id, version_number, is_client_visible, published_to_client_at
        FROM public.document_versions
        WHERE document_id = '11111111-1111-4000-a000-000000000201'
        ORDER BY version_number ASC;
    `);
    console.log("Visible Document Versions:", docVersions.rows);

    console.log("\n=== 4. Meeting Detail (Notes & Decisions) ===");
    const notes = await c.query(`
        SELECT id, note_type, body, is_client_visible
        FROM public.meeting_notes
        WHERE meeting_id = '11111111-1111-4000-a000-000000000301';
    `);
    console.log("Visible Meeting Notes:", notes.rows);

    const decisions = await c.query(`
        SELECT id, decision_text, is_client_visible
        FROM public.meeting_decisions
        WHERE meeting_id = '11111111-1111-4000-a000-000000000301';
    `);
    console.log("Visible Meeting Decisions:", decisions.rows);

    await c.query('ROLLBACK;');
    await c.end();
}

testFullClientFlow().catch(console.error);
