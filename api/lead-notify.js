// api/lead-notify.js - Vercel Serverless Function to deliver Telegram notifications
// Sends new lead events directly to the owner via Telegram Bot

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8675852794:AAE8HexsMY7TgJlGm7KADx6S_M6UbFs5CPM';
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '302837239';

    if (!BOT_TOKEN || !CHAT_ID) {
      return res.status(200).json({ ok: false, reason: 'secrets_missing' });
    }

    const lead = req.body || {};

    // Ignore honeypot spam
    if (lead.website_hp) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const lines = [
      '🔔 <b>Нова заявка з сайту firstwin.pro</b>',
      '',
      lead.name ? `👤 <b>Ім'я:</b> ${escapeHtml(lead.name)}` : null,
      lead.phone ? `📞 <b>Телефон:</b> ${escapeHtml(lead.phone)}` : null,
      lead.email ? `✉️ <b>Email:</b> ${escapeHtml(lead.email)}` : null,
      lead.telegram ? `💬 <b>Telegram:</b> ${escapeHtml(lead.telegram)}` : null,
      lead.company ? `🏢 <b>Компанія:</b> ${escapeHtml(lead.company)}` : null,
      lead.niche ? `🎯 <b>Ніша:</b> ${escapeHtml(lead.niche)}` : null,
      lead.managers ? `👥 <b>Менеджерів:</b> ${escapeHtml(lead.managers)}` : null,
      lead.problem ? `⚠️ <b>Проблема:</b> ${escapeHtml(lead.problem)}` : null,
      lead.goal ? `🎯 <b>Мета:</b> ${escapeHtml(lead.goal)}` : null,
      lead.message ? `📝 <b>Повідомлення:</b> ${escapeHtml(lead.message)}` : null,
      lead.form_id ? `📋 <b>Форма:</b> ${escapeHtml(lead.form_id)}` : null,
      lead.utm_source ? `📊 <b>Джерело:</b> ${escapeHtml(lead.utm_source)} / ${escapeHtml(lead.utm_campaign || '-')}` : '📊 <b>Джерело:</b> Прямий перехід',
      `⏰ <b>Час:</b> ${new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}`
    ].filter(Boolean);

    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: lines.join('\n'),
        parse_mode: 'HTML'
      })
    });

    const tgData = await tgRes.json().catch(() => ({}));

    return res.status(200).json({
      ok: tgRes.ok,
      telegram: tgData.ok ? 'sent' : tgData.description || 'failed'
    });
  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
