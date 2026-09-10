-- =============================================================================
-- Migration: 20260910000035_phase8b_grounded_notes_extraction.sql
-- Description: Update meeting_intelligence_v1 prompt template for strict grounding
-- and discard stale test draft artifacts.
-- =============================================================================

-- 1. Discard stale draft artifacts from manual testing
UPDATE public.meeting_ai_artifacts
SET status = 'discarded',
    updated_at = NOW()
WHERE status = 'draft' AND summary LIKE '%Source Template E2E%';

-- 2. Update meeting_intelligence_v1 template in public.ai_prompt_templates
UPDATE public.ai_prompt_templates
SET system_prompt = 'Ти — досвідчений PM та технічний секретар делівері-платформи FIRSTWIN. Твоє завдання — проаналізувати сирі нотатки або транскрипт зустрічі та сформувати структурований протокол.

СУВОРІ ПРАВИЛА ЗАЗЕМЛЕННЯ (GROUNDING & ZERO-HALLUCINATION):
1. Працюй ВИКЛЮЧНО з фактами, наведеними у нотатках зустрічі. КАТЕГОРИЧНО ЗАБОРОНЕНО вигадувати, додумувати чи додавати будь-які рішення або завдання, яких немає в тексті джерела.
2. summary: Резюмуй виключно теми, які реально обговорювалися в нотатках. Не додавай сторонніх шаблонів проєктів чи абстрактних статусів.
3. decisions: Витягуй виключно реальні рішення, зафіксовані учасниками зустрічі. Якщо рішень не зафіксовано, повертай порожній масив [].
4. candidate_actions: Для кожної конкретної дії витягуй:
   - title: Чітка назва завдання в інфінітиві (наприклад, "Підготувати технічне завдання").
   - description: Детальний опис завдання на основі контексту з нотаток.
   - responsibility: Зона відповідальності ("internal" для команди розробки/делівері або "client" для замовника/клієнта).
   - priority: Орієнтовний пріоритет ("low", "medium", "high").
   - due_date: Точний дедлайн у форматі YYYY-MM-DD (якщо вказано в тексті; якщо не вказано — null).
   - assignee_name: Ім''я або роль особи, якій доручено завдання (якщо вказано; якщо не вказано — null).

Відповідай виключно у форматі JSON згідно з наданою схемою. Жодного тексту до або після JSON.',
    user_prompt_template = 'Нотатки зустрічі:
{{raw_notes}}',
    expected_schema = '{
        "type": "object",
        "required": ["summary", "decisions", "candidate_actions"],
        "properties": {
            "summary": { "type": "string" },
            "decisions": {
                "type": "array",
                "items": { "type": "string" }
            },
            "candidate_actions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["title", "description", "responsibility", "priority"],
                    "properties": {
                        "title": { "type": "string" },
                        "description": { "type": "string" },
                        "responsibility": { "type": "string", "enum": ["internal", "client"] },
                        "priority": { "type": "string", "enum": ["low", "medium", "high"] },
                        "due_date": { "type": ["string", "null"] },
                        "assignee_name": { "type": ["string", "null"] }
                    }
                }
            }
        }
    }'::jsonb,
    updated_at = NOW()
WHERE template_key = 'meeting_intelligence_v1';
