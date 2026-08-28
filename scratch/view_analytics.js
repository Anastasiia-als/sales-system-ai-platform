const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function runTests() {
    await client.connect();
    try {
        await client.query("BEGIN");
        await client.query("SET LOCAL role TO authenticated");
        await client.query("SET LOCAL request.jwt.claims TO '{\"sub\":\"27852879-0d5f-4c72-889d-69a0989302d2\"}'");

        const res = await client.query("SELECT get_portfolio_analytics_data('30d') AS data");
        const reportsRes = await client.query("SELECT get_reports_data('client_report') AS data");
        console.log(JSON.stringify({ 
            analytics: res.rows[0].data,
            client_report: reportsRes.rows[0].data.report.clients
        }, null, 2));
        
        await client.query("COMMIT");
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
runTests();
