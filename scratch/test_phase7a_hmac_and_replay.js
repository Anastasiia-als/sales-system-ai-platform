// scratch/test_phase7a_hmac_and_replay.js
// Tests Phase 7A: Exact-Byte HMAC-SHA256 Signing, Body Mutation Rejection & Replay Window

const { signWebhookPayload, verifyWebhookSignature, REPLAY_WINDOW_SECONDS } = require('../js/portal/api/dispatcher-core.js');

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

function run() {
    console.log('--- Suite 6: Phase 7A Exact-Byte HMAC & Replay Window ---');

    const signingSecret = 'fws_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const currentEpoch = Math.floor(Date.now() / 1000);
    const timestampStr = currentEpoch.toString();

    const sampleEnvelope = {
        id: '11111111-2222-3333-4444-555555555555',
        event: 'task.completed',
        created_at: new Date().toISOString(),
        organization_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        project_id: '99999999-8888-7777-6666-555555555555',
        data: {
            task_id: '99999999-8888-7777-6666-555555555555',
            title: 'Deploy to Staging',
            status: 'done'
        }
    };

    const exactRawBody = JSON.stringify(sampleEnvelope);

    // 1. Signature Computation & Basic Verification
    const validSignatureHex = signWebhookPayload(signingSecret, timestampStr, exactRawBody);
    assert(typeof validSignatureHex === 'string' && validSignatureHex.length === 64, 'Generated HMAC-SHA256 hex signature is 64 characters');

    // Verify with exact parameters
    const verifyValid = verifyWebhookSignature({
        signingSecret,
        signatureHeader: `sha256=${validSignatureHex}`,
        timestampHeader: timestampStr,
        rawBodyString: exactRawBody,
        currentEpochSeconds: currentEpoch
    });
    assert(verifyValid.valid, 'Exact signature and raw body verification succeeds');

    // Plain hex format without sha256= prefix
    const verifyPlainHex = verifyWebhookSignature({
        signingSecret,
        signatureHeader: validSignatureHex,
        timestampHeader: timestampStr,
        rawBodyString: exactRawBody,
        currentEpochSeconds: currentEpoch
    });
    assert(verifyPlainHex.valid, 'Verification succeeds with plain hex signature');

    // 2. Exact-Byte Mutation Tests: ANY alteration MUST fail
    // Mutation 1: Added space in body
    const mutatedBodySpace = exactRawBody + ' ';
    const verifyMutatedSpace = verifyWebhookSignature({
        signingSecret,
        signatureHeader: `sha256=${validSignatureHex}`,
        timestampHeader: timestampStr,
        rawBodyString: mutatedBodySpace,
        currentEpochSeconds: currentEpoch
    });
    assert(!verifyMutatedSpace.valid, 'Trailing space in body causes signature verification failure');
    assert(verifyMutatedSpace.reason === 'signature_mismatch', 'Failure reason is signature_mismatch');

    // Mutation 2: Trailing newline
    const mutatedBodyNewline = exactRawBody + '\n';
    const verifyMutatedNewline = verifyWebhookSignature({
        signingSecret,
        signatureHeader: `sha256=${validSignatureHex}`,
        timestampHeader: timestampStr,
        rawBodyString: mutatedBodyNewline,
        currentEpochSeconds: currentEpoch
    });
    assert(!verifyMutatedNewline.valid, 'Trailing newline in body causes signature verification failure');

    // Mutation 3: Altered property value inside JSON
    const mutatedEnvelope = JSON.parse(exactRawBody);
    mutatedEnvelope.data.title = 'Deploy to Staging (tampered)';
    const mutatedBodyProperty = JSON.stringify(mutatedEnvelope);
    const verifyMutatedProperty = verifyWebhookSignature({
        signingSecret,
        signatureHeader: `sha256=${validSignatureHex}`,
        timestampHeader: timestampStr,
        rawBodyString: mutatedBodyProperty,
        currentEpochSeconds: currentEpoch
    });
    assert(!verifyMutatedProperty.valid, 'Altered payload property causes signature verification failure');

    // Mutation 4: Wrong signing secret
    const wrongSecret = 'fws_ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const verifyWrongSecret = verifyWebhookSignature({
        signingSecret: wrongSecret,
        signatureHeader: `sha256=${validSignatureHex}`,
        timestampHeader: timestampStr,
        rawBodyString: exactRawBody,
        currentEpochSeconds: currentEpoch
    });
    assert(!verifyWrongSecret.valid, 'Verification fails with wrong signing secret');

    // 3. Replay Window Tests (300 seconds)
    assert(REPLAY_WINDOW_SECONDS === 300, 'Replay window constant is strictly 300 seconds');

    // Timestamp 301 seconds in the past (expired replay)
    const expiredTimestamp = (currentEpoch - 301).toString();
    const expiredSig = signWebhookPayload(signingSecret, expiredTimestamp, exactRawBody);
    const verifyExpired = verifyWebhookSignature({
        signingSecret,
        signatureHeader: `sha256=${expiredSig}`,
        timestampHeader: expiredTimestamp,
        rawBodyString: exactRawBody,
        currentEpochSeconds: currentEpoch
    });
    assert(!verifyExpired.valid, 'Timestamp 301 seconds in the past is rejected as out-of-window');
    assert(verifyExpired.reason === 'timestamp_out_of_window', 'Rejection reason is timestamp_out_of_window');

    // Timestamp 301 seconds in future (clock skew out-of-window)
    const futureTimestamp = (currentEpoch + 301).toString();
    const futureSig = signWebhookPayload(signingSecret, futureTimestamp, exactRawBody);
    const verifyFuture = verifyWebhookSignature({
        signingSecret,
        signatureHeader: `sha256=${futureSig}`,
        timestampHeader: futureTimestamp,
        rawBodyString: exactRawBody,
        currentEpochSeconds: currentEpoch
    });
    assert(!verifyFuture.valid, 'Future timestamp beyond 300s window is rejected');
    assert(verifyFuture.reason === 'timestamp_out_of_window', 'Future timestamp rejection reason is timestamp_out_of_window');

    // Timestamp 295 seconds in the past (within window)
    const validPastTimestamp = (currentEpoch - 295).toString();
    const validPastSig = signWebhookPayload(signingSecret, validPastTimestamp, exactRawBody);
    const verifyValidPast = verifyWebhookSignature({
        signingSecret,
        signatureHeader: `sha256=${validPastSig}`,
        timestampHeader: validPastTimestamp,
        rawBodyString: exactRawBody,
        currentEpochSeconds: currentEpoch
    });
    assert(verifyValidPast.valid, 'Timestamp 295 seconds in the past is accepted (within 300s window)');

    // Timestamp 295 seconds in future (acceptable clock skew within window)
    const validFutureTimestamp = (currentEpoch + 295).toString();
    const validFutureSig = signWebhookPayload(signingSecret, validFutureTimestamp, exactRawBody);
    const verifyValidFuture = verifyWebhookSignature({
        signingSecret,
        signatureHeader: `sha256=${validFutureSig}`,
        timestampHeader: validFutureTimestamp,
        rawBodyString: exactRawBody,
        currentEpochSeconds: currentEpoch
    });
    assert(verifyValidFuture.valid, 'Future timestamp within 300s clock skew window is accepted');

    // Invalid non-numeric timestamp header
    const verifyGarbageTs = verifyWebhookSignature({
        signingSecret,
        signatureHeader: `sha256=${validSignatureHex}`,
        timestampHeader: 'invalid_not_a_number',
        rawBodyString: exactRawBody,
        currentEpochSeconds: currentEpoch
    });
    assert(!verifyGarbageTs.valid, 'Non-numeric timestamp header is rejected');
    assert(verifyGarbageTs.reason === 'invalid_timestamp_header', 'Failure reason is invalid_timestamp_header');

    console.log(`\nSuite 6 Summary: Passed ${passed}, Failed ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
}

run();
