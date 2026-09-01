// Supabase Edge Function: lead-notify
// Sends a Telegram notification to the owner when a new marketing lead arrives.
//
// PREPARED BUT DISABLED: without TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID secrets
// this function is a no-op that returns {ok:true, notified:false}. It never
// sends anything until the owner provisions the bot and sets both secrets.
// The function is also NOT deployed until the owner approves production changes.
//
// Secrets (set via `supabase secrets set`, never committed):
//   TELEGRAM_BOT_TOKEN — bot token from @BotFather (owner's own bot)
//   TELEGRAM_CHAT_ID   — owner's chat/channel ID
//
// The client sends only {lead_id, form_id}; lead details are read server-side
// with the service role so no personal data round-trips through the browser call.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

    // Kill-switch: notifications stay off until both secrets exist.
    if (!botToken || !chatId) {
      return json({ ok: true, notified: false, reason: "notifications_disabled" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Server configuration missing." }, 500);
    }

    const { lead_id } = await req.json().catch(() => ({}));
    if (!lead_id || typeof lead_id !== "string") {
      return json({ error: "lead_id is required." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: lead, error } = await admin
      .from("marketing_leads")
      .select("id, name, phone, email, telegram, form_id, offer_id, utm_source, utm_campaign, created_at")
      .eq("id", lead_id)
      .single();

    if (error || !lead) {
      return json({ error: "Lead not found." }, 404);
    }

    const lines = [
      "🔔 Нова заявка з сайту",
      `Форма: ${lead.form_id}${lead.offer_id ? " / " + lead.offer_id : ""}`,
      `Ім'я: ${lead.name}`,
      lead.phone ? `Телефон: ${lead.phone}` : null,
      lead.email ? `Email: ${lead.email}` : null,
      lead.telegram ? `Telegram: ${lead.telegram}` : null,
      lead.utm_source ? `Джерело: ${lead.utm_source} / ${lead.utm_campaign ?? "-"}` : "Джерело: пряме",
      `Час: ${lead.created_at}`,
    ].filter(Boolean);

    const tgResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: lines.join("\n") }),
      },
    );

    return json({ ok: tgResponse.ok, notified: tgResponse.ok });
  } catch (_e) {
    return json({ error: "Unexpected error." }, 500);
  }
});
