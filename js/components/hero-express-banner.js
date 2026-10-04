// js/components/hero-express-banner.js - Express Audit Banner (Hero Lead Capture)
import { Toast } from './notifications.js';

export const HeroExpressBanner = {
  init() {
    const form = document.getElementById('hero-express-form');
    if (!form || form.dataset.initialized === 'true') return;
    form.dataset.initialized = 'true';

    const nameInput = document.getElementById('he-name');
    const phoneInput = document.getElementById('he-phone');
    const hpInput = document.getElementById('he-hp');
    const submitBtn = document.getElementById('he-submit-btn');
    const statusMsg = document.getElementById('he-status-msg');
    const fieldsContainer = document.getElementById('he-fields-container');

    // Phone auto-prefixing & formatting
    phoneInput?.addEventListener('input', (e) => {
      let val = e.target.value;
      if (!val.startsWith('+') && /\d/.test(val)) {
        if (val.startsWith('380')) val = '+' + val;
        else if (val.startsWith('0')) val = '+38' + val;
      }
      e.target.value = val;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!nameInput || !phoneInput || !submitBtn) return;

      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      const hp = hpInput ? hpInput.value.trim() : '';

      // Honeypot check
      if (hp) {
        showSuccess(name);
        return;
      }

      if (!name) {
        showError("Будь ласка, вкажіть ваше ім'я.");
        nameInput.focus();
        return;
      }

      if (!phone || phone.replace(/\D/g, '').length < 9) {
        showError("Будь ласка, вкажіть коректний контактний номер телефону.");
        phoneInput.focus();
        return;
      }

      const originalBtnHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Надсилання...</span> <i data-lucide="loader" class="spin"></i>`;
      if (window.lucide) window.lucide.createIcons();
      if (statusMsg) statusMsg.style.display = 'none';

      const currentPath = window.location.hash || '#/';
      const payload = {
        name,
        phone,
        form_id: 'Експрес-діагностика бізнесу (Hero плашка під фото)',
        page_path: currentPath,
        utm_source: sessionStorage.getItem('ss_utm_source') || 'Прямий візит',
        utm_campaign: sessionStorage.getItem('ss_utm_campaign') || ''
      };

      try {
        // 1. Direct Telegram dispatch via Vercel Serverless API
        const notifyPromise = fetch('/api/lead-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(r => r.json()).catch(() => ({ ok: false }));

        // 2. Integration with internal Leads API (if available)
        let leadApiPromise = Promise.resolve();
        try {
          const { submitLead, newEventId } = await import('../marketing/leads-api.js');
          const { trackGenerateLead } = await import('../marketing/analytics.js');
          const eventId = newEventId ? newEventId() : 'evt_' + Date.now();
          leadApiPromise = submitLead(payload, 'hero_express_audit', 'audit', eventId)
            .then(res => {
              if (res && res.ok && res.lead_id) {
                trackGenerateLead('hero_express_audit', 'audit', eventId);
              }
            }).catch(() => {});
        } catch (_) {}

        await Promise.all([notifyPromise, leadApiPromise]);

        showSuccess(name);
      } catch (err) {
        console.error('Error submitting hero express lead:', err);
        showError("Не вдалося надіслати. Спробуйте ще раз або напишіть у Telegram @an_zaaz");
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
        if (window.lucide) window.lucide.createIcons();
      }
    });

    function showError(msg) {
      if (!statusMsg) return;
      statusMsg.className = 'hero-express-status error';
      statusMsg.innerHTML = `<i data-lucide="alert-circle"></i> <span>${msg}</span>`;
      statusMsg.style.display = 'flex';
      if (window.lucide) window.lucide.createIcons();
    }

    function showSuccess(clientName) {
      if (fieldsContainer) {
        fieldsContainer.innerHTML = `
          <div class="hero-express-success-box">
            <div class="hero-express-success-icon"><i data-lucide="check-circle-2"></i></div>
            <div class="hero-express-success-text">
              <h4>Дякую, ${escapeHtml(clientName)}! Заявку прийнято.</h4>
              <p>Сповіщення надіслано в Telegram — я зв'яжуся з вами протягом 15 хвилин для проведення експрес-аудиту.</p>
            </div>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
      if (statusMsg) statusMsg.style.display = 'none';
      Toast.success('Заявку прийнято!', 'Дані успішно надіслано експерту в Telegram.');
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }
};
