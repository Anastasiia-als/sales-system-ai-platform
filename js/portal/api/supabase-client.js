/* js/portal/api/supabase-client.js - Supabase Client Singleton */

import { SupabaseConfig } from "../config/supabase-config.js";

let supabaseInstance = null;
let initPromise = null;

/**
 * Initializes and returns the Supabase client instance.
 * Dynamically loads the official Supabase ESM SDK from CDN when configured.
 * Does NOT throw runtime errors if unconfigured or offline.
 */
export async function getSupabase() {
    if (supabaseInstance) return supabaseInstance;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        if (!SupabaseConfig.isConfigured()) {
            // Graceful non-blocking unconfigured state
            return null;
        }

        try {
            // Load official Supabase client from ESM CDN
            const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
            const url = SupabaseConfig.getUrl();
            const anonKey = SupabaseConfig.getAnonKey();

            supabaseInstance = createClient(url, anonKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    storageKey: "firstwin_portal_auth_token"
                }
            });

            return supabaseInstance;
        } catch (error) {
            console.warn("[Portal Data Foundation] Supabase client dynamic import error:", error);
            return null;
        } finally {
            initPromise = null;
        }
    })();

    return initPromise;
}

/**
 * Reset client instance (e.g. upon credential change or sign out).
 */
export function resetSupabase() {
    supabaseInstance = null;
    initPromise = null;
}
