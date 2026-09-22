import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../frontend/contact.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

async function setup({ configured = true, deliveryStatus = 202 } = {}) {
  const listeners = {};
  const button = { disabled: true, textContent: 'Send message' };
  const fields = { disabled: false };
  const status = {};
  const inputs = Object.fromEntries(Object.entries({ name: 'Ada', email: 'ada@example.com', message: 'Hello', website: '' })
    .map(([key, value]) => [key, { value, setCustomValidity() {} }]));
  let resets = 0;
  let widgetResets = 0;
  let callbacks;
  const posts = [];
  const form = {
    querySelector: () => button,
    elements: { namedItem: name => inputs[name] },
    addEventListener: (name, handler) => { listeners[name] = handler; },
    reportValidity: () => true,
    setAttribute() {}, removeAttribute() {},
    reset: () => { resets++; },
  };
  const window = {
    setTimeout, clearTimeout,
    dimundiVerificationReady: configured ? Promise.resolve({ siteKey: 'public-key' }) : Promise.reject(new Error('No config')),
    turnstile: {
      render: (_target, options) => { callbacks = options; return 'widget'; },
      reset: () => { widgetResets++; },
    },
  };
  const document = {
    getElementById: id => ({ 'contact-form': form, 'contact-fields': fields, 'form-status': status })[id],
    documentElement: { dataset: { theme: 'light' } },
    createElement: () => ({}),
    head: { append: () => window.dimundiTurnstileReady() },
  };
  vm.runInNewContext(source, {
    window, document, AbortSignal,
    fetch: async (url, init) => {
      if (url === '/api/contact-config') return { ok: configured, json: async () => ({ siteKey: 'public-key' }) };
      posts.push(JSON.parse(init.body));
      return { ok: deliveryStatus === 202, status: deliveryStatus };
    },
  });
  await tick();
  return { button, fields, status, posts, inputs, get callbacks() { return callbacks; },
    get resets() { return resets; }, get widgetResets() { return widgetResets; },
    submit: () => listeners.submit({ preventDefault() {} }),
  };
}

test('form remains disabled and cannot submit before verification', async () => {
  const f = await setup();
  assert.equal(f.button.disabled, true);
  await f.submit();
  assert.equal(f.posts.length, 0);
});

test('missing server config leaves form disabled with existing error message', async () => {
  const f = await setup({ configured: false });
  assert.equal(f.button.disabled, true);
  assert.equal(f.status.className, 'form-status is-error');
  assert.equal(f.callbacks, undefined);
});

test('successful submission carries token and honeypot and requires fresh verification', async () => {
  const f = await setup();
  f.callbacks.callback('verified-token');
  assert.equal(f.button.disabled, false);
  await f.submit();
  assert.equal(f.posts[0].turnstileToken, 'verified-token');
  assert.equal(f.posts[0].website, '');
  assert.equal(f.resets, 1);
  assert.equal(f.widgetResets, 1);
  assert.equal(f.button.disabled, true);
  assert.equal(f.fields.disabled, false);
  await f.submit();
  assert.equal(f.posts.length, 1);
});

test('rate limit or SMTP failure preserves fields and refreshes token', async () => {
  for (const deliveryStatus of [429, 502]) {
    const f = await setup({ deliveryStatus });
    f.callbacks.callback('verified-token');
    await f.submit();
    assert.equal(f.resets, 0);
    assert.equal(f.widgetResets, 1);
    assert.equal(f.button.disabled, true);
    assert.equal(f.status.className, 'form-status is-error');
    assert.equal(f.inputs.message.value, 'Hello');
  }
});

test('expired or failed verification disables submission', async () => {
  const f = await setup();
  for (const callback of ['expired-callback', 'timeout-callback', 'error-callback']) {
    f.callbacks.callback('verified-token');
    f.callbacks[callback]();
    assert.equal(f.button.disabled, true);
    await f.submit();
  }
  assert.equal(f.posts.length, 0);
});
