const fs = require('fs');

const files = fs.readdirSync('scratch').filter(f => f.startsWith('test_phase6c_') && f.endsWith('.js'));
for(const f of files) {
  let code = fs.readFileSync('scratch/' + f, 'utf8');
  if(code.includes('await pool.query(') && !code.includes('session_replication_role')) {
    const cleanup = `
        try {
            await pool.query("SET session_replication_role = 'replica';");
            await pool.query("DELETE FROM automation_execution_events WHERE rule_id IN (SELECT id FROM automation_rules WHERE name ILIKE '%Test%' OR name ILIKE '%Loop%' OR name ILIKE '%Auto%' OR name ILIKE '%SLA%' OR name ILIKE '%Escalation%') OR project_id IN (SELECT id FROM projects WHERE name ILIKE '%Test%' OR name ILIKE '%Rule%' OR name ILIKE '%Loop%' OR name ILIKE '%SLA%');");
            await pool.query("DELETE FROM automation_rules WHERE name ILIKE '%Test%' OR name ILIKE '%Loop%' OR name ILIKE '%Auto%' OR name ILIKE '%SLA%' OR name ILIKE '%Escalation%' OR name = 'Rule1' OR name = 'Rule2' OR name = 'Rule3';");
            await pool.query("DELETE FROM projects WHERE name ILIKE '%Test%' OR name ILIKE '%Rule%' OR name ILIKE '%Loop%' OR name ILIKE '%SLA%';");
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {}
`;
    code = code.replace(/finally\s*\{/, 'finally {' + cleanup);
    fs.writeFileSync('scratch/' + f, code, 'utf8');
    console.log('Patched ' + f);
  }
}
