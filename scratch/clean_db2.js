const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });

async function run() {
    try {
        await pool.query("SET session_replication_role = 'replica';"); // DISBALE TRIGGERS!
        
        const execRes = await pool.query(`
            DELETE FROM automation_execution_events 
            WHERE rule_id IN (
                SELECT id FROM automation_rules WHERE name ILIKE '%Test%' 
                OR name ILIKE '%Loop%' OR name ILIKE '%RuleCA%' 
                OR name ILIKE '%Escalation%' OR name ILIKE '%SLA%' OR name ILIKE '%Auto%'
                OR name = 'Rule1' OR name = 'Rule2' OR name = 'Rule3'
                OR name = 'Test Rule 1' OR name = 'Test Global Rule'
            ) OR project_id IN (
                SELECT id FROM projects WHERE name ILIKE '%Test%' OR name ILIKE '%Rule%'
                OR name ILIKE '%Loop%' OR name ILIKE '%SLA%'
            );
        `);
        console.log(`Deleted ${execRes.rowCount} execution events.`);
        
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
        
        const projRes = await pool.query(`
            DELETE FROM projects
            WHERE name ILIKE '%Test%'
               OR name ILIKE '%Rule%'
               OR name ILIKE '%Loop%'
               OR name ILIKE '%SLA%'
            RETURNING id;
        `);
        console.log(`Deleted ${projRes.rowCount} projects.`);
        
        await pool.query("SET session_replication_role = 'origin';");
    } catch(e) {
        console.error(e);
    }
    pool.end();
}
run();
