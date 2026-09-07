// scratch/test_phase7b_markdown_parser.js
// Tests Phase 7B: MarkdownV2 Parser, Reserved Character Escaping, Message Formatting & SSRF Host Guard

const {
    escapeTelegramMarkdownV2,
    formatTelegramMessage,
    validateTelegramApiEndpoint
} = require('../js/portal/api/dispatcher-core.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`PASS: ${message}`);
    } else {
        failed++;
        console.error(`FAIL: ${message}`);
    }
}

async function run() {
    console.log('--- Phase 7B: MarkdownV2 Parser, Formatter & SSRF Guard Suite ---');

    // 1. Test escaping all 18 MarkdownV2 reserved characters
    const allReservedChars = '_*[]()~`>#+-=|{}.!\\';
    const escapedReserved = escapeTelegramMarkdownV2(allReservedChars);
    const expectedEscaped = '\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!\\\\';
    assert(escapedReserved === expectedEscaped, 'escapeTelegramMarkdownV2 escapes all 18 reserved characters strictly');

    // 2. Test nil / empty input handling
    assert(escapeTelegramMarkdownV2(null) === '', 'null safely returns empty string');
    assert(escapeTelegramMarkdownV2(undefined) === '', 'undefined safely returns empty string');
    assert(escapeTelegramMarkdownV2(12345) === '12345', 'numbers are stringified without error');

    // 3. Test canonical event format: task.completed
    const taskEvent = {
        id: '11111111-2222-3333-4444-555555555555',
        event_type: 'task.completed',
        created_at: new Date('2026-09-07T12:00:00Z'),
        organization_id: 'org-123',
        project_id: 'proj-456',
        payload_json: {
            task_id: 't-1',
            title: 'Fix issue #42 [urgent] - high priority!',
            project_title: 'Billing & Accounting (Q3)',
            organization_name: 'Demo Client Corp',
            responsibility_type: 'internal',
            assignee_name: 'John Doe <dev>'
        }
    };
    const taskMsg = formatTelegramMessage(taskEvent);
    assert(taskMsg.includes('🎯 Завдання виконано'), 'task.completed message includes localized header');
    assert(taskMsg.includes('Fix issue \\#42 \\[urgent\\] \\- high priority\\!'), 'Task title with symbols is strictly escaped in message');
    assert(taskMsg.includes('Billing & Accounting \\(Q3\\)'), 'Project title symbols are escaped');
    assert(taskMsg.includes('*Організація:* Demo Client Corp'), 'Organization name is present and properly formatted');
    assert(taskMsg.includes('*Зона відповідальності:* internal'), 'Responsibility zone is present when provided');
    assert(taskMsg.includes('_Час:_'), 'Timestamp is present in message');

    // 4. Test stage.completed format
    const stageEvent = {
        id: '22222222-3333-4444-5555-666666666666',
        event_type: 'stage.completed',
        created_at: new Date('2026-09-07T12:00:00Z'),
        organization_id: 'org-123',
        payload_json: {
            stage_name: 'Design & Prototyping (v1.0)',
            project_name: 'Core System',
            organization_name: 'Demo Client Corp'
        }
    };
    const stageMsg = formatTelegramMessage(stageEvent);
    assert(stageMsg.includes('🏁 Етап завершено'), 'stage.completed includes localized header');
    assert(stageMsg.includes('Design & Prototyping \\(v1\\.0\\)'), 'Stage name symbols escaped');
    assert(stageMsg.includes('*Організація:* Demo Client Corp'), 'Stage completed message includes organization');

    // 5. Test document.approved format
    const docEvent = {
        id: '33333333-4444-5555-6666-777777777777',
        event_type: 'document.approved',
        created_at: new Date('2026-09-07T12:00:00Z'),
        organization_id: 'org-123',
        payload_json: {
            document_title: 'Contract_2026_Final.pdf',
            project_name: 'Legal Alpha',
            organization_name: 'Demo Client Corp'
        }
    };
    const docMsg = formatTelegramMessage(docEvent);
    assert(docMsg.includes('📄 Документ погоджено'), 'document.approved includes localized header');
    assert(docMsg.includes('Contract\\_2026\\_Final\\.pdf'), 'Document title symbols escaped');
    assert(docMsg.includes('*Організація:* Demo Client Corp'), 'Document approved message includes organization');

    // 6. Test client_action.completed format
    const actionEvent = {
        id: '44444444-5555-6666-7777-888888888888',
        event_type: 'client_action.completed',
        created_at: new Date('2026-09-07T12:00:00Z'),
        organization_id: 'org-123',
        payload_json: {
            action_title: 'Approved Scope & Budget [Signed]',
            project_name: 'Onboarding 2026',
            organization_name: 'Demo Client Corp'
        }
    };
    const actionMsg = formatTelegramMessage(actionEvent);
    assert(actionMsg.includes('⚡ Дію клієнта виконано'), 'client_action.completed includes localized header');
    assert(actionMsg.includes('Approved Scope & Budget \\[Signed\\]'), 'Action title symbols escaped');
    assert(actionMsg.includes('*Організація:* Demo Client Corp'), 'Client action completed message includes organization');

    // 7. SSRF and Destination URL Validator tests
    const validTgUrl = 'https://api.telegram.org/bot123456789:ABCdefGHI/sendMessage';
    assert(validateTelegramApiEndpoint(validTgUrl).valid === true, 'Canonical api.telegram.org HTTPS endpoint is valid');

    // Reject HTTP protocol
    assert(
        validateTelegramApiEndpoint('http://api.telegram.org/bot123/sendMessage').valid === false,
        'Plain HTTP rejected by SSRF guard'
    );

    // Reject non-telegram host (evil domain / DNS rebinding / internal host)
    assert(
        validateTelegramApiEndpoint('https://evil.telegram.org/bot123/sendMessage').valid === false,
        'Subdomain / spoofed host rejected'
    );
    assert(
        validateTelegramApiEndpoint('https://api.telegram.org.evil.com/bot123/sendMessage').valid === false,
        'Domain suffix spoofing rejected'
    );
    assert(
        validateTelegramApiEndpoint('https://127.0.0.1/bot123/sendMessage').valid === false,
        'Loopback IP rejected'
    );
    assert(
        validateTelegramApiEndpoint('https://169.254.169.254/bot123/sendMessage').valid === false,
        'Cloud metadata IP rejected'
    );
    assert(
        validateTelegramApiEndpoint('https://api.telegram.org:8443/bot123/sendMessage').valid === false,
        'Non-standard port rejected'
    );

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
