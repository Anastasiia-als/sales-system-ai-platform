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

const {
    startOutboxWorker,
    stopOutboxWorker,
    processPendingOutbox,
    verifyTelegramConnection,
    setTelegramMockMode,
    getTelegramMockMode
} = require('./js/portal/api/dispatcher-worker.js');
const { handleCalendarFeedRequest } = require('./js/portal/api/calendar-handler.js');
const { AIGateway, ALLOWED_PROVIDERS, ALLOWED_MODELS } = require('./js/portal/api/ai-gateway.js');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aayqydcdfxhlwizhfjun.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_CZwi_JF1vSKX2q-9XAiojg_6TopfxZY';
const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const aiGateway = new AIGateway();

let aiMockMode = process.env.AI_MOCK_TRANSPORT === 'true';
function setAIMockMode(enabled) {
    aiMockMode = Boolean(enabled);
    if (enabled) {
        process.env.AI_MOCK_TRANSPORT = 'true';
    } else {
        delete process.env.AI_MOCK_TRANSPORT;
    }
}
function getAIMockMode() {
    return Boolean(aiMockMode || process.env.AI_MOCK_TRANSPORT === 'true');
}

async function authenticateAndAuthorizeAIRequest(req, payload) {
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('Bearer ')) {
        const err = new Error('Missing or invalid Authorization header');
        err.statusCode = 401;
        err.code = 'UNAUTHORIZED';
        throw err;
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
        const err = new Error('Empty Bearer token');
        err.statusCode = 401;
        err.code = 'UNAUTHORIZED';
        throw err;
    }

    let authUserId = null;
    let isOwner = false;

    // Check if service-role token is passed (internal trusted service calls)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
        isOwner = true;
        authUserId = null;
    } else {
        // Authoritative verification via Supabase GoTrue Auth
        const { data, error } = await authClient.auth.getUser(token);
        if (error || !data?.user) {
            const err = new Error(`Invalid or expired session token: ${error ? error.message : 'User not found'}`);
            err.statusCode = 401;
            err.code = 'UNAUTHORIZED';
            throw err;
        }
        authUserId = data.user.id;

        // Check global role from profiles
        const profileRes = await aiGateway.pool.query(
            "SELECT id, global_role FROM public.profiles WHERE id = $1",
            [authUserId]
        );
        isOwner = profileRes.rows.length > 0 && profileRes.rows[0].global_role === 'owner';
    }

    const orgId = payload.organizationId;
    if (!orgId) {
        const err = new Error('organizationId is required');
        err.statusCode = 400;
        err.code = 'BAD_REQUEST';
        throw err;
    }

    // Verify organization authorization if not platform Owner
    if (!isOwner && authUserId) {
        const memRes = await aiGateway.pool.query(
            "SELECT org_role, is_active FROM public.organization_memberships WHERE user_id = $1 AND organization_id = $2 AND is_active = true",
            [authUserId, orgId]
        );
        if (memRes.rows.length === 0 || !['owner', 'admin', 'pm'].includes(memRes.rows[0].org_role)) {
            const err = new Error('Forbidden: user is not authorized for the requested organization');
            err.statusCode = 403;
            err.code = 'FORBIDDEN';
            throw err;
        }
    }

    // Cross-tenant project isolation: verify projectId belongs strictly to organizationId
    if (payload.projectId) {
        const projRes = await aiGateway.pool.query(
            "SELECT 1 FROM public.projects WHERE id = $1 AND organization_id = $2",
            [payload.projectId, orgId]
        );
        if (projRes.rows.length === 0) {
            const err = new Error('Forbidden: project does not belong to specified organization or does not exist');
            err.statusCode = 403;
            err.code = 'FORBIDDEN';
            throw err;
        }
    }

    return { authUserId, isOwner };
}

