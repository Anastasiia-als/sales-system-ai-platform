// Supabase Edge Function: webhook-dispatcher
// Phase 7A - Outbound Webhook Dispatcher
// Pulls pending Outbox deliveries, resolves destinations, enforces SSRF & DNS rebinding protection,
// signs requests with exact-byte HMAC-SHA256, executes delivery, and updates Outbox state machine.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Forbidden IP Range Checks (Deno)
function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

function isForbiddenIp(ipAddress: string): boolean {
  if (!ipAddress || typeof ipAddress !== "string") return true;

  // IPv6 checks
  if (ipAddress.includes(":")) {
    const lower = ipAddress.toLowerCase();
    if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
    if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return true;
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("ff")) return true;
    if (lower.startsWith("::ffff:")) {
      return isForbiddenIp(lower.replace("::ffff:", ""));
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
  // 169.254.0.0/16 (Link-local / Cloud metadata - explicitly 169.254.169.254)
  if ((intIp & 0xffff0000) >>> 0 === 0xa9fe0000) return true;
  // 0.0.0.0/8
  if ((intIp & 0xff000000) >>> 0 === 0x00000000) return true;
  // 100.64.0.0/10
  if ((intIp & 0xffc00000) >>> 0 === 0x64400000) return true;
  // 198.18.0.0/15
  if ((intIp & 0xfffe0000) >>> 0 === 0xc6120000) return true;
  // 224.0.0.0/4 (Multicast)
  if ((intIp & 0xf0000000) >>> 0 === 0xe0000000) return true;
  // 240.0.0.0/4 (Reserved)
  if ((intIp & 0xf0000000) >>> 0 === 0xf0000000) return true;

  return false;
}

// Exact-byte HMAC-SHA256 calculation using Web Crypto
async function computeHmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const hashArray = Array.from(new Uint8Array(sigBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuration missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Optional specific outbox_id from caller or batch dispatch
    const body = await req.json().catch(() => ({}));
    const targetOutboxId = body.outbox_id;

    // 1. Fetch pending or retrying deliveries
    let query = admin
      .from("integration_outbox")
      .select(`
        id,
        organization_id,
        event_id,
        channel_type,
        destination_id,
        status,
        attempts_count,
        max_attempts,
        integration_events (
          id,
          event_type,
          organization_id,
          project_id,
          payload_json,
          created_at
        )
      `)
      .in("status", ["pending", "retrying"])
      .lte("next_retry_at", new Date().toISOString());

    if (targetOutboxId) {
      query = query.eq("id", targetOutboxId);
    } else {
      query = query.limit(10);
    }

    const { data: deliveries, error: fetchErr } = await query;
    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!deliveries || deliveries.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No pending deliveries" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const outbox of deliveries) {
      if (outbox.channel_type !== "webhook") {
        // Future channels (Phase 7B Telegram) handled in future phases
        continue;
      }

      // Mark status as processing
      await admin
        .from("integration_outbox")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", outbox.id);

      // Fetch endpoint from DB
      const { data: endpoint, error: epErr } = await admin
        .from("integration_endpoints")
        .select("id, is_active, url_secret_id, signing_secret_id, organization_id")
        .eq("id", outbox.destination_id)
        .single();

      if (epErr || !endpoint || !endpoint.is_active || endpoint.organization_id !== outbox.organization_id) {
        // Destination inactive or tenant mismatch -> fail delivery
        await admin
          .from("integration_outbox")
          .update({
            status: "failed",
            last_error: "Endpoint inactive, missing, or tenant mismatch",
            updated_at: new Date().toISOString(),
          })
          .eq("id", outbox.id);
        results.push({ id: outbox.id, status: "failed", reason: "invalid_endpoint" });
        continue;
      }

      // Retrieve secrets from vault.decrypted_secrets
      const { data: secretsData, error: secretErr } = await admin
        .rpc("get_endpoint_secrets_internal", {
          p_url_secret_id: endpoint.url_secret_id,
          p_signing_secret_id: endpoint.signing_secret_id,
        })
        .single();

      let targetUrl = secretsData?.decrypted_url;
      let signingSecret = secretsData?.decrypted_signing_secret;

      // Fallback query if RPC not present
      if (!targetUrl || !signingSecret) {
        const { data: urlRow } = await admin
          .from("vault.decrypted_secrets")
          .select("decrypted_secret")
          .eq("id", endpoint.url_secret_id)
          .single();
        const { data: sigRow } = await admin
          .from("vault.decrypted_secrets")
          .select("decrypted_secret")
          .eq("id", endpoint.signing_secret_id)
          .single();
        targetUrl = urlRow?.decrypted_secret;
        signingSecret = sigRow?.decrypted_secret;
      }

      if (!targetUrl || !signingSecret) {
        await admin
          .from("integration_outbox")
          .update({
            status: "failed",
            last_error: "Target URL or signing secret missing from vault",
            updated_at: new Date().toISOString(),
          })
          .eq("id", outbox.id);
        results.push({ id: outbox.id, status: "failed", reason: "vault_secrets_missing" });
        continue;
      }

      // SSRF & Network Validation
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(targetUrl);
      } catch (_e) {
        await admin
          .from("integration_outbox")
          .update({
            status: "rejected_ssrf",
            last_error: "Invalid target URL format",
            updated_at: new Date().toISOString(),
          })
          .eq("id", outbox.id);
        results.push({ id: outbox.id, status: "rejected_ssrf", reason: "invalid_url" });
        continue;
      }

      if (parsedUrl.username || parsedUrl.password) {
        await admin
          .from("integration_outbox")
          .update({
            status: "rejected_ssrf",
            last_error: "URL userinfo is strictly forbidden",
            updated_at: new Date().toISOString(),
          })
          .eq("id", outbox.id);
        results.push({ id: outbox.id, status: "rejected_ssrf", reason: "userinfo_forbidden" });
        continue;
      }

      // DNS Resolution (SSRF / Rebinding guard)
      try {
        let isIp = /^[\d.]+$/.test(parsedUrl.hostname) || parsedUrl.hostname.includes(":");
        if (isIp) {
          if (isForbiddenIp(parsedUrl.hostname)) {
            await admin
              .from("integration_outbox")
              .update({
                status: "rejected_ssrf",
                last_error: `Forbidden target IP address: ${parsedUrl.hostname}`,
                updated_at: new Date().toISOString(),
              })
              .eq("id", outbox.id);
            results.push({ id: outbox.id, status: "rejected_ssrf", reason: "forbidden_ip" });
            continue;
          }
        } else {
          const ips = await Deno.resolveDns(parsedUrl.hostname, "A").catch(() => []);
          for (const ip of ips) {
            if (isForbiddenIp(ip)) {
              await admin
                .from("integration_outbox")
                .update({
                  status: "rejected_ssrf",
                  last_error: `Forbidden resolved IP address: ${ip}`,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", outbox.id);
              results.push({ id: outbox.id, status: "rejected_ssrf", reason: "forbidden_ip" });
              continue;
            }
          }
        }
      } catch (_dnsErr) {
        // If DNS check fails, reject
        await admin
          .from("integration_outbox")
          .update({
            status: "rejected_ssrf",
            last_error: "DNS resolution failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", outbox.id);
        results.push({ id: outbox.id, status: "rejected_ssrf", reason: "dns_error" });
        continue;
      }

      // Build envelope & sign request
      const eventRecord = (outbox as any).integration_events;
      const envelope = {
        id: eventRecord.id,
        event: eventRecord.event_type,
        created_at: eventRecord.created_at,
        organization_id: eventRecord.organization_id,
        project_id: eventRecord.project_id || null,
        data: eventRecord.payload_json || {},
      };

      const rawBody = JSON.stringify(envelope);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signatureHex = await computeHmacSha256(signingSecret, `${timestamp}.${rawBody}`);

      const attemptNum = (outbox.attempts_count || 0) + 1;

      try {
        // Dispatch HTTP request with manual redirect handling (never follow redirects)
        const response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Firstwin-Timestamp": timestamp,
            "X-Firstwin-Signature": `sha256=${signatureHex}`,
            "X-Firstwin-Signature-256": `sha256=${signatureHex}`,
            "X-Firstwin-Delivery": outbox.id,
            "X-Firstwin-Event": eventRecord.event_type,
          },
          body: rawBody,
          redirect: "manual",
        });

        // 3xx Redirect Rejection
        if (response.status >= 300 && response.status < 400) {
          await admin
            .from("integration_outbox")
            .update({
              status: "rejected_ssrf",
              last_http_status: response.status,
              last_error: "HTTP 3xx redirects are prohibited",
              attempts_count: attemptNum,
              last_attempt_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", outbox.id);
          results.push({ id: outbox.id, status: "rejected_ssrf", httpStatus: response.status });
          continue;
        }

        const respText = await response.text().catch(() => "");
        const preview = respText.slice(0, 500);

        if (response.ok) {
          // 2xx Success
          await admin
            .from("integration_outbox")
            .update({
              status: "delivered",
              delivered_at: new Date().toISOString(),
              last_http_status: response.status,
              last_error: null,
              response_body_preview: preview,
              attempts_count: attemptNum,
              last_attempt_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", outbox.id);
          results.push({ id: outbox.id, status: "delivered", httpStatus: response.status });
        } else {
          // 4xx or 5xx error -> retry or dead_letter
          const isDeadLetter = attemptNum >= outbox.max_attempts;
          const nextRetry = isDeadLetter
            ? null
            : new Date(Date.now() + Math.pow(2, attemptNum - 1) * 30 * 1000).toISOString();

          await admin
            .from("integration_outbox")
            .update({
              status: isDeadLetter ? "dead_letter" : "retrying",
              attempts_count: attemptNum,
              next_retry_at: nextRetry,
              last_http_status: response.status,
              last_error: `HTTP Error ${response.status}: ${preview}`,
              response_body_preview: preview,
              last_attempt_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", outbox.id);
          results.push({ id: outbox.id, status: isDeadLetter ? "dead_letter" : "retrying", httpStatus: response.status });
        }
      } catch (reqErr: any) {
        // Network timeout / connection error
        const isDeadLetter = attemptNum >= outbox.max_attempts;
        const nextRetry = isDeadLetter
          ? null
          : new Date(Date.now() + Math.pow(2, attemptNum - 1) * 30 * 1000).toISOString();

        await admin
          .from("integration_outbox")
          .update({
            status: isDeadLetter ? "dead_letter" : "retrying",
            attempts_count: attemptNum,
            next_retry_at: nextRetry,
            last_error: `Network error: ${reqErr.message || String(reqErr)}`,
            last_attempt_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", outbox.id);
        results.push({ id: outbox.id, status: isDeadLetter ? "dead_letter" : "retrying", error: reqErr.message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
