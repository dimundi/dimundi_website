const form = document.getElementById('contact-form');
const fields = document.getElementById('contact-fields');
const statusEl = document.getElementById('form-status');
const submitButton = form.querySelector('button[type="submit"]');
let isSending = false;

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

  isSending = true;
  fields.disabled = true;
  form.setAttribute('aria-busy', 'true');
  submitButton.textContent = 'Sending…';
  setStatus('Sending your message…');

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers),
    });
    if (!response.ok) throw new Error('Message was not sent');
    form.reset();
    setStatus('Thank you. We will contact you soon.', 'is-success');
  } catch {
    setStatus('Unable to send your message. Please try again or email us directly.', 'is-error');
  } finally {
    isSending = false;
    fields.disabled = false;
    form.removeAttribute('aria-busy');
    submitButton.textContent = 'Send message';
  }
});
