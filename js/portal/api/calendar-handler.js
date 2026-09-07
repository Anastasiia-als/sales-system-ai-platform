/* js/portal/api/calendar-handler.js - iCalendar Feed HTTP Endpoint Handler
 * Phase 7C: Calendar Read-Only Feed (RFC 5545)
 *
 * Responsibilities:
 * 1. Handles GET/HEAD /api/calendar/feed/:token[.ics]
 * 2. Validates 256-bit hex token format (400 on malformed)
 * 3. Hashes token with SHA-256 (strictly 0 raw tokens stored/queried in plaintext)
 * 4. Invokes get_calendar_feed_data_by_hash RPC via postgres pool
 * 5. Handles membership revocation / deactivation (returns 404)
 * 6. Generates RFC 5545 compliant VCALENDAR via generateICalFeed
 * 7. Enforces ETag / If-None-Match conditional request caching (HTTP 304 Not Modified)
 * 8. Asynchronously logs last_accessed_at and access_count
 */

const crypto = require('crypto');
const { generateICalFeed } = require('./calendar-feed.js');
const { getPool } = require('./dispatcher-worker.js');

const FEED_PATH_REGEX = /^\/api\/calendar\/feed\/([a-zA-Z0-9_-]+?)(\.ics)?$/;
const TOKEN_HEX_REGEX = /^[a-fA-F0-9]{64}$/;

/**
 * Handles incoming calendar feed requests.
 * Returns true if the request was handled, false if the path did not match.
 */
async function handleCalendarFeedRequest(req, res) {
    const rawPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]);

    if (!rawPath.startsWith('/api/calendar/feed/')) {
        return false;
    }

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'If-None-Match, Content-Type, Accept'
        });
        res.end();
        return true;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return true;
    }

    const match = rawPath.match(FEED_PATH_REGEX);
    if (!match) {
        res.writeHead(400, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: 'Invalid calendar feed request path' }));
        return true;
    }

    const rawToken = match[1];
    if (!TOKEN_HEX_REGEX.test(rawToken)) {
        res.writeHead(400, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: 'Invalid calendar feed token format (must be 64-character hex)' }));
        return true;
    }

    try {
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const pool = getPool();

        const queryRes = await pool.query(
            'SELECT public.get_calendar_feed_data_by_hash($1) AS data',
            [tokenHash]
        );

        const data = queryRes.rows[0]?.data;

        if (!data || !data.ok) {
            res.writeHead(404, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
                error: 'Calendar feed not found, inactive, or creator access revoked',
                code: data?.reason || 'not_found'
            }));
            return true;
        }

        const subscription = data.subscription;
        const stages = data.stages || [];
        const tasks = data.tasks || [];
        const maxUpdatedAt = data.max_updated_at;

        // Generate RFC 5545 iCalendar payload
        const feed = generateICalFeed({
            subscription,
            stages,
            tasks,
            max_updated_at: maxUpdatedAt
        });

        // Non-blocking asynchronous update of access metrics
        pool.query(
            'UPDATE public.calendar_feed_subscriptions SET last_accessed_at = now(), access_count = access_count + 1 WHERE id = $1',
            [subscription.id]
        ).catch(err => {
            console.error('[CALENDAR FEED ACCESS LOG ERROR]:', err.message);
        });

        // HTTP 304 conditional request handling
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch && (ifNoneMatch === feed.etag || ifNoneMatch === feed.etag.replace(/^W\//, ''))) {
            res.writeHead(304, {
                'ETag': feed.etag,
                'Last-Modified': feed.lastModified,
                'Cache-Control': 'private, no-cache, no-transform',
                'Access-Control-Allow-Origin': '*'
            });
            res.end();
            return true;
        }

        const filename = `${(subscription.name || 'firstwin').replace(/[^a-zA-Z0-9_-]/g, '_')}.ics`;

        res.writeHead(200, {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': `inline; filename="${filename}"`,
            'ETag': feed.etag,
            'Last-Modified': feed.lastModified,
            'Cache-Control': 'private, no-cache, no-transform',
            'Access-Control-Allow-Origin': '*'
        });

        if (req.method === 'HEAD') {
            res.end();
        } else {
            res.end(feed.content);
        }
        return true;
    } catch (err) {
        console.error('[CALENDAR FEED ERROR]:', err);
        if (!res.headersSent) {
            res.writeHead(500, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
        return true;
    }
}

module.exports = {
    handleCalendarFeedRequest,
    FEED_PATH_REGEX,
    TOKEN_HEX_REGEX
};
