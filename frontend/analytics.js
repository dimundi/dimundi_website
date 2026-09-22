(() => {
  'use strict';
  const id = 'G-BLCYHLE5Z3';
  const storageKey = 'dimundi-analytics-consent-v1';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  const production = location.hostname === 'dimundi.com';
  const paths = new Set(['/', '/about', '/solutions', '/contact', '/snake']);
  const allowedEvents = new Set(['generate_lead', 'contact_reveal', 'snake_start', 'snake_level_complete', 'snake_complete']);
  let consent = null;
  let initialized = false;
  let pageSent = false;
  let banner;

  function readConsent() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && ['granted', 'denied'].includes(saved.value) && saved.expires > Date.now()) return saved.value;
    } catch { /* Storage may be blocked. Keep analytics disabled by default. */ }
    return null;
  }

  function command() { window.dataLayer.push(arguments); }
  const denied = { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
  function startAnalytics() {
    if (!production || !paths.has(location.pathname) || consent !== 'granted') return;
    window[`ga-disable-${id}`] = false;
    if (!initialized) {
      initialized = true;
      window.dataLayer = window.dataLayer || [];
      command('consent', 'default', denied);
      command('consent', 'update', { ...denied, analytics_storage: 'granted' });
      command('js', new Date());
      command('config', id, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: `https://dimundi.com${location.pathname}`,
        page_referrer: safeReferrer(),
        cookie_domain: 'dimundi.com', cookie_path: '/', cookie_expires: lifetime / 1000,
      });
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
      document.head.append(script);
    } else command('consent', 'update', { ...denied, analytics_storage: 'granted' });
    if (!pageSent) {
      pageSent = true;
      command('event', 'page_view', { page_location: `https://dimundi.com${location.pathname}`, page_referrer: safeReferrer() });
    }
  }

  function safeReferrer() {
    try { return new URL(document.referrer).origin; } catch { return ''; }
  }

  function clearCookies() {
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.split('=')[0].trim();
      if (name !== '_ga' && name !== `_ga_${id.slice(2)}`) continue;
      for (const domain of ['', '; Domain=dimundi.com', '; Domain=.dimundi.com']) {
        document.cookie = `${name}=; Max-Age=0; Path=/${domain}; SameSite=Lax; Secure`;
      }
    }
  }

  function applyConsent(value) {
    consent = value;
    if (value === 'granted') startAnalytics();
    else {
      window[`ga-disable-${id}`] = true;
      if (initialized) command('consent', 'update', denied);
      clearCookies();
    }
  }

  function choose(value) {
    try { localStorage.setItem(storageKey, JSON.stringify({ value, expires: Date.now() + lifetime })); } catch { /* Session-only choice. */ }
    applyConsent(value);
    banner.hidden = true;
    document.querySelector('[data-analytics-settings]')?.focus({ preventScroll: true });
  }

  // Only fixed event names and numeric game progress can reach GA4. Never send
  // form values, contact details, verification tokens or full URLs/referrers.
  window.dimundiTrack = (name, values = {}) => {
    if (consent !== 'granted' || !initialized || !allowedEvents.has(name)) return;
    const params = {};
    if (name === 'contact_reveal' && ['email', 'phone'].includes(values.kind)) params.contact_method = values.kind;
    if (name.startsWith('snake_')) {
      if (Number.isInteger(values.level) && values.level >= 1 && values.level <= 9) params.level = values.level;
      if (Number.isInteger(values.score) && values.score >= 0 && values.score <= 2160) params.score = values.score;
    }
    command('event', name, params);
  };

  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    applyConsent(readConsent());
    if (banner) banner.hidden = consent !== null;
  });

  // Consent UI is initialized after the shared footer exists (deferred script).
  const settings = document.querySelector('[data-analytics-settings]');
  banner = document.getElementById('analytics-consent');
  if (!banner || !settings) return;
  settings.hidden = false;
  settings.addEventListener('click', () => {
    banner.hidden = false;
    banner.querySelector('button').focus({ preventScroll: true });
  });
  banner.querySelector('[data-analytics-accept]').addEventListener('click', () => choose('granted'));
  banner.querySelector('[data-analytics-reject]').addEventListener('click', () => choose('denied'));
  applyConsent(readConsent());
  banner.hidden = consent !== null;
})();
