/* js/portal/api/calendar-feed.js - iCalendar (RFC 5545) Feed Generator
 * Phase 7C: Calendar Read-Only Feed Engine
 *
 * Responsibilities:
 * 1. Formats RFC 5545 compliant VCALENDAR and VEVENT payloads
 * 2. Strict line folding (max 75 octets with CRLF + space)
 * 3. Escaping of reserved characters (\\, \;, \,, \n)
 * 4. Deterministic UIDs (task-<id>@firstwin.platform, stage-<id>@firstwin.platform)
 * 5. Sequence numbers for update tracking across external calendar syncs
 * 6. ETag generation and HTTP 304 conditional request support
 */

const crypto = require('crypto');

/**
 * Formats a Date object or ISO string to RFC 5545 format.
 * - All-day: YYYYMMDD
 * - DateTime: YYYYMMDDTHHMMSSZ (UTC)
 */
function formatICalDate(dateInput, isAllDay = false) {
    if (!dateInput) return null;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;

    const pad = (n) => String(n).padStart(2, '0');

    const year = d.getUTCFullYear();
    const month = pad(d.getUTCMonth() + 1);
    const day = pad(d.getUTCDate());

    if (isAllDay) {
        return `${year}${month}${day}`;
    }

    const hours = pad(d.getUTCHours());
    const minutes = pad(d.getUTCMinutes());
    const seconds = pad(d.getUTCSeconds());

    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escapes text according to RFC 5545 section 3.3.11:
 * \ -> \\
 * ; -> \;
 * , -> \,
 * newline -> \n
 */
function escapeICalText(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Folds a single iCalendar line so that each line does not exceed 75 octets.
 * According to RFC 5545 Section 3.1, continuation lines start with a space or tab.
 */
function foldICalLine(line, maxOctets = 75) {
    if (!line) return '';

    const buf = Buffer.from(line, 'utf8');
    if (buf.length <= maxOctets) {
        return line;
    }

    const chunks = [];
    let currentOctetCount = 0;
    let currentChunk = '';

    for (const char of line) {
        const charLen = Buffer.byteLength(char, 'utf8');
        const limit = chunks.length === 0 ? maxOctets : maxOctets - 1; // 1 byte reserved for leading space

        if (currentOctetCount + charLen > limit) {
            chunks.push(currentChunk);
            currentChunk = char;
            currentOctetCount = charLen;
        } else {
            currentChunk += char;
            currentOctetCount += charLen;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks.join('\r\n ');
}

/**
 * Maps task / stage status to RFC 5545 VEVENT STATUS.
 */
function mapTaskStatusToICal(status) {
    switch (status) {
        case 'done':
        case 'completed':
            return 'COMPLETED';
        case 'in_progress':
            return 'IN-PROCESS';
        case 'blocked':
            return 'CANCELLED';
        case 'todo':
        default:
            return 'NEEDS-ACTION';
    }
}

function mapStageStatusToICal(status) {
    switch (status) {
        case 'completed':
        case 'done':
            return 'COMPLETED';
        case 'in_progress':
            return 'CONFIRMED';
        case 'blocked':
            return 'CANCELLED';
        case 'todo':
        default:
            return 'TENTATIVE';
    }
}

/**
 * Maps task priority to RFC 5545 PRIORITY (0=undefined, 1=highest, 9=lowest).
 */
function mapPriorityToICal(priority) {
    switch (priority) {
        case 'urgent': return 1;
        case 'high': return 2;
        case 'medium': return 5;
        case 'low': return 9;
        default: return 0;
    }
}

/**
 * Generates deterministic sequence number from updated_at.
 */
function getSequenceNumber(updatedAt) {
    if (!updatedAt) return 0;
    const epochSec = Math.floor(new Date(updatedAt).getTime() / 1000);
    return Math.max(0, epochSec % 1000000);
}

/**
 * Builds RFC 5545 iCalendar content for a given subscription payload.
 */
function generateICalFeed({ subscription, stages = [], tasks = [], max_updated_at = null }) {
    const rawLines = [];

    // Calendar Headers
    rawLines.push('BEGIN:VCALENDAR');
    rawLines.push('PRODID:-//FIRSTWIN Platform//Delivery Calendar 1.0//UK');
    rawLines.push('VERSION:2.0');
    rawLines.push('CALSCALE:GREGORIAN');
    rawLines.push('METHOD:PUBLISH');
    rawLines.push(`X-WR-CALNAME:${escapeICalText(subscription.name || 'FIRSTWIN Calendar')}`);
    rawLines.push('X-WR-TIMEZONE:Europe/Kyiv');
    rawLines.push('X-WR-CALDESC:Календар етапів та дедлайнів FIRSTWIN');

    const nowUtc = formatICalDate(new Date());

    // 1. Render Stages as VEVENT
    for (const s of stages) {
        if (!s.target_date && !s.start_date) continue;

        const uid = `stage-${s.id}@firstwin.platform`;
        const seq = getSequenceNumber(s.updated_at);
        const dtstamp = formatICalDate(s.updated_at) || nowUtc;
        const status = mapStageStatusToICal(s.status);

        rawLines.push('BEGIN:VEVENT');
        rawLines.push(`UID:${uid}`);
        rawLines.push(`SEQUENCE:${seq}`);
        rawLines.push(`DTSTAMP:${dtstamp}`);

        const isAllDay = !String(s.target_date || s.start_date).includes('T');
        if (s.start_date && s.target_date) {
            if (isAllDay) {
                rawLines.push(`DTSTART;VALUE=DATE:${formatICalDate(s.start_date, true)}`);
                // DTEND is exclusive for all-day events in RFC 5545
                const endDate = new Date(s.target_date);
                endDate.setUTCDate(endDate.getUTCDate() + 1);
                rawLines.push(`DTEND;VALUE=DATE:${formatICalDate(endDate, true)}`);
            } else {
                rawLines.push(`DTSTART:${formatICalDate(s.start_date)}`);
                rawLines.push(`DTEND:${formatICalDate(s.target_date)}`);
            }
        } else {
            const singleDate = s.target_date || s.start_date;
            if (isAllDay) {
                rawLines.push(`DTSTART;VALUE=DATE:${formatICalDate(singleDate, true)}`);
            } else {
                rawLines.push(`DTSTART:${formatICalDate(singleDate)}`);
            }
        }

        rawLines.push(`SUMMARY:${escapeICalText(`🏁 Етап: ${s.name}`)}`);

        const descParts = [
            s.project_name ? `Проєкт: ${s.project_name}` : null,
            `Статус: ${s.status}`,
            s.description ? `Опис: ${s.description}` : null
        ].filter(Boolean);

        if (descParts.length > 0) {
            rawLines.push(`DESCRIPTION:${escapeICalText(descParts.join('\n'))}`);
        }

        rawLines.push(`STATUS:${status}`);
        rawLines.push('CATEGORIES:Етап,FIRSTWIN');
        rawLines.push('END:VEVENT');
    }

    // 2. Render Tasks as VEVENT
    for (const t of tasks) {
        if (!t.due_date && !t.start_date) continue;

        const uid = `task-${t.id}@firstwin.platform`;
        const seq = getSequenceNumber(t.updated_at);
        const dtstamp = formatICalDate(t.updated_at) || nowUtc;
        const status = mapTaskStatusToICal(t.status);
        const priority = mapPriorityToICal(t.priority);

        rawLines.push('BEGIN:VEVENT');
        rawLines.push(`UID:${uid}`);
        rawLines.push(`SEQUENCE:${seq}`);
        rawLines.push(`DTSTAMP:${dtstamp}`);

        const isAllDay = !String(t.due_date || t.start_date).includes('T');
        if (t.start_date && t.due_date) {
            if (isAllDay) {
                rawLines.push(`DTSTART;VALUE=DATE:${formatICalDate(t.start_date, true)}`);
                const endDate = new Date(t.due_date);
                endDate.setUTCDate(endDate.getUTCDate() + 1);
                rawLines.push(`DTEND;VALUE=DATE:${formatICalDate(endDate, true)}`);
            } else {
                rawLines.push(`DTSTART:${formatICalDate(t.start_date)}`);
                rawLines.push(`DTEND:${formatICalDate(t.due_date)}`);
            }
        } else {
            const singleDate = t.due_date || t.start_date;
            if (isAllDay) {
                rawLines.push(`DTSTART;VALUE=DATE:${formatICalDate(singleDate, true)}`);
            } else {
                rawLines.push(`DTSTART:${formatICalDate(singleDate)}`);
            }
        }

        rawLines.push(`SUMMARY:${escapeICalText(`📌 ${t.title}`)}`);

        const descParts = [
            t.project_name ? `Проєкт: ${t.project_name}` : null,
            t.responsibility_type ? `Зона: ${t.responsibility_type}` : null,
            `Статус: ${t.status}`,
            t.priority ? `Пріоритет: ${t.priority}` : null,
            t.description ? `Деталі: ${t.description}` : null
        ].filter(Boolean);

        if (descParts.length > 0) {
            rawLines.push(`DESCRIPTION:${escapeICalText(descParts.join('\n'))}`);
        }

        rawLines.push(`STATUS:${status}`);
        if (priority > 0) {
            rawLines.push(`PRIORITY:${priority}`);
        }
        rawLines.push('CATEGORIES:Завдання,FIRSTWIN');
        rawLines.push('END:VEVENT');
    }

    rawLines.push('END:VCALENDAR');

    // Fold each line at 75 octets and join with standard CRLF
    const foldedContent = rawLines.map(line => foldICalLine(line, 75)).join('\r\n') + '\r\n';

    // Compute ETag
    const maxTs = max_updated_at ? new Date(max_updated_at).getTime() : new Date().getTime();
    const etagHash = crypto.createHash('md5').update(`${subscription.id}-${maxTs}-${stages.length}-${tasks.length}`).digest('hex');
    const etag = `W/"${etagHash}"`;

    return {
        content: foldedContent,
        etag: etag,
        lastModified: new Date(maxTs).toUTCString()
    };
}

module.exports = {
    formatICalDate,
    escapeICalText,
    foldICalLine,
    mapTaskStatusToICal,
    mapStageStatusToICal,
    generateICalFeed
};
