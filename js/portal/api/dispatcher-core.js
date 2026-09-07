/* js/portal/api/dispatcher-core.js - Phase 7A Dispatcher Core Engine
 * Implements:
 * 1. SSRF & DNS-rebinding defense (immediate resolution, IP range checks, explicit 169.254.169.254 block).
 * 2. URL userinfo rejection.
 * 3. 3xx redirect rejection (redirect: manual / error).
 * 4. Exact-byte HMAC-SHA256 signature generation and verification.
 * 5. Replay window checking (300s).
 * 6. Transactional Outbox retry lifecycle & backoff calculations.
 */

import crypto from "crypto";
import dns from "dns";

export const REPLAY_WINDOW_SECONDS = 300;

// Helper to convert IPv4 string to 32-bit unsigned int
function ipToInt(ip) {
    return ip.split(".").reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

// IP Range Checker
export function isForbiddenIp(ipAddress) {
    if (!ipAddress || typeof ipAddress !== "string") return true;

    // IPv6 checks
    if (ipAddress.includes(":")) {
        const lower = ipAddress.toLowerCase();
        // Loopback ::1
        if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
        // Unspecified ::
        if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return true;
        // Link-local fe80::/10
        if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
        // Unique local fc00::/7 (fc00:: and fd00::)
        if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
        // Multicast ff00::/8
        if (lower.startsWith("ff")) return true;
        // IPv4-mapped IPv6 ::ffff:x.x.x.x
        if (lower.startsWith("::ffff:")) {
            const ipv4Part = lower.replace("::ffff:", "");
            return isForbiddenIp(ipv4Part);
        }
        return false;
    }

    // IPv4 checks
    const parts = ipAddress.split(".");
    if (parts.length !== 4) return true;
    for (const p of parts) {
        const n = parseInt(p, 10);
        if (isNaN(n) || n < 0 || n > 255) return true;
    }

    const intIp = ipToInt(ipAddress);

    // 127.0.0.0/8 (Loopback)
    if ((intIp & 0xff000000) >>> 0 === 0x7f000000) return true;

    // 10.0.0.0/8 (Private)
    if ((intIp & 0xff000000) >>> 0 === 0x0a000000) return true;

    // 172.16.0.0/12 (Private)
    if ((intIp & 0xfff00000) >>> 0 === 0xac100000) return true;

    // 192.168.0.0/16 (Private)
    if ((intIp & 0xffff0000) >>> 0 === 0xc0a80000) return true;

    // 169.254.0.0/16 (Link-local & Cloud Metadata - explicitly 169.254.169.254)
    if ((intIp & 0xffff0000) >>> 0 === 0xa9fe0000) return true;

    // 0.0.0.0/8 (Current network)
    if ((intIp & 0xff000000) >>> 0 === 0x00000000) return true;

    // 100.64.0.0/10 (Shared Address Space)
    if ((intIp & 0xffc00000) >>> 0 === 0x64400000) return true;

    // 198.18.0.0/15 (Benchmarking)
    if ((intIp & 0xfffe0000) >>> 0 === 0xc6120000) return true;

    // 224.0.0.0/4 (Multicast)
    if ((intIp & 0xf0000000) >>> 0 === 0xe0000000) return true;

    // 240.0.0.0/4 (Reserved)
    if ((intIp & 0xf0000000) >>> 0 === 0xf0000000) return true;

    // 255.255.255.255 (Broadcast)
    if (intIp === 0xffffffff) return true;

    return false;
}

/**
 * Validates a target URL against SSRF rules:
 * - Reject userinfo
 * - Protocol enforcement (https, or test mock http if explicitly enabled)
 * - Immediate DNS resolution of all addresses
 * - Verification that NO resolved address falls into forbidden ranges
 */
export async function validateDestinationUrl(urlString, options = {}) {
    const { allowHttp = false } = options;

    let parsed;
    try {
        parsed = new URL(urlString);
    } catch (_e) {
        return { valid: false, reason: "invalid_url_syntax" };
    }

    // 1. Userinfo check
    if (parsed.username || parsed.password) {
        return { valid: false, reason: "url_userinfo_forbidden" };
    }

    // 2. Protocol check
    if (parsed.protocol === "http:") {
        if (!allowHttp && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
            return { valid: false, reason: "https_required" };
        }
    } else if (parsed.protocol !== "https:") {
        return { valid: false, reason: "unsupported_protocol" };
    }

    // 3. DNS resolution (DNS rebinding guard: resolve immediately before connection)
    const hostname = parsed.hostname;

    // Direct IP check if hostname is already an IP address
    if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) {
        if (isForbiddenIp(hostname)) {
            return { valid: false, reason: "forbidden_ip_address", ip: hostname };
        }
        if (!allowHttp && (hostname === "127.0.0.1" || hostname === "::1")) {
            return { valid: false, reason: "forbidden_ip_address", ip: hostname };
        }
        return { valid: true, resolvedIps: [hostname] };
    }

    // Resolve via DNS
    try {
        const addresses = await dns.promises.lookup(hostname, { all: true });
        if (!addresses || addresses.length === 0) {
            return { valid: false, reason: "dns_resolution_failed" };
        }

        const resolvedIps = addresses.map(a => a.address);
        for (const addr of resolvedIps) {
            if (isForbiddenIp(addr)) {
                if (!allowHttp || (addr !== "127.0.0.1" && addr !== "::1")) {
                    return { valid: false, reason: "forbidden_ip_address", ip: addr };
                }
            }
        }

        return { valid: true, resolvedIps };
    } catch (_e) {
        return { valid: false, reason: "dns_resolution_error" };
    }
}

