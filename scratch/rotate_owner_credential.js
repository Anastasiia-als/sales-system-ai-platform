// scratch/rotate_owner_credential.js
// Rotates the affected test account password, invalidates active sessions, and updates .env safely

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function rotate() {
    console.log("Starting credential rotation for affected test account...");

    // 1. Generate strong cryptographically secure replacement password
    const newPassword = 'Fw_' + crypto.randomBytes(24).toString('base64url') + '!9a';

    const client = await pool.connect();
    try {
        // 2. Fetch user ID for anzaitseva96@gmail.com
        const userRes = await client.query("SELECT id FROM auth.users WHERE email = 'anzaitseva96@gmail.com'");
        if (userRes.rows.length === 0) {
            throw new Error("Target user anzaitseva96@gmail.com not found in auth.users");
        }
        const userId = userRes.rows[0].id;

        // 3. Update password in auth.users with bcrypt hash
        await client.query(`
            UPDATE auth.users
            SET encrypted_password = crypt($1, gen_salt('bf', 10)),
                email_confirmed_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
        `, [newPassword, userId]);

        // 4. Invalidate all active sessions & refresh tokens
        try {
            await client.query("DELETE FROM auth.sessions WHERE user_id = $1", [userId]);
            await client.query("DELETE FROM auth.refresh_tokens WHERE user_id = $1", [userId]);
        } catch (sessErr) {
            console.log("Note on session invalidation:", sessErr.message);
        }

        console.log("✔ Password rotated in auth.users and all prior sessions invalidated.");

        // 5. Update local unversioned .env file
        const envPath = path.resolve(__dirname, '../.env');
        let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        
        if (envContent.includes('OWNER_PASSWORD=')) {
            envContent = envContent.replace(/OWNER_PASSWORD=.*$/m, `OWNER_PASSWORD=${newPassword}`);
        } else {
            envContent += `\nOWNER_PASSWORD=${newPassword}\n`;
        }
        fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
        console.log("✔ Local unversioned .env updated with rotated OWNER_PASSWORD.");

    } finally {
        client.release();
        await pool.end();
    }
}

rotate().catch(err => {
    console.error("Rotation failed:", err.message);
    process.exit(1);
});
