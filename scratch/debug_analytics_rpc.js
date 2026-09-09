const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://aayqydcdfxhlwizhfjun.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CZwi_JF1vSKX2q-9XAiojg_6TopfxZY';

async function testRpc() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await supabase.auth.signInWithPassword({
    email: 'anzaitseva96@gmail.com',
    password: process.env.OWNER_PASSWORD || process.env.OWNER_PASSWORD
  });

  const { data, error } = await supabase.rpc('get_portfolio_analytics_data', {
    p_period_type: '30d'
  });

  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
}

testRpc();
