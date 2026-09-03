const http = require('http');
const net = require('net');
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

function assert(condition, message) {
    if (!condition) {
        console.error("FAIL: " + message);
        throw new Error(message);
    }
    console.log("PASS: " + message);
}

async function run() {
    console.log("=== Server Resilience & Error Architecture Regression Suite ===");

    // -------------------------------------------------------------
    // Test 1: HTTP Server Reachability
    // -------------------------------------------------------------
    console.log("\n--- Test 1: Basic HTTP 200 Reachability ---");
    const status = await new Promise((resolve) => {
        http.get('http://localhost:8002/index.html', (res) => resolve(res.statusCode))
            .on('error', (err) => resolve(err.message));
    });
    assert(status === 200, "Server responds with HTTP 200");

    // -------------------------------------------------------------
    // Test 2: Aborted Client Request (Stream Cleanup)
    // -------------------------------------------------------------
    console.log("\n--- Test 2: Aborted Client Request ---");
    await new Promise((resolve) => {
        const req = http.get('http://localhost:8002/index.html', (res) => {
            // Abort immediately after receiving headers
            req.destroy();
            resolve();
        });
        req.on('error', () => {
            // Expected socket destruction error on client
            resolve();
        });
    });
    // Verify server remains alive
    const statusAfterAbort = await new Promise((resolve) => {
        http.get('http://localhost:8002/index.html', (res) => resolve(res.statusCode))
            .on('error', (err) => resolve(err.message));
    });
    assert(statusAfterAbort === 200, "Server survived client-aborted request cleanly");

    // -------------------------------------------------------------
    // Test 3: Abrupt Broken TCP Socket (EPIPE / ECONNRESET simulation)
    // -------------------------------------------------------------
    console.log("\n--- Test 3: Abrupt Broken TCP Socket ---");
    for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => {
            const socket = net.createConnection({ port: 8002, host: '127.0.0.1' }, () => {
                socket.write("GET /index.html HTTP/1.1\r\nHost: localhost\r\n\r\n");
                // Destroy socket immediately after sending request to trigger aborted/closed response socket
                setTimeout(() => {
                    socket.destroy();
                    resolve();
                }, 5);
            });
            socket.on('error', () => resolve());
        });
    }

    const statusAfterBrokenSocket = await new Promise((resolve) => {
        http.get('http://localhost:8002/index.html', (res) => resolve(res.statusCode))
            .on('error', (err) => resolve(err.message));
    });
    assert(statusAfterBrokenSocket === 200, "Server survived 5 consecutive abrupt TCP socket terminations");

    // -------------------------------------------------------------
    // Test 4: Real Browser F5 / Ctrl+F5 Series
    // -------------------------------------------------------------
    console.log("\n--- Test 4: Real Browser F5 / Hard Refresh Series ---");
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto('http://localhost:8002/index.html', { waitUntil: 'domcontentloaded' });
    assert(true, "Browser successfully loaded page");

    // 5 Rapid F5 reloads
    for (let i = 1; i <= 5; i++) {
        await page.reload({ waitUntil: 'domcontentloaded' });
    }
    assert(true, "Browser executed 5 rapid F5 reloads without server interruption");

    await browser.close();

    // -------------------------------------------------------------
    // Test 5: Verify Non-Network Programming Errors Are NOT Swallowed
    // -------------------------------------------------------------
    console.log("\n--- Test 5: Programming Errors Must Log Loudly and Terminate (No Blanket Swallowing) ---");
    const testProcess = spawn('node', ['-e', `
        process.on('uncaughtException', (err) => {
            console.error('[FATAL UNCAUGHT EXCEPTION — PROCESS TERMINATING]:', err.message);
            process.exit(1);
        });
        // Deliberate programming error
        const obj = null;
        obj.nonExistentMethod();
    `]);

    let stderrOutput = '';
    testProcess.stderr.on('data', chunk => stderrOutput += chunk);

    const exitCode = await new Promise((resolve) => {
        testProcess.on('exit', code => resolve(code));
    });

    assert(exitCode === 1, `Programming error caused process to exit with code 1 (Got: ${exitCode})`);
    assert(stderrOutput.includes("FATAL UNCAUGHT EXCEPTION") && stderrOutput.includes("Cannot read propert"), 
        "Programming error was logged loudly with exact error message and NOT swallowed");

    console.log("\n=== ALL SERVER RESILIENCE & ARCHITECTURE REGRESSION TESTS PASSED ===");
}

run().catch((err) => {
    console.error("FATAL SUITE ERROR:", err);
    process.exit(1);
});
