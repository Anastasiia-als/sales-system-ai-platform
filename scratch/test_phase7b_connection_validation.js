// scratch/test_phase7b_connection_validation.js
// Tests Phase 7B: Telegram Connection Verification Server API & Zero-Leakage Guard

const http = require('http');
const { verifyTelegramConnection } = require('../js/portal/api/dispatcher-worker.js');

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
    console.log('--- Phase 7B: Telegram Connection Verification & Server API Suite ---');

    // 1. Validation of empty / missing parameters
    const emptyTokenRes = await verifyTelegramConnection({ bot_token: '', chat_id: '-100123' });
    assert(emptyTokenRes.ok === false && emptyTokenRes.reason === 'missing_token', 'Missing bot token rejected with missing_token reason');

    const emptyChatRes = await verifyTelegramConnection({ bot_token: '12345:ABC', chat_id: '' });
    assert(emptyChatRes.ok === false && emptyChatRes.reason === 'missing_chat_id', 'Missing chat ID rejected with missing_chat_id reason');

    // 2. Validation with invalid / dummy bot token (Telegram API getMe failure)
    const invalidToken = '111111111:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const fakeChat = '-1009999999999';
    const invalidTokenRes = await verifyTelegramConnection({ bot_token: invalidToken, chat_id: fakeChat });
    assert(invalidTokenRes.ok === false, 'Invalid Telegram token fails verification');
    assert(
        !JSON.stringify(invalidTokenRes).includes(invalidToken),
        'Failed verification response NEVER leaks the input bot token'
    );

    // 3. Test HTTP endpoint routing against running server on port 8002
    // 3A. Method Not Allowed (GET)
    const getRes = await new Promise((resolve) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: 8002,
            path: '/api/telegram/verify-connection',
            method: 'GET'
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', (e) => resolve({ error: e.message }));
        req.end();
    });
    assert(getRes.status === 405, 'GET /api/telegram/verify-connection returns HTTP 405 Method Not Allowed');

    // 3B. Valid POST with missing token
    const postRes = await new Promise((resolve) => {
        const payload = JSON.stringify({ bot_token: '', chat_id: '-100123' });
        const req = http.request({
            hostname: '127.0.0.1',
            port: 8002,
            path: '/api/telegram/verify-connection',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, json: JSON.parse(data) });
                } catch (_) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });
        req.on('error', (e) => resolve({ error: e.message }));
        req.write(payload);
        req.end();
    });
    assert(postRes.status === 200 && postRes.json?.ok === false && postRes.json?.reason === 'missing_token',
        'POST /api/telegram/verify-connection validates request via server route'
    );

    // 3C. Zero leakage over HTTP
    const testSecret = '999999999:SPECIAL_SECRET_KEY_CHECK_FOR_HTTP_LEAK';
    const httpLeakTest = await new Promise((resolve) => {
        const payload = JSON.stringify({ bot_token: testSecret, chat_id: '-1009999999999' });
        const req = http.request({
            hostname: '127.0.0.1',
            port: 8002,
            path: '/api/telegram/verify-connection',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', (e) => resolve({ error: e.message }));
        req.write(payload);
        req.end();
    });
    assert(!httpLeakTest.body.includes(testSecret), 'HTTP response body NEVER reflects or leaks bot token');

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
