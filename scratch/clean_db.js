const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });

async function run() {
    console.log("Cleaning up global automation rules created by tests...");
    
    // Delete known global/project test rules
    const rulesRes = await pool.query(`
        DELETE FROM automation_rules
        WHERE name ILIKE '%Test%' 
           OR name ILIKE '%Loop%' 
           OR name ILIKE '%RuleCA%'
           OR name ILIKE '%Escalation%'
           OR name ILIKE '%SLA%'
           OR name ILIKE '%Auto%'
           OR name = 'Rule1'
           OR name = 'Rule2'
           OR name = 'Rule3'
           OR name = 'Test Rule 1'
           OR name = 'Test Global Rule'
        RETURNING id;
    `);
    console.log(`Deleted ${rulesRes.rowCount} automation_rules.`);
    
    // Delete projects created by tests (Cascade will delete their rules/logs/stages)
    const projRes = await pool.query(`
        DELETE FROM projects
        WHERE name ILIKE '%Test%'
           OR name ILIKE '%Rule%'
           OR name ILIKE '%Loop%'
           OR name ILIKE '%SLA%'
        RETURNING id;
    `);
    console.log(`Deleted ${projRes.rowCount} projects.`);
    
    pool.end();
}
run();
