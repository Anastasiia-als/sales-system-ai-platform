const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });

async function run() {
    const vRes = await pool.query(`SELECT v.id FROM public.template_versions v LIMIT 1`);
    const vId = vRes.rows[0].id;
    const orgRes = await pool.query(`SELECT id FROM public.organizations LIMIT 1`);
    const orgId = orgRes.rows[0].id;
    const idempKey = "test-idem-pool-" + Date.now();
    
    // We must pass the params inline for the multiple statements to work, 
    // but pg prevents array params in multi-statement queries.
    // So we'll use a single transaction string with inline params (safe for test).
    
    const payloadQuery = `
        SET LOCAL role TO authenticated;
        SET LOCAL request.jwt.claims TO '{"sub":"27852879-0d5f-4c72-889d-69a0989302d2"}';
        SELECT create_project_from_template(
            '${vId}', '${orgId}', 'Idempotency Test', 'consulting', '2026-09-01', '2026-09-30', 
            null, null, '${idempKey}'
        ) AS res;
    `;

    console.log("Sending two parallel creation requests with same idempotency key...");
    
    const c1 = await pool.connect();
    const c2 = await pool.connect();

    let createdProjId = null;
    try {
        const req1 = c1.query(payloadQuery);
        const req2 = c2.query(payloadQuery);

        const results = await Promise.allSettled([req1, req2]);
        
        let successCount = 0;
        let rejectCount = 0;
        results.forEach((r, i) => {
            if (r.status === 'fulfilled') {
                // Because it's a multi-statement query, r.value is an array of results
                const resData = Array.isArray(r.value) ? r.value[r.value.length - 1] : r.value;
                const data = resData.rows[0].res;
                console.log(`Request ${i+1}:`, data);
                if (data.success) {
                    successCount++;
                    createdProjId = data.project_id;
                } else rejectCount++;
            } else {
                console.log(`Request ${i+1} Exception:`, r.reason.message);
                rejectCount++;
            }
        });

        console.log(`Successes: ${successCount}, Rejections: ${rejectCount}`);
        if (successCount === 1 && rejectCount === 1) {
            console.log("Idempotency Test PASSED!");
        } else {
            console.error("Idempotency Test FAILED!");
        }
    } finally {
        if (createdProjId) {
            try {
                await pool.query("UPDATE public.projects SET status = 'archived' WHERE id = $1", [createdProjId]);
            } catch (e) {}
        }
        c1.release();
        c2.release();
        await pool.end();
    }
}
run();
