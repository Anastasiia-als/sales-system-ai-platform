/**
 * scratch/test_phase8b_priority_grounding.js
 * Unit & Regression Suite for Phase 8B Priority Grounding & Default Contract
 */

const { AIGateway } = require('../js/portal/api/ai-gateway.js');

function assert(condition, message) {
    if (!condition) {
        console.error("FAIL: " + message);
        process.exit(1);
    }
    console.log("PASS: " + message);
}

async function run() {
    console.log("=== Phase 8B Priority Grounding Suite ===");

    const gateway = new AIGateway();

    // Scenario 1: Manual Acceptance Fixture - tasks have due dates but NO priority keywords
    console.log("\n--- Scenario 1: Tasks with due dates but NO priority keywords ---");
    const res1 = await gateway.generateStructured({
        organizationId: "e8b4f668-058f-4817-93bb-83229a18f9ec",
        projectId: "35584958-81c3-477c-b5bb-e71398bf540f",
        userId: null,
        featureName: "meeting_intelligence",
        templateKey: "meeting_intelligence_v1",
        provider: "mock",
        variables: {
            participants: [
                { name: "Анастасія Зайцева", role: "PM", alias: "Анастасія" },
                { name: "Петро Іванов", role: "Developer", alias: "Петро" }
            ],
            raw_notes: "Обговорили запуск нового етапу проєкту. Анастасія підготує технічне завдання до 15 вересня. Петро перевірить інтеграцію та надасть результат до 17 вересня. Клієнт має надати тестовий доступ до Google Calendar до 14 вересня."
        }
    });

    assert(res1.ok, "Generation 1 ok");
    const actions1 = res1.data.candidate_actions;
    assert(actions1.length === 3, `Extracted 3 actions (got ${actions1.length})`);
    for (const act of actions1) {
        assert(act.priority === "medium", `Action '${act.title}' strictly defaults to 'medium' despite having due_date '${act.due_date}' (got '${act.priority}')`);
    }

    // Scenario 2: Explicit High / Urgency keywords
    console.log("\n--- Scenario 2: Explicit High / Urgency keywords ---");
    const res2 = await gateway.generateStructured({
        organizationId: "e8b4f668-058f-4817-93bb-83229a18f9ec",
        projectId: "35584958-81c3-477c-b5bb-e71398bf540f",
        userId: null,
        featureName: "meeting_intelligence",
        templateKey: "meeting_intelligence_v1",
        provider: "mock",
        variables: {
            participants: [{ name: "Анастасія", alias: "Анастасія" }],
            raw_notes: "Анастасія підготує звіт терміново до 15 вересня. Петро виправить критичний баг в інтеграції. Олександр підготує опис задачі з високим пріоритетом."
        }
    });

    assert(res2.ok, "Generation 2 ok");
    const actions2 = res2.data.candidate_actions;
    assert(actions2.length === 3, `Extracted 3 actions with urgency (got ${actions2.length})`);
    for (const act of actions2) {
        assert(act.priority === "high", `Action '${act.title}' recognized explicit urgency keyword and set priority='high' (got '${act.priority}')`);
    }

    // Scenario 3: Explicit Low keyword
    console.log("\n--- Scenario 3: Explicit Low keyword ---");
    const res3 = await gateway.generateStructured({
        organizationId: "e8b4f668-058f-4817-93bb-83229a18f9ec",
        projectId: "35584958-81c3-477c-b5bb-e71398bf540f",
        userId: null,
        featureName: "meeting_intelligence",
        templateKey: "meeting_intelligence_v1",
        provider: "mock",
        variables: {
            participants: [{ name: "Анастасія", alias: "Анастасія" }],
            raw_notes: "Анастасія оновить другорядну документацію, пріоритет низький."
        }
    });

    assert(res3.ok, "Generation 3 ok");
    const actions3 = res3.data.candidate_actions;
    assert(actions3.length === 1, `Extracted 1 action (got ${actions3.length})`);
    assert(actions3[0].priority === "low", `Action '${actions3[0].title}' set priority='low' (got '${actions3[0].priority}')`);

    console.log("\n=== Phase 8B Priority Grounding Suite: ALL PASS ===");
}

run().catch(err => {
    console.error("Priority Suite Failed:", err);
    process.exit(1);
});
