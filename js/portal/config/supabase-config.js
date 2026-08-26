/* js/portal/config/supabase-config.js - Supabase Configuration Layer */

/**
 * Supabase configuration provider.
 * Reads public browser-safe configuration from global runtime config (window.FIRSTWIN_ENV)
 * without hardcoding sensitive secrets.
 */
export const SupabaseConfig = {
    getUrl() {
        if (typeof window !== "undefined") {
            if (window.FIRSTWIN_ENV?.SUPABASE_URL) return window.FIRSTWIN_ENV.SUPABASE_URL;
            if (window.__ENV?.SUPABASE_URL) return window.__ENV.SUPABASE_URL;
            const stored = sessionStorage.getItem("FIRSTWIN_SUPABASE_URL");
            if (stored) return stored;
        }
        return "";
    },

    getPublishableKey() {
        if (typeof window !== "undefined") {
            if (window.FIRSTWIN_ENV?.SUPABASE_PUBLISHABLE_KEY) return window.FIRSTWIN_ENV.SUPABASE_PUBLISHABLE_KEY;
            if (window.FIRSTWIN_ENV?.SUPABASE_ANON_KEY) return window.FIRSTWIN_ENV.SUPABASE_ANON_KEY;
            if (window.__ENV?.SUPABASE_PUBLISHABLE_KEY) return window.__ENV.SUPABASE_PUBLISHABLE_KEY;
            if (window.__ENV?.SUPABASE_ANON_KEY) return window.__ENV.SUPABASE_ANON_KEY;
            const stored = sessionStorage.getItem("FIRSTWIN_SUPABASE_PUBLISHABLE_KEY") || sessionStorage.getItem("FIRSTWIN_SUPABASE_ANON_KEY");
            if (stored) return stored;
        }
        return "";
    },

    getAnonKey() {
        return this.getPublishableKey();
    },

    isConfigured() {
        const url = this.getUrl();
        const key = this.getPublishableKey();
        return Boolean(url && key && url.startsWith("https://"));
    },

    setCredentials(url, publishableKey) {
        if (typeof window !== "undefined") {
            if (url) sessionStorage.setItem("FIRSTWIN_SUPABASE_URL", url);
            if (publishableKey) sessionStorage.setItem("FIRSTWIN_SUPABASE_PUBLISHABLE_KEY", publishableKey);
        }
    },

    clearCredentials() {
        if (typeof window !== "undefined") {
            sessionStorage.removeItem("FIRSTWIN_SUPABASE_URL");
            sessionStorage.removeItem("FIRSTWIN_SUPABASE_PUBLISHABLE_KEY");
            sessionStorage.removeItem("FIRSTWIN_SUPABASE_ANON_KEY");
        }
    }
};