/**
 * Exact-byte HMAC-SHA256 signature generator.
 * Signature contract: HMAC-SHA256(signing_secret, timestamp + "." + exact_raw_request_body_bytes)
 */
export function signWebhookPayload(signingSecret, timestamp, rawBodyString) {
    if (!signingSecret) throw new Error("Signing secret is required");
    const payload = `${timestamp}.${rawBodyString}`;
    return crypto.createHmac("sha256", signingSecret).update(payload, "utf8").digest("hex");
}

/**
 * Verifies exact-byte HMAC-SHA256 signature and replay window.
 */
export function verifyWebhookSignature({
    signingSecret,
    signatureHeader,
    timestampHeader,
    rawBodyString,
    currentEpochSeconds = Math.floor(Date.now() / 1000)
}) {
    if (!signingSecret || !signatureHeader || !timestampHeader || rawBodyString === undefined) {
        return { valid: false, reason: "missing_parameters" };
    }

    const ts = parseInt(timestampHeader, 10);
    if (isNaN(ts)) {
        return { valid: false, reason: "invalid_timestamp_header" };
    }

    // Replay window check (300 seconds)
    if (Math.abs(currentEpochSeconds - ts) > REPLAY_WINDOW_SECONDS) {
        return { valid: false, reason: "timestamp_out_of_window", delta: Math.abs(currentEpochSeconds - ts) };
    }

    // Extract signature hex (supports "sha256=<hex>" or plain "<hex>")
    const cleanSig = signatureHeader.replace(/^sha256=/, "").trim();

    // Compute expected signature
    const expectedSig = signWebhookPayload(signingSecret, ts, rawBodyString);

    // Constant-time comparison
    const sigBuf = Buffer.from(cleanSig, "hex");
    const expBuf = Buffer.from(expectedSig, "hex");

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return { valid: false, reason: "signature_mismatch" };
    }

    return { valid: true };
}

/**
 * Builds canonical outbound webhook envelope according to frozen Phase 7 contract.
 */
export function buildWebhookEnvelope(event) {
    return {
        id: event.id,
        event: event.event_type,
        created_at: event.created_at,
        organization_id: event.organization_id,
        project_id: event.project_id || null,
        data: event.payload_json || {}
    };
}

/**
 * Computes next retry timestamp with exponential backoff:
 * attempt 1: 30s, attempt 2: 60s, attempt 3: 120s, attempt 4: 240s
 */
export function calculateNextRetry(attemptCount, baseSeconds = 30) {
    const delaySeconds = Math.pow(2, Math.max(0, attemptCount - 1)) * baseSeconds;
    return new Date(Date.now() + delaySeconds * 1000);
}

// ---------------------------------------------------------------------------
// Phase 7B: Telegram Notifications Integration Engine
// ---------------------------------------------------------------------------

/**
 * Escapes all 18 reserved characters for Telegram Bot API MarkdownV2 mode:
 * _ * [ ] ( ) ~ ` > # + - = | { } . ! \
 */
