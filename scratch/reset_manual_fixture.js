const { Client } = require('pg');

const DB_CONFIG = {
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.aayqydcdfxhlwizhfjun',
    password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

async function main() {
    const c = new Client(DB_CONFIG);
    await c.connect();

    const ORG_ALPHA_ID = '21bb5fe2-ff1d-473a-b329-bc02b97ba069';
    const PROJ_ALPHA_1_ID = '170d3c57-224b-4ae5-a384-0ccdf17252cc';
    const PM_USER_ID = '11111111-1111-1111-1111-111111111111'; // PM Tester Alpha
    const CONTACT_ALPHA_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const MEET_ALPHA_VIS_ID = '11111111-1111-4000-a000-000000000301';
    const DOC_ALPHA_REVIEW_ID = '11111111-1111-4000-a000-000000000201';
    const VER_1_ID = '11111111-1111-4000-a000-000000000211';
    const VER_2_ID = '11111111-1111-4000-a000-000000000212';
    const VER_3_ID = '11111111-1111-4000-a000-000000000213';

    console.log('--- 1. Resetting Canonical Meeting & Workspace Fixtures ---');

    // 1. Update Contact Position
    await c.query(`
        UPDATE public.contacts
        SET first_name = 'Олександр', last_name = 'Коваленко', position = 'CEO / Керівник проєкту'
        WHERE id = $1;
    `, [CONTACT_ALPHA_ID]);

    // 2. Set Meeting with full Agenda
    const agendaText = `1. Огляд ключових показників поточної воронки продажів та конверсій
2. Аналіз вузьких місць у кваліфікації лідів менеджерами
3. Презентація цільової архітектури CRM та структури скриптів
4. Узгодження таймлайну впровадження та розподілу відповідальності`;

    await c.query(`
        INSERT INTO public.meetings (
            id, organization_id, project_id, title, meeting_type, status,
            start_at, end_at, timezone, location_type, meeting_url, location_text,
            agenda, organizer_user_id, is_client_visible
        ) VALUES (
            $1, $2, $3, 'Презентація результатів аудиту', 'status_sync', 'scheduled',
            '2026-08-25T11:00:00.000Z', '2026-08-25T12:00:00.000Z', 'Europe/Kyiv', 'online', 'https://meet.google.com/test-alpha', 'Google Meet (посилання додано)',
            $4, $5, TRUE
        )
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            meeting_type = EXCLUDED.meeting_type,
            status = 'scheduled',
            start_at = EXCLUDED.start_at,
            end_at = EXCLUDED.end_at,
            timezone = EXCLUDED.timezone,
            location_type = EXCLUDED.location_type,
            meeting_url = EXCLUDED.meeting_url,
            location_text = EXCLUDED.location_text,
            agenda = EXCLUDED.agenda,
            organizer_user_id = EXCLUDED.organizer_user_id,
            is_client_visible = TRUE;
    `, [MEET_ALPHA_VIS_ID, ORG_ALPHA_ID, PROJ_ALPHA_1_ID, agendaText, PM_USER_ID]);

    // 3. Participants: 1 internal team member + 1 client contact
    await c.query(`
        INSERT INTO public.meeting_participants (id, meeting_id, organization_id, project_id, participant_type, user_id, contact_id, attendance_status)
        VALUES 
            ('11111111-1111-4000-a000-000000000341', $1, $2, $3, 'user', $4, NULL, 'confirmed'),
            ('11111111-1111-4000-a000-000000000342', $1, $2, $3, 'contact', NULL, $5, 'confirmed')
        ON CONFLICT (id) DO UPDATE SET
            participant_type = EXCLUDED.participant_type,
            user_id = EXCLUDED.user_id,
            contact_id = EXCLUDED.contact_id,
            attendance_status = EXCLUDED.attendance_status;
    `, [MEET_ALPHA_VIS_ID, ORG_ALPHA_ID, PROJ_ALPHA_1_ID, PM_USER_ID, CONTACT_ALPHA_ID]);

    // 4. Meeting Notes: 1 client-visible + 1 internal (strictly hidden)
    await c.query(`
        INSERT INTO public.meeting_notes (id, meeting_id, organization_id, project_id, note_type, body, is_client_visible)
        VALUES 
            ('11111111-1111-4000-a000-000000000311', $1, $2, $3, 'general', 'За результатами аналізу аудиту підтверджено потребу автоматизації розподілу лідів. Команда FIRSTWIN підготувала фінальний звіт із погодженими рекомендаціями.', TRUE),
            ('11111111-1111-4000-a000-000000000312', $1, $2, $3, 'internal', '[Внутрішньо FIRSTWIN] Клієнт просив прискорити делівері на 3 дні. Врахувати при плануванні наступного спринту.', FALSE)
        ON CONFLICT (id) DO UPDATE SET
            note_type = EXCLUDED.note_type,
            body = EXCLUDED.body,
            is_client_visible = EXCLUDED.is_client_visible;
    `, [MEET_ALPHA_VIS_ID, ORG_ALPHA_ID, PROJ_ALPHA_1_ID]);

    // 5. Meeting Decisions: 1 client-visible + 1 internal (strictly hidden)
    await c.query(`
        INSERT INTO public.meeting_decisions (id, meeting_id, organization_id, project_id, decision_text, sort_order, is_client_visible)
        VALUES 
            ('11111111-1111-4000-a000-000000000321', $1, $2, $3, 'Погодити план переходу на нову CRM-систему до 15 вересня 2026 року.', 1, TRUE),
            ('11111111-1111-4000-a000-000000000322', $1, $2, $3, '[Внутрішньо] Залучити додаткового інтегратора на фазу налаштування вебхуків.', 2, FALSE)
        ON CONFLICT (id) DO UPDATE SET
            decision_text = EXCLUDED.decision_text,
            sort_order = EXCLUDED.sort_order,
            is_client_visible = EXCLUDED.is_client_visible;
    `, [MEET_ALPHA_VIS_ID, ORG_ALPHA_ID, PROJ_ALPHA_1_ID]);

    // 6. Attached Document
    await c.query(`
        INSERT INTO public.meeting_documents (id, meeting_id, document_id, organization_id, project_id, relation_type)
        VALUES ('11111111-1111-4000-a000-000000000331', $1, $2, $3, $4, 'presentation')
        ON CONFLICT (id) DO UPDATE SET
            meeting_id = EXCLUDED.meeting_id,
            document_id = EXCLUDED.document_id,
            relation_type = EXCLUDED.relation_type;
    `, [MEET_ALPHA_VIS_ID, DOC_ALPHA_REVIEW_ID, ORG_ALPHA_ID, PROJ_ALPHA_1_ID]);

    // 7. Document & Version Clean Filenames
    await c.query(`
        UPDATE public.documents
        SET title = 'Звіт з аудиту продажів',
            status = 'client_review',
            category = 'Аудит',
            is_client_visible = TRUE,
            internal_access_scope = 'project_team',
            updated_at = NOW()
        WHERE id = $1;
    `, [DOC_ALPHA_REVIEW_ID]);

    await c.query(`
        INSERT INTO public.document_versions (
            id, document_id, organization_id, project_id, version_number,
            storage_path, original_filename, mime_type, size_bytes, is_client_visible, published_to_client_at
        ) VALUES 
            ($1, $4, $5, $6, 1, 'docs/zvit_audyt_prodazhiv_v1.pdf', 'Zvit_Audyt_Prodazhiv_v1.pdf', 'application/pdf', 102400, TRUE, NOW() - INTERVAL '2 days'),
            ($2, $4, $5, $6, 2, 'docs/zvit_audyt_prodazhiv_v2_internal.pdf', 'Zvit_Audyt_Prodazhiv_v2_internal.pdf', 'application/pdf', 105400, FALSE, NULL),
            ($3, $4, $5, $6, 3, 'docs/zvit_audyt_prodazhiv_v3_final.pdf', 'Zvit_Audyt_Prodazhiv_v3_Final.pdf', 'application/pdf', 110200, TRUE, NOW() - INTERVAL '1 hour')
        ON CONFLICT (id) DO UPDATE SET
            storage_path = EXCLUDED.storage_path,
            original_filename = EXCLUDED.original_filename,
            is_client_visible = EXCLUDED.is_client_visible,
            published_to_client_at = EXCLUDED.published_to_client_at;
    `, [VER_1_ID, VER_2_ID, VER_3_ID, DOC_ALPHA_REVIEW_ID, ORG_ALPHA_ID, PROJ_ALPHA_1_ID]);

    // 8. Client Action linked to meeting
    await c.query(`
        INSERT INTO public.tasks (
            id, organization_id, project_id, title, description, status, priority,
            responsibility_type, client_contact_id, is_client_visible, source_meeting_id, due_date
        ) VALUES (
            '11111111-1111-4000-a000-000000000101', $1, $2, 'Надати доступ до CRM для інтеграції',
            'Надати права адміністратора для налаштування воронок та полів', 'todo', 'high',
            'client', $3, TRUE, $4, '2026-08-28'
        )
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            status = 'todo',
            source_meeting_id = EXCLUDED.source_meeting_id,
            is_client_visible = TRUE,
            due_date = EXCLUDED.due_date;
    `, [ORG_ALPHA_ID, PROJ_ALPHA_1_ID, CONTACT_ALPHA_ID, MEET_ALPHA_VIS_ID]);

    console.log("✔ Canonical Meeting & Workspace fixtures applied successfully.");
    await c.end();
}

main().catch(console.error);
