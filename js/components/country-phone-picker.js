// js/components/country-phone-picker.js - International Country Code Selector for Phone Inputs

export const COUNTRIES = [
  { code: 'UA', name: 'Україна', dial: '+380', flag: '🇺🇦', placeholder: '(__) ___-__-__' },
  { code: 'PL', name: 'Польща', dial: '+48', flag: '🇵🇱', placeholder: '(___) ___-___' },
  { code: 'DE', name: 'Німеччина', dial: '+49', flag: '🇩🇪', placeholder: '(___) _______' },
  { code: 'US', name: 'США / Канада', dial: '+1', flag: '🇺🇸', placeholder: '(___) ___-____' },
  { code: 'GB', name: 'Велика Британія', dial: '+44', flag: '🇬🇧', placeholder: '____ ______' },
  { code: 'CZ', name: 'Чехія', dial: '+420', flag: '🇨🇿', placeholder: '___ ___ ___' },
  { code: 'SK', name: 'Словаччина', dial: '+421', flag: '🇸🇰', placeholder: '___ ___ ___' },
  { code: 'RO', name: 'Румунія', dial: '+40', flag: '🇷🇴', placeholder: '___ ___ ___' },
  { code: 'MD', name: 'Молдова', dial: '+373', flag: '🇲🇩', placeholder: '___ _____' },
  { code: 'ES', name: 'Іспанія', dial: '+34', flag: '🇪🇸', placeholder: '___ ___ ___' },
  { code: 'IT', name: 'Італія', dial: '+39', flag: '🇮🇹', placeholder: '___ _______' },
  { code: 'FR', name: 'Франція', dial: '+33', flag: '🇫🇷', placeholder: '_ __ __ __ __' },
  { code: 'PT', name: 'Португалія', dial: '+351', flag: '🇵🇹', placeholder: '___ ___ ___' },
  { code: 'AT', name: 'Австрія', dial: '+43', flag: '🇦🇹', placeholder: '___ _______' },
  { code: 'CH', name: 'Швейцарія', dial: '+41', flag: '🇨🇭', placeholder: '__ ___ __ __' },
  { code: 'NL', name: 'Нідерланди', dial: '+31', flag: '🇳🇱', placeholder: '_ ________' },
  { code: 'BE', name: 'Бельгія', dial: '+32', flag: '🇧🇪', placeholder: '___ __ __ __' },
  { code: 'IE', name: 'Ірландія', dial: '+353', flag: '🇮🇪', placeholder: '__ _______' },
  { code: 'LT', name: 'Литва', dial: '+370', flag: '🇱🇹', placeholder: '(___) _____' },
  { code: 'LV', name: 'Латвія', dial: '+371', flag: '🇱🇻', placeholder: '____ ____' },
  { code: 'EE', name: 'Естонія', dial: '+372', flag: '🇪🇪', placeholder: '____ ____' },
  { code: 'GE', name: 'Грузія', dial: '+995', flag: '🇬🇪', placeholder: '___ __ __ __' },
  { code: 'AZ', name: 'Азербайджан', dial: '+994', flag: '🇦🇿', placeholder: '__ ___ __ __' },
  { code: 'KZ', name: 'Казахстан', dial: '+7', flag: '🇰🇿', placeholder: '(___) ___-__-__' },
  { code: 'AE', name: 'ОАЕ', dial: '+971', flag: '🇦🇪', placeholder: '_ ___ ____' },
  { code: 'TR', name: 'Туреччина', dial: '+90', flag: '🇹🇷', placeholder: '(___) ___-____' },
  { code: 'CY', name: 'Кіпр', dial: '+357', flag: '🇨🇾', placeholder: '__ ______' },
  { code: 'IL', name: 'Ізраїль', dial: '+972', flag: '🇮🇱', placeholder: '__-_______' },
  { code: 'OTHER', name: 'Інша країна', dial: '+', flag: '🌐', placeholder: 'код та номер' }
];

