/* js/portal/auth/auth-service.js - Portal Authentication & Session Service */

import { getSupabase } from "../api/supabase-client.js";
import { SupabaseConfig } from "../config/supabase-config.js";

class AuthService {
    constructor() {
        this.session = null;
        this.user = null;
        this.profile = null;
        this.memberships = [];
        this.isInitialized = false;
        this.listeners = new Set();
    }

    /**
     * Initializes Supabase Auth listener. Safe to call multiple times.
     */
    async init() {
        if (this.isInitialized) return this.session;

        if (!SupabaseConfig.isConfigured()) {
            this.isInitialized = true;
            return null;
        }

        const supabase = await getSupabase();
        if (!supabase) {
            this.isInitialized = true;
            return null;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            this.session = session;
            this.user = session?.user || null;

            if (this.user) {
                await this.loadUserProfileAndMemberships();
            }

            // Listen for standard Supabase auth state changes
            supabase.auth.onAuthStateChange(async (event, session) => {
                this.session = session;
                this.user = session?.user || null;

                if (this.user) {
                    await this.loadUserProfileAndMemberships();
                } else {
                    this.profile = null;
                    this.memberships = [];
                }

                this.notifyListeners(event);
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("portal-auth-changed", {
                        detail: { event, session: this.session, user: this.user, profile: this.profile }
                    }));
                }
            });

            this.isInitialized = true;
            return this.session;
        } catch (error) {
            console.warn("[AuthService] Init error:", error);
            this.isInitialized = true;
            return null;
        }
    }

    /**
     * Loads the user's public profile and organization memberships from the DB.
     */
    async loadUserProfileAndMemberships() {
        const supabase = await getSupabase();
        if (!supabase || !this.user) return;

        try {
            // 1. Fetch Profile
            const { data: profile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", this.user.id)
                .single();

            this.profile = profile || {
                id: this.user.id,
                email: this.user.email,
                full_name: this.user.user_metadata?.full_name || "",
                global_role: "client"
            };

            // 2. Fetch Organization Memberships
            const { data: memberships } = await supabase
                .from("organization_memberships")
                .select("id, organization_id, org_role, is_active, organizations(id, name, logo_url, status)")
                .eq("user_id", this.user.id)
                .eq("is_active", true);

            this.memberships = memberships || [];

            // 3. Fetch Client Portal Access
            const { data: clientAccess } = await supabase
                .from("client_portal_access")
                .select("id, organization_id, contact_id, status, activated_at, organizations(id, name, logo_url)")
                .eq("user_id", this.user.id);

            this.clientAccess = clientAccess || [];
        } catch (err) {
            console.warn("[AuthService] Failed to load profile/memberships:", err);
        }
    }

    isAuthenticated() {
        return Boolean(this.session && this.user);
    }

    getUser() {
        return this.user;
    }

    getUserId() {
        return this.user?.id || this.profile?.id || null;
    }

    getUserEmail() {
        return this.user?.email || this.profile?.email || null;
    }

    getProfile() {
        return this.profile;
    }

    getMemberships() {
        return this.memberships;
    }

    getClientAccess() {
        return this.clientAccess || [];
    }

    getActiveClientAccess() {
        return (this.clientAccess || []).filter(a => a.status === "active");
    }

    hasActiveClientAccess() {
        return this.getActiveClientAccess().length > 0;
    }

    isClientUser() {
        if (this.isGlobalOwner()) return false;
        if (this.profile?.global_role === "pm" || this.profile?.global_role === "specialist") return false;
        return this.profile?.global_role === "client" || (this.clientAccess && this.clientAccess.length > 0);
    }

    getGlobalRole() {
        return this.profile?.global_role || "client";
    }

    isGlobalOwner() {
        return this.getGlobalRole() === "owner";
    }

    isSpecialist() {
        return this.getGlobalRole() === "specialist";
    }

    isPM() {
        return this.getGlobalRole() === "pm";
    }

    isStaff() {
        return ["owner", "pm", "specialist"].includes(this.getGlobalRole());
    }

    /**
     * Checks if current user has administrative rights in a specific organization.
     */
    isOrgAdmin(organizationId) {
        if (this.isGlobalOwner()) return true;
        const m = this.memberships.find(m => m.organization_id === organizationId && m.is_active);
        return Boolean(m && ["owner", "admin", "pm"].includes(m.org_role));
    }

    /**
     * Checks if current user has membership in a specific organization.
     */
    isOrgMember(organizationId) {
        if (this.isGlobalOwner()) return true;
        return this.memberships.some(m => m.organization_id === organizationId && m.is_active);
    }

    /**
     * Sign in with standard email and password.
     */
    async signInWithPassword(email, password) {
        const supabase = await getSupabase();
        if (!supabase) {
            return { data: null, error: new Error("Supabase is not configured yet.") };
        }

        const res = await supabase.auth.signInWithPassword({ email, password });
        if (res.data?.session) {
            this.session = res.data.session;
            this.user = res.data.session.user;
            await this.loadUserProfileAndMemberships();
        }
        return res;
    }

    /**
     * Send magic link / OTP to email for secure passwordless login.
     */
    async signInWithOtp(email) {
        const supabase = await getSupabase();
        if (!supabase) {
            return { data: null, error: new Error("Supabase is not configured yet.") };
        }

        return await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/#/portal`
            }
        });
    }

    /**
     * Send password reset email.
     */
    async resetPasswordForEmail(email) {
        const supabase = await getSupabase();
        if (!supabase) {
            return { data: null, error: new Error("Supabase is not configured yet.") };
        }

        return await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/#/portal`
        });
    }



    /**
     * Sign out current user.
     */
    async signOut() {
        const supabase = await getSupabase();
        if (supabase) {
            await supabase.auth.signOut();
        }
        if (typeof window !== "undefined") {
            localStorage.removeItem("firstwin_portal_auth_token");
        }
        this.session = null;
        this.user = null;
        this.profile = null;
        this.memberships = [];
        this.clientAccess = [];
        this.notifyListeners("SIGNED_OUT");
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("portal-auth-changed", {
                detail: { event: "SIGNED_OUT", session: null, user: null, profile: null }
            }));
        }
    }

    onAuthStateChange(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notifyListeners(event) {
        for (const cb of this.listeners) {
            try {
                cb(event, this.session);
            } catch (err) {
                console.error("[AuthService] Listener error:", err);
            }
        }
    }
}

export const PortalAuth = new AuthService();
