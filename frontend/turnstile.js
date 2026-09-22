// One loader shared by the form and the on-demand contact details widgets.
window.dimundiVerificationReady = (async () => {
  const response = await fetch('/api/contact-config', {
    cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Verification unavailable');
  const { siteKey } = await response.json();
  if (typeof siteKey !== 'string' || !siteKey) throw new Error('Missing site key');
  await new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Verification timeout')), 15000);
    window.dimundiTurnstileReady = () => { window.clearTimeout(timeout); resolve(); };
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=dimundiTurnstileReady&render=explicit';
    script.async = true;
    script.onerror = () => { window.clearTimeout(timeout); reject(new Error('Verification unavailable')); };
    document.head.append(script);
  });
  return { siteKey };
})();
// Consumers display their own error; avoid an unhandled rejection before a click.
window.dimundiVerificationReady.catch(() => {});
