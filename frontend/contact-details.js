async function initContactDetails() {
  const status = document.getElementById('contact-details-status');
  const values = document.getElementById('contact-details-values');
  const email = document.querySelector('[data-contact-email]');
  const phone = document.querySelector('[data-contact-phone]');

  try {
    const response = await fetch('/api/contact-data');
    if (!response.ok) throw new Error('Unable to load contact details');
    const data = await response.json();
    if (typeof data.email !== 'string' || !data.email.trim()
      || typeof data.tel !== 'string' || !data.tel.trim()) {
      throw new Error('Missing contact details');
    }

    email.textContent = data.email;
    email.href = `mailto:${data.email}`;
    phone.textContent = data.tel;
    phone.href = `tel:${data.tel.replace(/[^+\d]/g, '')}`;
    values.hidden = false;
    status.hidden = true;
  } catch (error) {
    status.textContent = 'Contact details are unavailable. Please use the form below.';
    console.error(error);
  }
}

initContactDetails();
