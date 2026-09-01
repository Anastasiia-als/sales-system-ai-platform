const fs = require("fs");
const file = "js/portal/ui/portal-automation-view.js";
let content = fs.readFileSync(file, "utf8");

const oldLoadRegex = /async loadData\(\) \{[\s\S]*?renderRules\(\) \{/;

const newLoad = `async loadData() {
        try {
            const [rulesRes, blockersRes, projectRes, logsRes] = await Promise.all([
                window.DataClient.supabase.from("automation_rules").select("*").eq("project_id", this.projectId).order("created_at"),
                window.DataClient.supabase.from("project_blockers").select("*").eq("project_id", this.projectId).order("created_at", { ascending: false }),
                window.DataClient.supabase.from("projects").select("health_status, derived_health_reasons, sla_policy, target_completion_date, sla_breach_threshold_percent").eq("id", this.projectId).single(),
                window.DataClient.supabase.from("automation_execution_events").select("*").eq("project_id", this.projectId).order("evaluated_at", { ascending: false }).limit(20)
            ]);
            
            this.rules = rulesRes.data || [];
            this.blockers = blockersRes.data || [];
            this.projectInfo = projectRes.data || {};
            this.logs = logsRes.data || [];
            
            this.renderRules();
            this.renderBlockers();
            this.renderHealthAndSLA();
            this.renderLogs();
        } catch (e) {
            console.error("Failed to load automation data:", e);
        }
    }
    
    renderHealthAndSLA() {
        const healthDiv = document.getElementById("health-details");
        if (healthDiv && this.projectInfo) {
            const h = this.projectInfo.health_status || "on_track";
            const badgeCls = h === "on_track" ? "bg-green-100 text-green-800" : (h === "at_risk" ? "bg-yellow-100 text-yellow-800" : (h === "blocked" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"));
            
            let reasonsHtml = "";
            if (this.projectInfo.derived_health_reasons && this.projectInfo.derived_health_reasons.length > 0) {
                reasonsHtml = \`<ul class="list-disc pl-5 mt-2 text-sm text-gray-600">\` + 
                    this.projectInfo.derived_health_reasons.map(r => \`<li>\${r.reason || r.type || JSON.stringify(r)}</li>\`).join("") + 
                    \`</ul>\`;
            } else {
                reasonsHtml = \`<p class="text-sm text-gray-500 mt-2">Немає активних загроз.</p>\`;
            }
            
            healthDiv.innerHTML = \`<div class="mb-2"><span class="px-2 py-1 rounded text-sm font-semibold \${badgeCls}">\${h.toUpperCase()}</span></div>\${reasonsHtml}\`;
        }
        
        const slaDiv = document.getElementById("sla-details");
        if (slaDiv && this.projectInfo) {
            if (!this.projectInfo.sla_policy) {
                slaDiv.innerHTML = \`<p class="text-sm text-gray-500">SLA Policy не задано.</p>\`;
            } else {
                const deadline = this.projectInfo.target_completion_date ? new Date(this.projectInfo.target_completion_date).toLocaleDateString() : "N/A";
                slaDiv.innerHTML = \`
                    <p class="text-sm mb-1"><strong>Policy:</strong> \${this.projectInfo.sla_policy}</p>
                    <p class="text-sm mb-1"><strong>Deadline:</strong> \${deadline}</p>
                    <p class="text-sm mb-1"><strong>Breach Threshold:</strong> \${this.projectInfo.sla_breach_threshold_percent || 100}%</p>
                \`;
            }
        }
    }
    
    renderLogs() {
        const logDiv = document.getElementById("execution-log");
        if (!logDiv) return;
        
        if (this.logs.length === 0) {
            logDiv.innerHTML = \`<div class="text-center text-gray-500 py-4">Немає записів</div>\`;
            return;
        }
        
        logDiv.innerHTML = this.logs.map(l => {
            const statusColor = l.result === "success" ? "text-green-600" : "text-red-600";
            return \`
            <div class="p-3 border rounded text-sm bg-gray-50 mb-2">
                <div class="flex justify-between mb-1">
                    <span class="font-semibold">\${new Date(l.evaluated_at).toLocaleString()}</span>
                    <span class="font-bold \${statusColor}">\${l.result.toUpperCase()}</span>
                </div>
                <div class="mb-1"><span class="font-medium">Rule ID:</span> \${l.rule_id}</div>
                <div class="mb-1"><span class="font-medium">Trigger:</span> \${l.trigger_event}</div>
                <div class="text-xs text-gray-500 break-all">Idemp: \${l.idempotency_key}</div>
                \${l.error_summary ? \`<div class="text-xs text-red-500 mt-1">Error: \${l.error_summary}</div>\` : ""}
            </div>\`;
        }).join("");
    }

    renderRules() {`;

content = content.replace(oldLoadRegex, newLoad);
fs.writeFileSync(file, content);
console.log("Patched portal-automation-view.js loadData");

