// scratch/auth_test_helper.js
// Secure helper to obtain authoritative JWT tokens for test suites without leaking plaintext secrets

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aayqydcdfxhlwizhfjun.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_CZwi_JF1vSKX2q-9XAiojg_6TopfxZY';

let cachedOwnerToken = null;

function loadEnv() {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const idx = trimmed.indexOf('=');
                const k = trimmed.substring(0, idx).trim();
                const v = trimmed.substring(idx + 1).trim();
                if (!process.env[k]) {
                    process.env[k] = v;
                }
            }
        }
    }
}
loadEnv();

function getOwnerPassword() {
    loadEnv();
    return process.env.OWNER_PASSWORD;
}

async function getOwnerAuthToken() {
    if (cachedOwnerToken) return cachedOwnerToken;

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const pass = getOwnerPassword();
    if (!pass) {
        throw new Error("OWNER_PASSWORD is not configured in process.env or .env");
    }

    const { data, error } = await client.auth.signInWithPassword({
        email: 'anzaitseva96@gmail.com',
        password: pass
    });
    if (error) {
        throw new Error(`Failed to sign in as Owner: ${error.message}`);
    }
    cachedOwnerToken = data.session.access_token;
    return cachedOwnerToken;
}

module.exports = { getOwnerAuthToken, getOwnerPassword, loadEnv, SUPABASE_URL, SUPABASE_ANON_KEY };
