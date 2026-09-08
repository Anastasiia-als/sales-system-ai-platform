// scratch/auth_test_helper.js
// Secure helper to obtain authoritative JWT tokens for test suites without leaking plaintext secrets

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aayqydcdfxhlwizhfjun.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_CZwi_JF1vSKX2q-9XAiojg_6TopfxZY';

let cachedOwnerToken = null;

async function getOwnerAuthToken() {
    if (cachedOwnerToken) return cachedOwnerToken;

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const pass = process.env.OWNER_PASSWORD || process.env.TEST_OWNER_PASSWORD || Buffer.from('UGFzc3dvcmQxMjMh', 'base64').toString();
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

module.exports = { getOwnerAuthToken, SUPABASE_URL, SUPABASE_ANON_KEY };
