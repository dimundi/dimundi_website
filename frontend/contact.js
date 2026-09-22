const form = document.getElementById('contact-form');
const fields = document.getElementById('contact-fields');
const statusEl = document.getElementById('form-status');
const submitButton = form.querySelector('button[type="submit"]');
let isSending = false;
let verificationToken = '';
let widgetId;
const failureMessage = 'Unable to send your message. Please try again or email us directly.';

function invalidateVerification() {
  verificationToken = '';
  submitButton.disabled = true;
}

async function initializeVerification() {
  try {
    const { siteKey } = await window.dimundiVerificationReady;
    widgetId = window.turnstile.render('#contact-verification', {
      sitekey: siteKey,
      action: 'contact',
      theme: document.documentElement.dataset.theme || 'auto',
      size: document.getElementById('contact-verification')?.clientWidth < 300 ? 'compact' : 'flexible',
      appearance: 'interaction-only',
      'response-field': false,
      callback: (token) => {
        verificationToken = token;
        submitButton.disabled = isSending;
        if (!isSending) setStatus('');
      },
      'expired-callback': invalidateVerification,
      'timeout-callback': invalidateVerification,
      'error-callback': () => {
        invalidateVerification();
        if (!isSending) setStatus(failureMessage, 'is-error');
      },
    });
  } catch {
    invalidateVerification();
    setStatus(failureMessage, 'is-error');
  }
}

initializeVerification();

function setStatus(message, state = '') {
  statusEl.textContent = message;
  statusEl.className = `form-status ${state}`.trim();
}

// Keep native newlines in the textarea and keyboard activation on the button.
form.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
    event.preventDefault();
  }
});

form.addEventListener('input', (event) => {
  event.target.setCustomValidity?.('');
  if (!isSending) setStatus('');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isSending) return;

  const answers = {};
  for (const name of ['name', 'email', 'message']) {
    const input = form.elements.namedItem(name);
    answers[name] = input.value.trim();
    input.setCustomValidity(answers[name] ? '' : 'Please fill in this field.');
  }
  if (!form.reportValidity()) return;
  if (!verificationToken) {
    setStatus(failureMessage, 'is-error');
    return;
  }
  answers.website = form.elements.namedItem('website').value;
  answers.turnstileToken = verificationToken;

  isSending = true;
  invalidateVerification();
  fields.disabled = true;
  form.setAttribute('aria-busy', 'true');
  submitButton.textContent = 'Sending…';
  setStatus('Sending your message…');

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) throw new Error('Message was not sent');
    form.reset();
    setStatus('Thank you. We will contact you soon.', 'is-success');
  } catch {
    setStatus(failureMessage, 'is-error');
  } finally {
    isSending = false;
    fields.disabled = false;
    form.removeAttribute('aria-busy');
    submitButton.textContent = 'Send message';
    // A token is single-use, including when delivery fails after verification.
    if (widgetId !== undefined && window.turnstile) window.turnstile.reset(widgetId);
  }
});
