// scratch/test_phase7a_ssrf_and_network.js
// Tests Phase 7A: SSRF, DNS-Rebinding, IP Range Defense, and HTTP Redirect Rejection

const http = require('http');
const { validateDestinationUrl, isForbiddenIp } = require('../js/portal/api/dispatcher-core.js');

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
    console.log('--- Suite 5: Phase 7A SSRF, DNS-Rebinding & Redirect Defense ---');

    // 1. IP Range Classifier Tests (isForbiddenIp)
    // Loopback ranges
    assert(isForbiddenIp('127.0.0.1'), '127.0.0.1 is classified as forbidden (Loopback)');
    assert(isForbiddenIp('127.0.1.5'), '127.0.1.5 is classified as forbidden (Loopback)');
    assert(isForbiddenIp('127.255.255.255'), '127.255.255.255 is classified as forbidden (Loopback)');
    assert(isForbiddenIp('::1'), '::1 is classified as forbidden (IPv6 Loopback)');

    // RFC1918 Private ranges
    assert(isForbiddenIp('10.0.0.1'), '10.0.0.1 is classified as forbidden (10.0.0.0/8)');
    assert(isForbiddenIp('10.254.1.9'), '10.254.1.9 is classified as forbidden (10.0.0.0/8)');
    assert(isForbiddenIp('172.16.0.1'), '172.16.0.1 is classified as forbidden (172.16.0.0/12)');
    assert(isForbiddenIp('172.31.255.254'), '172.31.255.254 is classified as forbidden (172.16.0.0/12)');
    assert(isForbiddenIp('192.168.0.1'), '192.168.0.1 is classified as forbidden (192.168.0.0/16)');
    assert(isForbiddenIp('192.168.100.50'), '192.168.100.50 is classified as forbidden (192.168.0.0/16)');

    // Cloud Metadata & Link-Local (Explicitly 169.254.169.254)
    assert(isForbiddenIp('169.254.169.254'), '169.254.169.254 (Cloud Metadata Service) is strictly blocked');
    assert(isForbiddenIp('169.254.1.1'), '169.254.1.1 is classified as forbidden (Link-Local)');
    assert(isForbiddenIp('fe80::1'), 'fe80::1 is classified as forbidden (IPv6 Link-Local)');

    // Non-routable, multicast & broadcast
    assert(isForbiddenIp('0.0.0.0'), '0.0.0.0 is classified as forbidden');
    assert(isForbiddenIp('100.64.0.1'), '100.64.0.1 is classified as forbidden (Carrier NAT 100.64.0.0/10)');
    assert(isForbiddenIp('198.18.0.1'), '198.18.0.1 is classified as forbidden (198.18.0.0/15)');
    assert(isForbiddenIp('224.0.0.1'), '224.0.0.1 is classified as forbidden (Multicast)');
    assert(isForbiddenIp('240.0.0.1'), '240.0.0.1 is classified as forbidden (Reserved)');
    assert(isForbiddenIp('255.255.255.255'), '255.255.255.255 is classified as forbidden (Broadcast)');

    // IPv6 ULA & IPv4-mapped IPv6
    assert(isForbiddenIp('fc00::1'), 'fc00::1 is classified as forbidden (IPv6 Unique Local fc00::/7)');
    assert(isForbiddenIp('fd12:3456::1'), 'fd12:3456::1 is classified as forbidden (IPv6 Unique Local)');
    assert(isForbiddenIp('::ffff:127.0.0.1'), '::ffff:127.0.0.1 is classified as forbidden (IPv4-mapped Loopback)');
    assert(isForbiddenIp('::ffff:169.254.169.254'), '::ffff:169.254.169.254 is classified as forbidden (IPv4-mapped Metadata)');

    // Valid public IP addresses (must NOT be forbidden)
    assert(!isForbiddenIp('8.8.8.8'), '8.8.8.8 is permitted (Public DNS)');
    assert(!isForbiddenIp('1.1.1.1'), '1.1.1.1 is permitted (Cloudflare Public)');
    assert(!isForbiddenIp('142.250.180.206'), '142.250.180.206 is permitted (Google Public)');

    // 2. URL Syntax & Userinfo Validation (validateDestinationUrl)
    const userinfoCheck1 = await validateDestinationUrl('https://admin:password@api.example.com/webhook');
    assert(!userinfoCheck1.valid, 'Target URL with userinfo (user:pass@) is rejected');
    assert(userinfoCheck1.reason === 'url_userinfo_forbidden', 'Userinfo failure reason reported accurately');

    const userinfoCheck2 = await validateDestinationUrl('https://token@api.example.com/webhook');
    assert(!userinfoCheck2.valid, 'Target URL with username-only (token@) is rejected');
    assert(userinfoCheck2.reason === 'url_userinfo_forbidden', 'Username-only failure reason reported accurately');

    // Protocol check
    const protoCheck = await validateDestinationUrl('ftp://api.example.com/webhook');
    assert(!protoCheck.valid, 'Non-HTTP protocol (ftp://) is rejected');

    const httpCheck = await validateDestinationUrl('http://remote-insecure.example.com/webhook', { allowHttp: false });
    assert(!httpCheck.valid, 'Plain HTTP target URL is rejected in production mode (requires HTTPS)');
    assert(httpCheck.reason === 'https_required', 'Protocol failure specifies https_required');

    // Direct Forbidden IP Target URLs
    const metadataUrlCheck = await validateDestinationUrl('https://169.254.169.254/latest/meta-data');
    assert(!metadataUrlCheck.valid, 'Target URL pointing directly to 169.254.169.254 is rejected');
    assert(metadataUrlCheck.reason === 'forbidden_ip_address', 'Direct metadata IP rejection reason reported');

    const loopbackUrlCheck = await validateDestinationUrl('https://127.0.0.1:8443/webhook');
    assert(!loopbackUrlCheck.valid, 'Target URL pointing to loopback 127.0.0.1 is rejected');

    const privateUrlCheck = await validateDestinationUrl('https://10.0.5.10/webhook');
    assert(!privateUrlCheck.valid, 'Target URL pointing to RFC1918 10.0.5.10 is rejected');

    // 3. HTTP 3xx Redirect Rejection Test
    // Spin up a local mock redirect server
    const redirectServer = http.createServer((req, res) => {
        if (req.url === '/redirect-target') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, leaked: true }));
        } else {
            // Send 302 redirect
            res.writeHead(302, { 'Location': 'http://127.0.0.1:' + redirectServer.address().port + '/redirect-target' });
            res.end();
        }
    });

    await new Promise(resolve => redirectServer.listen(0, '127.0.0.1', resolve));
    const port = redirectServer.address().port;

    try {
        // Fetch with redirect: 'manual' (the dispatcher invariant)
        const redirectUrl = `http://127.0.0.1:${port}/initial-webhook`;
        let redirectFollowed = false;
        let responseStatus = 0;

        const resp = await fetch(redirectUrl, {
            method: 'POST',
            redirect: 'manual',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: true })
        });

        responseStatus = resp.status;
        if (resp.status === 200) {
            redirectFollowed = true;
        }

        assert(!redirectFollowed, 'HTTP redirect was NOT followed by dispatcher fetch (redirect: manual)');
        assert(responseStatus === 302, 'Received exact 302 redirect status code without following Location');
    } finally {
        await new Promise(resolve => redirectServer.close(resolve));
    }

    console.log(`\nSuite 5 Summary: Passed ${passed}, Failed ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
}

run();
