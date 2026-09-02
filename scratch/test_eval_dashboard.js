const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

function createStaticServer(port) {
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
    };

    const server = http.createServer((req, res) => {
        let filePath = path.join(__dirname, '..', req.url.split('?')[0]);
        if (req.url === '/' || req.url.startsWith('/#')) {
            filePath = path.join(__dirname, '..', 'index.html');
        }

        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                return res.end('404 Not Found');
            }
            const ext = path.extname(filePath).toLowerCase();
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            fs.createReadStream(filePath).pipe(res);
        });
    });

    return new Promise((resolve) => {
        server.listen(port, () => resolve(server));
    });
}

async function main() {
    let server;
    try {
        server = await createStaticServer(8002);
    } catch(e) {
        // Port already in use, assuming dev server is running
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.goto('http://localhost:8002/index.html#/portal', { waitUntil: 'networkidle0', timeout: 15000 });
        
        console.log("PASS: Loaded portal page successfully");
    } finally {
        if (browser) await browser.close();
        if (server) server.close();
    }
}

main().catch(err => {
    console.error("Dashboard eval error:", err);
    process.exit(1);
});
