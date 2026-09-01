const fs = require('fs');
let code = fs.readFileSync('js/portal/ui/portal-rule-builder-ui.js', 'utf8');

const target = `    let orgId = PortalAuth.getUser()?.user_metadata?.org_id || PortalAuth.getProfile()?.organization_id;
    if (!orgId) {
        const u = await supabase.auth.getUser();
        if(u.data?.user?.id) {
            const p = await supabase.from("profiles").select("organization_id").eq("id", u.data.user.id).single();
            orgId = p.data?.organization_id;
        }
    }
    if(!orgId) {
        const orgReq = await supabase.from("organizations").select("id").limit(1).single();
        if(orgReq.data) orgId = orgReq.data.id;
        else orgId = "mock-org"; console.log("Fetched orgId builder:", orgId);
        }
    }`;

const replacement = `    let orgId = PortalAuth.getUser()?.user_metadata?.org_id || PortalAuth.getProfile()?.organization_id;
    if (!orgId) {
        const u = await supabase.auth.getUser();
        if(u.data?.user?.id) {
            const p = await supabase.from("profiles").select("organization_id").eq("id", u.data.user.id).single();
            orgId = p.data?.organization_id;
        }
    }
    if(!orgId) {
        const orgReq = await supabase.from("organizations").select("id").limit(1).single();
        if(orgReq.data) orgId = orgReq.data.id;
        else orgId = "mock-org"; 
        console.log("Fetched orgId builder:", orgId);
    }`;

code = code.replace(target, replacement);
fs.writeFileSync('js/portal/ui/portal-rule-builder-ui.js', code, 'utf8');