const server = http.createServer(async (req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]);

    // Calendar Feed Endpoint (RFC 5545 iCalendar - Phase 7C)
    if (reqPath.startsWith('/api/calendar/feed/')) {
        const handled = await handleCalendarFeedRequest(req, res);
        if (handled) return;
    }

    // Telegram connection verification endpoint (Phase 7B)
    if (reqPath === '/api/telegram/verify-connection') {
        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            });
            res.end();
            return;
        }
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
            return;
        }

        let bodyStr = '';
        req.on('data', chunk => {
            bodyStr += chunk;
            if (bodyStr.length > 1e6) {
                req.destroy();
            }
        });
        req.on('end', async () => {
            try {
                const data = JSON.parse(bodyStr || '{}');
                const result = await verifyTelegramConnection({
                    bot_token: data.bot_token,
                    chat_id: data.chat_id,
                    thread_id: data.thread_id
                });
                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(result));
            } catch (err) {
                res.writeHead(400, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ ok: false, error: err.message }));
            }
        });
        return;
    }

    // Internal dispatcher trigger endpoint
    if (reqPath === '/api/dispatcher/run') {
        processPendingOutbox(20).then(result => {
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify(result));
        }).catch(err => {
            res.writeHead(500, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: err.message }));
        });
        return;
    }

    // Telegram Dispatcher mock mode toggle (for automated tests to eliminate external side effects)
    if (reqPath === '/api/dispatcher/mock-mode') {
        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end();
            return;
        }
        if (req.method === 'GET') {
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ mock: getTelegramMockMode() }));
            return;
        }
        if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
                try {
                    const data = JSON.parse(bodyStr || '{}');
                    setTelegramMockMode(Boolean(data.enabled));
                    res.writeHead(200, {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ ok: true, mock: getTelegramMockMode() }));
                } catch (err) {
                    res.writeHead(400, {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ ok: false, error: err.message }));
                }
            });
            return;
        }
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
    }


    // AI Gateway Generate Structured Endpoint (Phase 8A)
    if (reqPath === '/api/v1/ai/generate-structured') {
        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            });
            res.end();
            return;
        }
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
            return;
        }

        let bodyStr = '';
        req.on('data', chunk => {
            bodyStr += chunk;
            if (bodyStr.length > 2e6) req.destroy();
        });
        req.on('end', async () => {
            try {
                const payload = JSON.parse(bodyStr || '{}');

                // Authoritative Server-Side Identity & Context Authorization
                const { authUserId } = await authenticateAndAuthorizeAIRequest(req, payload);

                const result = await aiGateway.generateStructured({
                    organizationId: payload.organizationId,
                    projectId: payload.projectId || null,
                    userId: authUserId, // Enforce authenticated identity (ignores client-spoofed userId)
                    featureName: payload.featureName,
                    templateKey: payload.templateKey,
                    variables: payload.variables || {},
                    provider: payload.provider || (getAIMockMode() ? 'mock' : null),
                    model: payload.model || null,
                    estimatedTokens: payload.estimatedTokens || 1500
                });
                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(result));
            } catch (err) {
                const statusCode = err.statusCode || (
                    err.code === 'QUOTA_EXCEEDED' ? 429 :
                    (err.code === 'SCHEMA_VIOLATION' || err.code === 'MALFORMED_JSON') ? 422 :
                    err.code === 'UNAUTHORIZED' ? 401 :
                    err.code === 'FORBIDDEN' ? 403 :
                    (err.code === 'INVALID_PROVIDER' || err.code === 'INVALID_MODEL') ? 400 :
                    400
                );
                res.writeHead(statusCode, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({
                    ok: false,
                    error: err.message,
                    code: err.code || 'AI_ERROR',
                    quota: err.quota || null
                }));
            }
        });
        return;
    }

    // AI Mock Transport Toggle Endpoint (for automated tests / dev only)
    if (reqPath === '/api/v1/ai/mock-mode') {
        const isProduction = process.env.NODE_ENV === 'production' || req.headers['x-test-env-mode'] === 'production';
        if (isProduction) {
            res.writeHead(403, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
                ok: false,
                error: 'AI Mock Mode endpoint is disabled in production environment',
                code: 'FORBIDDEN_IN_PRODUCTION'
            }));
            return;
        }

        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end();
            return;
        }
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ mock: getAIMockMode() }));
            return;
        }
        if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
                try {
                    const data = JSON.parse(bodyStr || '{}');
                    setAIMockMode(Boolean(data.enabled));
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ ok: true, mock: getAIMockMode() }));
                } catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ ok: false, error: err.message }));
                }
            });
            return;
        }
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
    }

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

    // Start Autonomous Outbox Dispatcher Worker (Phase 7A)
    startOutboxWorker({ pollIntervalMs: 2500 });
});

process.on('SIGTERM', () => {
    stopOutboxWorker();
    process.exit(0);
});

process.on('SIGINT', () => {
    stopOutboxWorker();
    process.exit(0);
});


