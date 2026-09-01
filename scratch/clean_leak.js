const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });
async function clean() {
    await pool.query("SET session_replication_role = 'replica';");
    await pool.query("DELETE FROM automation_rules WHERE name = 'RuleCA' OR (name = 'Rule' AND created_at > now() - interval '1 day')");
    await pool.query("DELETE FROM automation_execution_events WHERE rule_id NOT IN (SELECT id FROM automation_rules)");
    await pool.query("SET session_replication_role = 'origin';");
    const res = await pool.query("SELECT name FROM automation_rules");
    console.log("Remaining rules:", res.rows.length);
    pool.end();
}
clean();
