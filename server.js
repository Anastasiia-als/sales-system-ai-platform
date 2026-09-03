const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8002;
const ROOT_DIR = fs.existsSync(path.join(__dirname, 'index.html')) ? __dirname : path.resolve(__dirname, '..');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.pdf': 'application/pdf',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.zip': 'application/zip',
    '.csv': 'text/csv; charset=utf-8'
};

const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    
    const filePath = path.join(ROOT_DIR, reqPath);
    
    if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });

        const stream = fs.createReadStream(filePath);

        // Local lifecycle: clean up stream when request/response closes or aborts (e.g. on F5 reload)
        const cleanUp = () => {
            if (!stream.destroyed) {
                stream.destroy();
            }
        };

        res.on('close', cleanUp);
        res.on('finish', cleanUp);
        req.on('aborted', cleanUp);
        req.on('close', cleanUp);

        stream.on('error', (err) => {
            if (['ERR_STREAM_PREMATURE_CLOSE', 'ECONNRESET', 'EPIPE'].includes(err.code)) {
                return;
            }
            console.error(`[STREAM ERROR ${filePath}]:`, err.message);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('500 Internal Server Error');
            }
        });

        res.on('error', (err) => {
            if (['ECONNRESET', 'EPIPE', 'ECANCELED', 'ERR_STREAM_PREMATURE_CLOSE'].includes(err.code)) {
                return;
            }
            console.error('[RESPONSE SOCKET ERROR]:', err.message);
        });

        req.on('error', (err) => {
            if (['ECONNRESET', 'EPIPE', 'ECANCELED'].includes(err.code)) {
                return;
            }
            console.error('[REQUEST SOCKET ERROR]:', err.message);
        });

        stream.pipe(res);
    });
});

server.on('error', (err) => {
    console.error('[FATAL SERVER LISTEN ERROR]:', err);
    process.exit(1);
});

// Diagnostic safety net: log loudly and exit on non-network/programming errors (NO blanket swallowing)
process.on('uncaughtException', (err) => {
    console.error('[FATAL UNCAUGHT EXCEPTION — PROCESS TERMINATING]:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('[FATAL UNHANDLED REJECTION — PROCESS TERMINATING]:', reason);
    process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`FIRSTWIN Local Platform Server running on port ${PORT}`);
    console.log(`Local URLs:`);
    console.log(`  http://localhost:${PORT}/`);
    console.log(`  http://localhost:${PORT}/#/portal/automation`);
    console.log(`  http://127.0.0.1:${PORT}/#/portal/automation`);
});


