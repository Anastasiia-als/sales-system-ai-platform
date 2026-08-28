const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });
async function run() {
    const rolesRes = await pool.query(`SELECT id, global_role FROM public.profiles WHERE global_role IN ('specialist', 'client')`);
    const specialistId = rolesRes.rows.find(r => r.global_role === 'specialist')?.id;
    const clientId = rolesRes.rows.find(r => r.global_role === 'client')?.id;
    const orgRes = await pool.query(`SELECT id FROM public.organizations LIMIT 1`);
    const orgId = orgRes.rows[0].id;
    
    let c = await pool.connect();
    await c.query(`SET LOCAL role TO authenticated; SET LOCAL request.jwt.claims TO '{"sub":"${specialistId}"}';`);
    let res = await c.query(`SELECT public.is_template_readable('${orgId}') as val`);
    console.log('Specialist with orgId', res.rows[0].val);

    res = await c.query(`SELECT public.is_template_readable(null) as val`);
    console.log('Specialist with null orgId', res.rows[0].val);

    await c.query(`SET LOCAL role TO authenticated; SET LOCAL request.jwt.claims TO '{"sub":"${clientId}"}';`);
    res = await c.query(`SELECT public.is_template_readable('${orgId}') as val`);
    console.log('Client with orgId', res.rows[0].val);

    res = await c.query(`SELECT public.is_template_readable(null) as val`);
    console.log('Client with null orgId', res.rows[0].val);

    // Let's also check their actual org memberships
    await c.query(`SET LOCAL role TO postgres`);
    let membSpec = await c.query(`SELECT * FROM public.organization_memberships WHERE user_id = '${specialistId}'`);
    console.log('Specialist Memberships', membSpec.rows);
    
    c.release();
    pool.end();
}
run();
