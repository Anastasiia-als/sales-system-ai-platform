/* js/marketing/marketing-config.js — single switchboard for all marketing integrations.
   Everything ships DISABLED / placeholder until the owner provides real IDs.
   No secrets belong here: this file is public. Bot tokens/chat IDs live only in
   Supabase Edge Function secrets. */

export const MarketingConfig = {
    // Google Analytics 4. Empty string = GA4 fully disabled (no gtag.js loaded).
    // Set to a real "G-..." Measurement ID after the property is created.
    GA4_MEASUREMENT_ID: "",

    // Google Calendar Appointment Schedule booking page URL.
    // Empty = booking step hidden; the form's preferred date/time fields are used instead.
    APPOINTMENT_SCHEDULE_URL: "",

    // Meta Pixel ID. Empty = disabled. Loaded only with marketing consent.
    META_PIXEL_ID: "",

    // Server-side lead capture into Supabase (RPC submit_marketing_lead).
    // Enabled: the code path is live, but it degrades gracefully to the
    // localStorage fallback until the migration is applied to the database.
    SUPABASE_LEADS_ENABLED: true,

    // Telegram notifications for new leads (Edge Function lead-notify).
    // DISABLED by owner decision until bot token + chat ID are provisioned.
    TELEGRAM_NOTIFY_ENABLED: false,
    LEAD_NOTIFY_FUNCTION: "lead-notify",

    // Consent banner behaviour
    CONSENT_VERSION: 1
};
