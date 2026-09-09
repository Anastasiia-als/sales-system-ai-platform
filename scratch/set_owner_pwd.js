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

    const ownerPassword = process.env.OWNER_PASSWORD;
    if (!ownerPassword) {
        throw new Error("OWNER_PASSWORD environment variable is not defined");
    }

    // Set Owner test password from environment variable
    await c.query(`
        UPDATE auth.users
        SET encrypted_password = crypt($1, gen_salt('bf', 10)),
            email_confirmed_at = NOW(),
            updated_at = NOW()
        WHERE email = 'anzaitseva96@gmail.com';
    `, [ownerPassword]);
    console.log("✔ Owner password set from environment variable.");
    await c.end();
}

main().catch(console.error);
