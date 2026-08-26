const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.aayqydcdfxhlwizhfjun',
    password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const OWNER_ID = '27852879-0d5f-4c72-889d-69a0989302d2';
  const PM_ID = '11111111-1111-1111-1111-111111111111';
  const SPECIALIST_ID = '22222222-2222-2222-2222-222222222222';
  const ALPHA_ORG_ID = '21bb5fe2-ff1d-473a-b329-bc02b97ba069';
  const ALPHA_PROJ_ID = '170d3c57-224b-4ae5-a384-0ccdf17252cc';
  const ALPHA_DOC_ID = '11111111-1111-4000-a000-000000000201';
  const ALPHA_MEETING_ID = '11111111-1111-4000-a000-000000000301';

  console.log('--- Seeding Canonical Phase 5B Demo Notifications ---');

  // 1. Owner: Critical Overdue Task
  await client.query(`
    INSERT INTO public.notifications (
      recipient_user_id, organization_id, project_id, event_type, severity,
      title, message, entity_type, entity_id, deep_link, dedupe_key, is_read, created_at
    ) VALUES (
      $1, $2, $3, 'task_overdue', 'critical',
      'Критична прострочена задача',
      'Задачу «Підготувати звіт аналізу конверсії» прострочено на 2 дні. Необхідна увага.',
      'task', '11111111-1111-4000-a000-000000000101',
      '#/portal/projects/170d3c57-224b-4ae5-a384-0ccdf17252cc',
      'fixture:owner:task_overdue_crit:1', false, NOW() - INTERVAL '3 hours'
    ) ON CONFLICT (dedupe_key) DO UPDATE
      SET is_read = false, read_at = NULL;
  `, [OWNER_ID, ALPHA_ORG_ID, ALPHA_PROJ_ID]);

  // 2. Owner: Upcoming Meeting
  await client.query(`
    INSERT INTO public.notifications (
      recipient_user_id, organization_id, project_id, event_type, severity,
      title, message, entity_type, entity_id, deep_link, dedupe_key, is_read, created_at
    ) VALUES (
      $1, $2, $3, 'meeting_starting_soon', 'warning',
      'Зустріч розпочнеться незабаром',
      'Зустріч «Презентація результатів аудиту» з Test Org Alpha розпочнеться через 30 хв.',
      'meeting', $4,
      '#/portal/meetings/11111111-1111-4000-a000-000000000301',
      'fixture:owner:meeting_soon:1', false, NOW() - INTERVAL '1 hour'
    ) ON CONFLICT (dedupe_key) DO UPDATE
      SET is_read = false, read_at = NULL;
  `, [OWNER_ID, ALPHA_ORG_ID, ALPHA_PROJ_ID, ALPHA_MEETING_ID]);

  // 3. Owner: Approved Document
  await client.query(`
    INSERT INTO public.notifications (
      recipient_user_id, organization_id, project_id, event_type, severity,
      title, message, entity_type, entity_id, deep_link, dedupe_key, is_read, created_at
    ) VALUES (
      $1, $2, $3, 'document_approved', 'success',
      'Документ погоджено клієнтом',
      'Клієнт Test Org Alpha погодив «Звіт з аудиту продажів» (v3).',
      'document', $4,
      '#/portal/documents/11111111-1111-4000-a000-000000000201',
      'fixture:owner:doc_approved:1', false, NOW() - INTERVAL '4 hours'
    ) ON CONFLICT (dedupe_key) DO UPDATE
      SET is_read = false, read_at = NULL;
  `, [OWNER_ID, ALPHA_ORG_ID, ALPHA_PROJ_ID, ALPHA_DOC_ID]);

  // 4. Owner: Client Action
  await client.query(`
    INSERT INTO public.notifications (
      recipient_user_id, organization_id, project_id, event_type, severity,
      title, message, entity_type, entity_id, deep_link, dedupe_key, is_read, created_at
    ) VALUES (
      $1, $2, $3, 'client_action_due_soon', 'warning',
      'Очікуємо дію від клієнта',
      'Клієнт повинен підтвердити перелік KPI до кінця дня.',
      'task', '11111111-1111-4000-a000-000000000102',
      '#/portal/projects/170d3c57-224b-4ae5-a384-0ccdf17252cc',
      'fixture:owner:client_action:1', false, NOW() - INTERVAL '5 hours'
    ) ON CONFLICT (dedupe_key) DO UPDATE
      SET is_read = false, read_at = NULL;
  `, [OWNER_ID, ALPHA_ORG_ID, ALPHA_PROJ_ID]);

  // 5. Owner: Project Health Warning
  await client.query(`
    INSERT INTO public.notifications (
      recipient_user_id, organization_id, project_id, event_type, severity,
      title, message, entity_type, entity_id, deep_link, dedupe_key, is_read, created_at
    ) VALUES (
      $1, $2, '6af58a69-dbd9-43b8-b04f-68a38da1c2bb', 'project_health_changed', 'critical',
      'Проєкт у зоні ризику',
      'Проєкт «Demo Project Alpha 2 (Unassigned for Specialist)» потребує уваги PM.',
      'project', '6af58a69-dbd9-43b8-b04f-68a38da1c2bb',
      '#/portal/projects/6af58a69-dbd9-43b8-b04f-68a38da1c2bb',
      'fixture:owner:proj_health:1', false, NOW() - INTERVAL '6 hours'
    ) ON CONFLICT (dedupe_key) DO UPDATE
      SET is_read = false, read_at = NULL;
  `, [OWNER_ID, ALPHA_ORG_ID]);

  // 6. PM Tester Alpha Fixture
  await client.query(`
    INSERT INTO public.notifications (
      recipient_user_id, organization_id, project_id, event_type, severity,
      title, message, entity_type, entity_id, deep_link, dedupe_key, is_read, created_at
    ) VALUES (
      $1, $2, $3, 'responsibility_assigned', 'info',
      'Вас призначено PM проєкту',
      'Вам передано управління проєктом «Demo Project Alpha 1».',
      'project', $3,
      '#/portal/projects/170d3c57-224b-4ae5-a384-0ccdf17252cc',
      'fixture:pm:assigned:1', false, NOW() - INTERVAL '8 hours'
    ) ON CONFLICT (dedupe_key) DO UPDATE
      SET is_read = false, read_at = NULL;
  `, [PM_ID, ALPHA_ORG_ID, ALPHA_PROJ_ID]);

  // 7. Specialist Tester Alpha Fixture
  await client.query(`
    INSERT INTO public.notifications (
      recipient_user_id, organization_id, project_id, event_type, severity,
      title, message, entity_type, entity_id, deep_link, dedupe_key, is_read, created_at
    ) VALUES (
      $1, $2, $3, 'task_assigned', 'info',
      'Вам призначено задачу',
      'Нове завдання: «Провести технічний аудит CRM» у проєкті Demo Project Alpha 1.',
      'task', '11111111-1111-4000-a000-000000000101',
      '#/portal/projects/170d3c57-224b-4ae5-a384-0ccdf17252cc',
      'fixture:specialist:task:1', false, NOW() - INTERVAL '2 hours'
    ) ON CONFLICT (dedupe_key) DO UPDATE
      SET is_read = false, read_at = NULL;
  `, [SPECIALIST_ID, ALPHA_ORG_ID, ALPHA_PROJ_ID]);

  console.log('✔ Phase 5B Demo notifications seeded successfully.');
  await client.end();
}

main().catch(console.error);
