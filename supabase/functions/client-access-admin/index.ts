// Supabase Edge Function: client-access-admin
// Secure server-side administrative operations for Client Portal access
// Follows strict authorization, caller verification and least privilege principles.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration missing." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Authenticate caller JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser }, error: authError } = await userClient.auth.getUser();

    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Initialize Privileged Admin Client
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 3. Verify caller permissions (Owner or Org Admin/PM)
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("global_role")
      .eq("id", callerUser.id)
      .single();

    const isGlobalOwner = callerProfile?.global_role === "owner";

    const body = await req.json();
    const { action } = body;

    const callerHasOrgAdmin = async (orgId: string) => {
      if (isGlobalOwner) return true;
      const { data: mem } = await adminClient
        .from("organization_memberships")
        .select("org_role, is_active")
        .eq("organization_id", orgId)
        .eq("user_id", callerUser.id)
        .eq("is_active", true)
        .single();
      return Boolean(mem && ["owner", "admin", "pm"].includes(mem.org_role));
    };

    // -------------------------------------------------------------------------
    // ACTION: INVITE
    // -------------------------------------------------------------------------
    if (action === "invite") {
      const { organizationId, contactId, projectIds = [], appOrigin = "" } = body;
      if (!organizationId || !contactId) {
        return new Response(
          JSON.stringify({ error: "organizationId and contactId are required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!(await callerHasOrgAdmin(organizationId))) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Insufficient permissions in organization." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch Contact
      const { data: contact, error: contactErr } = await adminClient
        .from("contacts")
        .select("*")
        .eq("id", contactId)
        .eq("organization_id", organizationId)
        .single();

      if (contactErr || !contact) {
        return new Response(
          JSON.stringify({ error: "Contact not found in organization." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!contact.email || !contact.email.trim()) {
        return new Response(
          JSON.stringify({ error: "Спочатку додайте email контактної особи." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const email = contact.email.trim().toLowerCase();

      // Check existing active or invited access
      const { data: existingAccess } = await adminClient
        .from("client_portal_access")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .in("status", ["invited", "active"])
        .maybeSingle();

      if (existingAccess) {
        return new Response(
          JSON.stringify({
            error: existingAccess.status === "active"
              ? "Для цього контакту доступ вже активний."
              : "Запрошення вже надіслано.",
            access: existingAccess
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find or Invite Supabase Auth User
      let authUserId: string | null = null;
      const redirectUrl = `${appOrigin || "https://firstwin.io"}/#/client/activate`;

      const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            full_name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
            global_role: "client"
          },
          redirectTo: redirectUrl
        }
      );

      if (!inviteErr && inviteData?.user) {
        authUserId = inviteData.user.id;
      } else {
        // If user already exists in auth.users, look them up
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const found = existingUsers?.users?.find(u => u.email?.toLowerCase() === email);
        if (found) {
          authUserId = found.id;
        } else {
          return new Response(
            JSON.stringify({ error: inviteErr?.message || "Failed to invite user via Supabase Auth." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Ensure profile exists
      if (authUserId) {
        await adminClient
          .from("profiles")
          .upsert({
            id: authUserId,
            email: email,
            full_name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
            global_role: "client",
            updated_at: new Date().toISOString()
          });

        // Add Organization Membership
        await adminClient
          .from("organization_memberships")
          .upsert({
            organization_id: organizationId,
            user_id: authUserId,
            org_role: "client",
            is_active: true,
            updated_at: new Date().toISOString()
          }, { onConflict: "organization_id,user_id" });

        // Add Project Memberships for specified projects
        if (Array.isArray(projectIds) && projectIds.length > 0) {
          for (const projId of projectIds) {
            await adminClient
              .from("project_memberships")
              .upsert({
                project_id: projId,
                user_id: authUserId,
                project_role: "client_rep"
              }, { onConflict: "project_id,user_id" });
          }
        }
      }

      // Insert client_portal_access record
      const { data: newAccess, error: insertAccessErr } = await adminClient
        .from("client_portal_access")
        .insert({
          organization_id: organizationId,
          contact_id: contactId,
          user_id: authUserId,
          status: "invited",
          invited_by: callerUser.id,
          invited_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertAccessErr) {
        return new Response(
          JSON.stringify({ error: insertAccessErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, access: newAccess }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: RESEND
    // -------------------------------------------------------------------------
    if (action === "resend") {
      const { accessId, appOrigin = "" } = body;
      if (!accessId) {
        return new Response(
          JSON.stringify({ error: "accessId is required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: access, error: accessErr } = await adminClient
        .from("client_portal_access")
        .select("*, contacts(*)")
        .eq("id", accessId)
        .single();

      if (accessErr || !access) {
        return new Response(
          JSON.stringify({ error: "Access record not found." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!(await callerHasOrgAdmin(access.organization_id))) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Insufficient permissions." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const email = access.contacts?.email;
      if (!email) {
        return new Response(
          JSON.stringify({ error: "Contact has no email." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const redirectUrl = `${appOrigin || "https://firstwin.io"}/#/client/activate`;
      await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo: redirectUrl });

      const { data: updatedAccess } = await adminClient
        .from("client_portal_access")
        .update({
          invited_at: new Date().toISOString(),
          status: "invited",
          updated_at: new Date().toISOString()
        })
        .eq("id", accessId)
        .select()
        .single();

      return new Response(
        JSON.stringify({ success: true, access: updatedAccess }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: UPDATE_PROJECTS
    // -------------------------------------------------------------------------
    if (action === "update_projects") {
      const { accessId, projectIds = [] } = body;
      if (!accessId) {
        return new Response(
          JSON.stringify({ error: "accessId is required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: access, error: accessErr } = await adminClient
        .from("client_portal_access")
        .select("*")
        .eq("id", accessId)
        .single();

      if (accessErr || !access) {
        return new Response(
          JSON.stringify({ error: "Access record not found." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!(await callerHasOrgAdmin(access.organization_id))) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Insufficient permissions." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (access.user_id) {
        // Fetch all projects in this organization
        const { data: orgProjects } = await adminClient
          .from("projects")
          .select("id")
          .eq("organization_id", access.organization_id);

        const orgProjectIds = (orgProjects || []).map(p => p.id);

        // Delete client memberships for projects not in projectIds
        const projectsToRemove = orgProjectIds.filter(id => !projectIds.includes(id));
        if (projectsToRemove.length > 0) {
          await adminClient
            .from("project_memberships")
            .delete()
            .eq("user_id", access.user_id)
            .in("project_id", projectsToRemove);
        }

        // Add or update memberships for requested projects
        for (const pid of projectIds) {
          if (orgProjectIds.includes(pid)) {
            await adminClient
              .from("project_memberships")
              .upsert({
                project_id: pid,
                user_id: access.user_id,
                project_role: "client_rep"
              }, { onConflict: "project_id,user_id" });
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, updatedProjectIds: projectIds }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: REVOKE
    // -------------------------------------------------------------------------
    if (action === "revoke") {
      const { accessId } = body;
      if (!accessId) {
        return new Response(
          JSON.stringify({ error: "accessId is required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: access, error: accessErr } = await adminClient
        .from("client_portal_access")
        .select("*")
        .eq("id", accessId)
        .single();

      if (accessErr || !access) {
        return new Response(
          JSON.stringify({ error: "Access record not found." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!(await callerHasOrgAdmin(access.organization_id))) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Insufficient permissions." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark access as revoked
      const { data: revokedAccess } = await adminClient
        .from("client_portal_access")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", accessId)
        .select()
        .single();

      // Deactivate organization membership for this org
      if (access.user_id) {
        await adminClient
          .from("organization_memberships")
          .update({
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq("organization_id", access.organization_id)
          .eq("user_id", access.user_id);

        // Delete project memberships in this organization
        const { data: orgProjects } = await adminClient
          .from("projects")
          .select("id")
          .eq("organization_id", access.organization_id);

        const orgProjectIds = (orgProjects || []).map(p => p.id);
        if (orgProjectIds.length > 0) {
          await adminClient
            .from("project_memberships")
            .delete()
            .eq("user_id", access.user_id)
            .in("project_id", orgProjectIds);
        }
      }

      return new Response(
        JSON.stringify({ success: true, access: revokedAccess }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unsupported action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
