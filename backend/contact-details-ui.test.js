import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../frontend/contact-details.js', import.meta.url), 'utf8');
function setup({ responseOk = true, ready = true } = {}) {
  const buttons = ['email', 'phone'].map(kind => ({
    dataset: { reveal: kind }, hidden: false,
    addEventListener(_name, handler) { this.click = handler; },
  }));
  const links = Object.fromEntries(['email', 'phone'].map(kind => [kind, { hidden: true, focus() {} }]));
  const section = {
    querySelectorAll: () => buttons,
    querySelector: selector => selector.includes('email') ? links.email : links.phone,
    setAttribute() {}, removeAttribute() {},
  };
  const status = { hidden: true };
  const verification = { hidden: true };
  let callbacks;
  let removed = 0;
  const requests = [];
  const promise = ready ? Promise.resolve({ siteKey: 'key' }) : Promise.reject(new Error('Unavailable'));
  promise.catch(() => {});
  vm.runInNewContext(source, {
    AbortSignal,
    window: {
      dimundiVerificationReady: promise,
      turnstile: { render: (_selector, options) => { callbacks = options; return 'details-widget'; }, remove: () => removed++ },
    },
    document: {
      querySelector: () => section,
      getElementById: id => id === 'contact-details-status' ? status : verification,
      documentElement: { dataset: { theme: 'dark' } },
    },
    fetch: async (_url, init) => {
      const body = JSON.parse(init.body);
      requests.push(body);
      return { ok: responseOk, json: async () => ({ value: body.kind === 'email' ? 'hello@example.com' : '+48 123' }) };
    },
  });
  return { buttons, links, requests, status, verification,
    get callbacks() { return callbacks; }, get removed() { return removed; } };
}

test('contact values are fetched only after click and verification, one field at a time', async () => {
  const f = setup();
  assert.equal(f.requests.length, 0);
  await f.buttons[0].click();
  assert.equal(f.requests.length, 0);
  assert.equal(f.buttons[0].dataset.loading, 'true');
  assert.equal(f.buttons[1].dataset.loading, undefined);
  assert.equal(f.callbacks.action, 'contact_email');
  await f.callbacks.callback('email-token');
  assert.deepEqual(f.requests, [{ kind: 'email', turnstileToken: 'email-token' }]);
  assert.equal(f.links.email.href, 'mailto:hello@example.com');
  assert.equal(f.links.email.hidden, false);
  assert.equal(f.links.phone.hidden, true);
  assert.equal(f.buttons[0].hidden, true);
  assert.equal(f.buttons[0].dataset.loading, undefined);
  assert.equal(f.removed, 1);
  await f.buttons[1].click();
  assert.equal(f.callbacks.action, 'contact_phone');
  await f.callbacks.callback('phone-token');
  assert.equal(f.links.phone.href, 'tel:+48123');
  assert.equal(f.requests.length, 2);
});

test('failed reveal exposes no data and allows another click', async () => {
  const f = setup({ responseOk: false });
  await f.buttons[0].click();
  await f.callbacks.callback('token');
  assert.equal(f.links.email.hidden, true);
  assert.equal(f.buttons[0].disabled, false);
  assert.equal(f.buttons[0].dataset.loading, undefined);
  assert.equal(f.status.hidden, false);
});

test('verification errors and missing config never request contact values', async () => {
  const missing = setup({ ready: false });
  await missing.buttons[0].click();
  assert.equal(missing.requests.length, 0);
  assert.equal(missing.status.hidden, false);
  const f = setup();
  await f.buttons[0].click();
  f.callbacks['error-callback']();
  await f.callbacks.callback('late-token');
  assert.equal(f.requests.length, 0);
  assert.equal(f.buttons[0].disabled, false);
});
