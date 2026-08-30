const fs = require('fs');
const cp = require('child_process');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C SLA Engine Test...");
    let exitCode = 0;
    try {
        // Test add_business_days
        // Friday, 2026-08-28 10:00:00 -> Add 1 business day -> Should be Monday, 2026-08-31 10:00:00
        
        const res1 = await pool.query(`SELECT public.add_business_days('2026-08-28 10:00:00+00'::timestamptz, 1, 'UTC') as result`);
        const dt1 = new Date(res1.rows[0].result);
        console.log("Add 1 biz day to Friday:", dt1.toISOString());
        
        if (dt1.getUTCDay() === 1 && dt1.getUTCDate() === 31) {
            console.log("?\" PASS: Skipped weekend successfully.");
        } else {
            console.error("?? FAIL: Did not skip weekend correctly. Got:", dt1.toISOString());
            exitCode = 1;
        }

        // Friday, 2026-08-28 10:00:00 -> Add 5 business days -> Should be Friday, 2026-09-04 10:00:00
        const res5 = await pool.query(`SELECT public.add_business_days('2026-08-28 10:00:00+00'::timestamptz, 5, 'UTC') as result`);
        const dt5 = new Date(res5.rows[0].result);
        console.log("Add 5 biz days to Friday:", dt5.toISOString());
        
        if (dt5.getUTCDay() === 5 && dt5.getUTCDate() === 4 && dt5.getUTCMonth() === 8) {
            console.log("?\" PASS: Skipped weekend for 5 days properly.");
        } else {
            console.error("?? FAIL: Did not skip weekend for 5 days correctly. Got:", dt5.toISOString());
            exitCode = 1;
        }

    } catch (e) {
        console.error("FATAL ERROR:", e);
        exitCode = 1;
    } finally {
        pool.end();
        process.exit(exitCode);
    }
}
run();