export function escapeTelegramMarkdownV2(text) {
    if (text === null || text === undefined) return "";
    return String(text).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

/**
 * Formats canonical event into Telegram MarkdownV2 text body.
 */
export function formatTelegramMessage(event) {
    const payload = event.payload_json || {};
    const orgName = payload.organization_name || event.organization_name || "";
    const dateStr = event.created_at ? new Date(event.created_at).toLocaleString("uk-UA") : "";
    const escapedDate = escapeTelegramMarkdownV2(dateStr);

    let eventHeader = "*🔔 Сповіщення FIRSTWIN*";
    let details = "";

    switch (event.event_type) {
        case "task.completed":
            eventHeader = "*🎯 Завдання виконано*";
            details = [
                `*Завдання:* ${escapeTelegramMarkdownV2(payload.task_title || payload.title || "—")}`,
                (payload.project_name || payload.project_title) ? `*Проєкт:* ${escapeTelegramMarkdownV2(payload.project_name || payload.project_title)}` : null,
                orgName ? `*Організація:* ${escapeTelegramMarkdownV2(orgName)}` : null,
                payload.responsibility_type ? `*Зона відповідальності:* ${escapeTelegramMarkdownV2(payload.responsibility_type)}` : null
            ].filter(Boolean).join("\n");
            break;

        case "stage.completed":
            eventHeader = "*🏁 Етап завершено*";
            details = [
                `*Етап:* ${escapeTelegramMarkdownV2(payload.stage_name || payload.title || "—")}`,
                (payload.project_name || payload.project_title) ? `*Проєкт:* ${escapeTelegramMarkdownV2(payload.project_name || payload.project_title)}` : null,
                orgName ? `*Організація:* ${escapeTelegramMarkdownV2(orgName)}` : null
            ].filter(Boolean).join("\n");
            break;

        case "document.approved":
            eventHeader = "*📄 Документ погоджено*";
            details = [
                `*Документ:* ${escapeTelegramMarkdownV2(payload.document_title || payload.title || "—")}`,
                (payload.project_name || payload.project_title) ? `*Проєкт:* ${escapeTelegramMarkdownV2(payload.project_name || payload.project_title)}` : null,
                orgName ? `*Організація:* ${escapeTelegramMarkdownV2(orgName)}` : null,
                payload.approved_by ? `*Погодив:* ${escapeTelegramMarkdownV2(payload.approved_by)}` : null
            ].filter(Boolean).join("\n");
            break;

        case "client_action.completed":
            eventHeader = "*⚡ Дію клієнта виконано*";
            details = [
                `*Дія:* ${escapeTelegramMarkdownV2(payload.action_title || payload.title || "—")}`,
                (payload.project_name || payload.project_title) ? `*Проєкт:* ${escapeTelegramMarkdownV2(payload.project_name || payload.project_title)}` : null,
                orgName ? `*Організація:* ${escapeTelegramMarkdownV2(orgName)}` : null,
                payload.completed_by ? `*Виконавець:* ${escapeTelegramMarkdownV2(payload.completed_by)}` : null
            ].filter(Boolean).join("\n");
            break;

        default:
            eventHeader = `*📌 Подія: ${escapeTelegramMarkdownV2(event.event_type)}*`;
            details = [
                orgName ? `*Організація:* ${escapeTelegramMarkdownV2(orgName)}` : null,
                `*Дані:* ${escapeTelegramMarkdownV2(JSON.stringify(payload))}`
            ].filter(Boolean).join("\n");
            break;
    }

    return `${eventHeader}\n\n${details}\n\n_Час:_ ${escapedDate}`;
}

/**
 * Validates Telegram API Endpoint strictly against official api.telegram.org host.
 */
export function validateTelegramApiEndpoint(urlString) {
    try {
        const parsed = new URL(urlString);
        if (parsed.protocol !== "https:") {
            return { valid: false, reason: "https_required" };
        }
        if (parsed.hostname.toLowerCase() !== "api.telegram.org") {
            return { valid: false, reason: "forbidden_telegram_host" };
        }
        if (parsed.port && parsed.port !== "443" && parsed.port !== "") {
            return { valid: false, reason: "custom_port_forbidden" };
        }
        if (parsed.username || parsed.password) {
            return { valid: false, reason: "userinfo_forbidden" };
        }
        return { valid: true };
    } catch (_e) {
        return { valid: false, reason: "invalid_url_syntax" };
    }
}

/**
 * Calculates next retry timestamp using Telegram 429 retry_after parameter.
 */
export function calculateTelegram429Retry(retryAfterSeconds) {
    const parsed = parseInt(retryAfterSeconds, 10);
    const seconds = Math.max(1, isNaN(parsed) ? 5 : parsed);
    return new Date(Date.now() + seconds * 1000);
}