export function setupCountryPhonePicker({
  wrapEl,
  inputEl,
  defaultCountryCode = 'UA',
  onChange
}) {
  if (!wrapEl || !inputEl || wrapEl.dataset.countryPickerReady === 'true') return null;
  wrapEl.dataset.countryPickerReady = 'true';

  let currentCountry = COUNTRIES.find(c => c.code === defaultCountryCode) || COUNTRIES[0];

  // Remove existing static badge if present
  const oldFlag = wrapEl.querySelector('.hero-express-phone-flag, .bottom-lead-phone-flag, .quick-country-flag');
  if (oldFlag) oldFlag.remove();

  // Create button trigger
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'country-picker-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  btn.title = 'Обрати країну';

  function updateBtnDisplay() {
    btn.innerHTML = `
      <span class="country-picker-flag">${currentCountry.flag}</span>
      <span class="country-picker-dial">${currentCountry.dial}</span>
      <i data-lucide="chevron-down" class="country-picker-chevron"></i>
    `;
    if (window.lucide) window.lucide.createIcons();
    inputEl.placeholder = currentCountry.placeholder || '(___) ___-____';
  }

  updateBtnDisplay();
  wrapEl.insertBefore(btn, inputEl);

  // Create dropdown menu
  const menu = document.createElement('div');
  menu.className = 'country-picker-menu';
  menu.style.display = 'none';
  menu.innerHTML = `
    <div class="country-picker-search-wrap">
      <i data-lucide="search" class="country-picker-search-icon"></i>
      <input type="text" class="country-picker-search" placeholder="Пошук країни або коду..." autocomplete="off">
    </div>
    <div class="country-picker-list" role="listbox"></div>
  `;
  wrapEl.appendChild(menu);

  const searchInput = menu.querySelector('.country-picker-search');
  const listEl = menu.querySelector('.country-picker-list');

  function renderList(query = '') {
    const q = query.trim().toLowerCase();
    const filtered = COUNTRIES.filter(c => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.code.toLowerCase().includes(q)
      );
    });

    if (!filtered.length) {
      listEl.innerHTML = `<div class="country-picker-empty">Країну не знайдено</div>`;
      return;
    }

    listEl.innerHTML = filtered.map(c => `
      <div class="country-picker-item ${c.code === currentCountry.code ? 'is-selected' : ''}" data-code="${c.code}">
        <span class="country-item-flag">${c.flag}</span>
        <span class="country-item-name">${c.name}</span>
        <span class="country-item-dial">${c.dial}</span>
      </div>
    `).join('');

    listEl.querySelectorAll('.country-picker-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = item.dataset.code;
        const selected = COUNTRIES.find(c => c.code === code);
        if (selected) {
          selectCountry(selected);
        }
      });
    });
  }

  function openMenu() {
    menu.style.display = 'flex';
    btn.setAttribute('aria-expanded', 'true');
    btn.classList.add('is-open');
    if (searchInput) {
      searchInput.value = '';
      renderList('');
      setTimeout(() => searchInput.focus(), 50);
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function closeMenu() {
    menu.style.display = 'none';
    btn.setAttribute('aria-expanded', 'false');
    btn.classList.remove('is-open');
  }

  function selectCountry(country) {
    currentCountry = country;
    updateBtnDisplay();
    closeMenu();
    inputEl.focus();
    if (typeof onChange === 'function') {
      onChange(currentCountry);
    }
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.style.display === 'none') {
      openMenu();
    } else {
      closeMenu();
    }
  });

  searchInput?.addEventListener('input', (e) => {
    renderList(e.target.value);
  });

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
      btn.focus();
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!wrapEl.contains(e.target)) {
      closeMenu();
    }
  });

  // Close on Escape key globally
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.style.display !== 'none') {
      closeMenu();
    }
  });

  // Auto-detect country if user types international number with +
  inputEl.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val.startsWith('+')) {
      // Find matching country
      const match = COUNTRIES.filter(c => c.dial !== '+')
        .sort((a, b) => b.dial.length - a.dial.length)
        .find(c => val.startsWith(c.dial));
      if (match && match.code !== currentCountry.code) {
        currentCountry = match;
        updateBtnDisplay();
      }
    }
  });

  return {
    getCountry: () => currentCountry,
    getFullNumber: () => {
      const raw = inputEl.value.trim();
      if (!raw) return '';
      // If user typed + with country code already
      if (raw.startsWith('+')) {
        return raw;
      }
      const digitsOnly = raw.replace(/\D/g, '');
      const dialDigits = currentCountry.dial.replace(/\D/g, '');

      // Check if user already typed dial code without +
      if (dialDigits && digitsOnly.startsWith(dialDigits)) {
        return '+' + digitsOnly;
      }

      // If Ukrainian and started with 0 (e.g. 0501234567)
      if (currentCountry.code === 'UA' && digitsOnly.startsWith('0')) {
        return '+38' + digitsOnly;
      }

      if (currentCountry.dial === '+') {
        return '+' + digitsOnly;
      }

      return currentCountry.dial + digitsOnly;
    },
    getFormattedDisplay: () => {
      const full = inputEl.value.trim();
      return `${currentCountry.flag} ${currentCountry.name}: ${full}`;
    }
  };
}
