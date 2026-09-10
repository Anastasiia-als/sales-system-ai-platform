const { Pool } = require('pg');
const { AIGateway } = require('../js/portal/api/ai-gateway.js');

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
    console.log("=== Phase 8B: DLP & Participant De-Identification Test ===");

    // 1. Participant metadata for a sample meeting
    const participants = [
        { name: "Олександр Коваленко", role: "Project Manager", alias: "PM" },
        { name: "Тетяна Василенко", role: "Lead Designer", alias: "Designer" },
        { name: "Микола Сидоренко", role: "Client Representative", alias: "Client" }
    ];

    // 2. Raw notes containing real names, PII, email, phone, and tokens
    const rawNotes = `
        Зустріч по проєкту Редизайн.
        Присутні: Олександр Коваленко, Тетяна Василенко, Микола Сидоренко.
        Олександр домовився з Миколою про узгодження брифу.
        Контакт клієнта: client.director@example.com або +380501234567.
        API токен для бекапу: fwa_live_99887766554433221100aabbccddeeff.
        Тетяна Василенко надасть фінальні макети Figma в п'ятницю.
        Рішення: перенести реліз на 2 дні.
    `;

    // 3. Test de-identification directly on input string
    const deidentified = gateway.deidentifyParticipants(rawNotes, participants);
    assert(!deidentified.includes("Олександр Коваленко"), "Full name 'Олександр Коваленко' is removed");
    assert(!deidentified.includes("Тетяна Василенко"), "Full name 'Тетяна Василенко' is removed");
    assert(!deidentified.includes("Микола Сидоренко"), "Full name 'Микола Сидоренко' is removed");
    assert(!deidentified.includes("Олександр"), "First name 'Олександр' is removed");

    assert(deidentified.includes("PM"), "Alias 'PM' is present");
    assert(deidentified.includes("Designer"), "Alias 'Designer' is present");

    // 4. Test DLP sanitization
    const sanitized = gateway.sanitizeContent(rawNotes);
    assert(!sanitized.includes("client.director@example.com"), "Email is masked by DLP");
    assert(!sanitized.includes("+380501234567"), "Phone is masked by DLP");
    assert(!sanitized.includes("fwa_live_99887766554433221100aabbccddeeff"), "Token is masked by DLP");

    // 5. Test full pipeline in generateStructured (using mock transport)
    process.env.AI_MOCK_TRANSPORT = 'true';

    const ownerUserRes = await pool.query("SELECT id FROM public.profiles LIMIT 1");
    const realUserId = ownerUserRes.rows[0]?.id || null;

    const result = await gateway.generateStructured({
        templateKey: 'meeting_intelligence_v1',
        featureName: 'meeting_intelligence',
        organizationId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        userId: realUserId,
        variables: {
            project_name: "Idempotency Test",
            organization_name: "Demo Client Corp",
            participants: participants,
            raw_notes: rawNotes
        }
    });

    assert(result && result.data, "Structured result generated");
    assert(typeof result.data.summary === 'string', "Summary is present");
    assert(Array.isArray(result.data.decisions), "Decisions is array");
    assert(Array.isArray(result.data.candidate_actions), "Candidate actions is array");
    assert(result.usage && result.usage.totalTokens > 0, "Usage recorded");
    assert(result.logId, "Generation log created");

    await pool.end();
    console.log("=== Phase 8B DLP & De-identification Suite 100% Passed ===");
}

run().catch(err => {
    console.error("FAIL with exception:", err);
    process.exit(1);
});
