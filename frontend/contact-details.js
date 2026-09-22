(() => {
  const section = document.querySelector('.contact-details');
  const status = document.getElementById('contact-details-status');
  const verification = document.getElementById('contact-details-verification');
  const buttons = [...section.querySelectorAll('[data-reveal]')];
  let busy = false;

  for (const button of buttons) {
    button.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      button.dataset.loading = 'true';
      buttons.forEach(item => { item.disabled = true; });
      section.setAttribute('aria-busy', 'true');
      status.hidden = true;
      const kind = button.dataset.reveal;
      let widgetId;
      let finished = false;
      let posting = false;

      function finish(failed = false) {
        if (finished) return;
        finished = true;
        if (widgetId !== undefined) window.turnstile.remove(widgetId);
        verification.hidden = true;
        busy = false;
        delete button.dataset.loading;
        buttons.forEach(item => { item.disabled = false; });
        section.removeAttribute('aria-busy');
        if (failed) {
          status.textContent = 'Contact details are unavailable. Please use the form below.';
          status.hidden = false;
        }
      }

      try {
        const { siteKey } = await window.dimundiVerificationReady;
        verification.hidden = false;
        widgetId = window.turnstile.render('#contact-details-verification', {
          sitekey: siteKey,
          action: `contact_${kind}`,
          theme: document.documentElement.dataset.theme || 'auto',
          size: verification.clientWidth < 300 ? 'compact' : 'flexible',
          appearance: 'interaction-only',
          'response-field': false,
          callback: async token => {
            if (finished || posting) return;
            posting = true;
            try {
              const response = await fetch('/api/contact-data', {
                method: 'POST',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind, turnstileToken: token }),
                signal: AbortSignal.timeout(15000),
              });
              if (!response.ok) throw new Error('Contact details unavailable');
              const { value } = await response.json();
              if (typeof value !== 'string' || !value.trim()) throw new Error('Missing contact detail');
              if (finished) return;
              const link = section.querySelector(`[data-contact-${kind}]`);
              link.textContent = value;
              link.href = kind === 'email' ? `mailto:${value}` : `tel:${value.replace(/[^+\d]/g, '')}`;
              link.hidden = false;
              button.hidden = true;
              window.dimundiTrack?.('contact_reveal', { kind });
              finish();
              link.focus();
            } catch {
              finish(true);
            }
          },
          'expired-callback': () => { if (!posting) finish(true); },
          'timeout-callback': () => { if (!posting) finish(true); },
          'error-callback': () => { if (!posting) finish(true); },
        });
      } catch {
        finish(true);
      }
    });
  }
})();
