const { Client } = require('pg');

async function main() {
    const c = new Client({
        host: 'aws-0-eu-central-1.pooler.supabase.com',
        port: 5432,
        user: 'postgres.aayqydcdfxhlwizhfjun',
        password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
        database: 'postgres',
        ssl: { rejectUnauthorized: false }
    });

    await c.connect();

    // Set Owner test password for automated verification runner
    await c.query(`
        UPDATE auth.users
        SET encrypted_password = crypt('Password123!', gen_salt('bf')),
            email_confirmed_at = NOW(),
            updated_at = NOW()
        WHERE email = 'anzaitseva96@gmail.com';
    `);
    console.log("✔ Owner password set for automated browser verification runner.");
    await c.end();
}

main().catch(console.error);
