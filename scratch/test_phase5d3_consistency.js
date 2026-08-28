const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function runTests() {
    await client.connect();
    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${message}`);
            failed++;
        }
    }

    try {
        await client.query("BEGIN");
        await client.query("SET LOCAL role TO authenticated");
        await client.query(`SET LOCAL request.jwt.claims TO '{"sub":"27852879-0d5f-4c72-889d-69a0989302d2"}'`);

        // 1. Get raw project data to establish ground truth
        const projectsRes = await client.query("SELECT id, organization_id, status FROM projects");
        const projects = projectsRes.rows;
        
        const orgsRes = await client.query("SELECT id, name FROM organizations");
        const orgs = orgsRes.rows;

        // 2. Call Analytics RPC
        const analyticsRes = await client.query(`SELECT get_portfolio_analytics_data('30d', null, null, null, null, null) AS data`);
        const analytics = analyticsRes.rows[0].data;
        
        // 3. Call Reports RPC for Client Report
        const clientReportRes = await client.query(`SELECT get_reports_data('client_report', '30d', null, null, null, null, null, null, null) AS data`);
        const clientReport = clientReportRes.rows[0].data.report.clients;

        // --- Test 1: Project Counts in Client Report vs Canonical DB ---
        const testOrgBeta = orgs.find(o => o.name === 'Test Org Beta (Phase 1B)');
        if (testOrgBeta) {
            const orgProjects = projects.filter(p => p.organization_id === testOrgBeta.id);
            const activeCount = orgProjects.filter(p => ['in_progress', 'discovery', 'onboarding', 'waiting_client', 'client_review'].includes(p.status)).length;
            const completedCount = orgProjects.filter(p => p.status === 'completed').length;
            
            const clientReportRow = clientReport.find(c => c.id === testOrgBeta.id);
            
            if (orgProjects.length > 0) {
                assert(clientReportRow !== undefined, `Test Org Beta should be present in Client Report`);
                assert(clientReportRow.active_projects_count === activeCount, `Active projects for Test Org Beta matches canonical (${clientReportRow.active_projects_count} === ${activeCount})`);
                assert(clientReportRow.completed_projects_count === completedCount, `Completed projects for Test Org Beta matches canonical (${clientReportRow.completed_projects_count} === ${completedCount})`);
            } else {
                console.log(`No projects for Test Org Beta, skipping specific count check.`);
            }
        }

        // --- Test 2: Finance Summary Consistency ---
        const financeReportRes = await client.query(`SELECT get_reports_data('finance_summary', '30d', null, null, null, null, null, null, null) AS data`);
        const financeAnalytics = financeReportRes.rows[0].data.report.financial_analytics;

        const czkFinance = financeAnalytics['CZK'];
        if (czkFinance) {
            const invoiced = czkFinance.invoiced_minor;
            const received = czkFinance.received_minor;
            const outstanding = czkFinance.outstanding_minor;
            
            const expectedOutstanding = Math.max(0, invoiced - received);
            assert(outstanding === expectedOutstanding, `CZK Outstanding (${outstanding}) perfectly equals Invoiced (${invoiced}) - Received (${received}) = ${expectedOutstanding}`);
        } else {
            console.log(`No CZK finances found, skipping CZK finance check.`);
        }

        // --- Test 3: PM Workload Consistency ---
        const pmReportRes = await client.query(`SELECT get_reports_data('pm_workload', '30d', null, null, null, null, null, null, null) AS data`);
        const teamWorkload = pmReportRes.rows[0].data.report.team_workload;
        
        const pmTesterAlpha = teamWorkload.find(pm => pm.email === 'pm.alpha@firstwin.test' || pm.full_name?.includes('PM Tester Alpha'));
        if (pmTesterAlpha) {
            assert(pmTesterAlpha.active_projects !== undefined, `PM Tester Alpha has active_projects field (${pmTesterAlpha.active_projects})`);
            assert(pmTesterAlpha.open_tasks !== undefined, `PM Tester Alpha has open_tasks field (${pmTesterAlpha.open_tasks})`);
        }

        await client.query("COMMIT");
        console.log(`\nConsistency Test Results: ${passed} Passed, ${failed} Failed`);
        
    } catch (e) {
        console.error("Test execution failed:", e);
    } finally {
        await client.end();
    }
}

runTests();
