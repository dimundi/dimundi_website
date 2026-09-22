import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from './app.js';

const env = {
  CORS_ORIGIN: 'https://dimundi.com',
  TURNSTILE_SITE_KEY: 'public-test-key',
  TURNSTILE_SECRET_KEY: 'private-test-key',
  TURNSTILE_HOSTNAMES: 'dimundi.com',
  MAIL_FROM: 'Dimundi <sender@example.com>', MAIL_TO: 'inbox@example.com',
  CONTACT_EMAIL: 'inbox@example.com', CONTACT_PHONE: '123',
};
const valid = {
  name: 'Test User', email: 'visitor@example.com', message: 'A project enquiry.',
  website: '', turnstileToken: 'test-token',
};
const passed = { success: true, hostname: 'dimundi.com', action: 'contact' };

async function fixture(t, options = {}) {
  const mails = [];
  const verifications = [];
  const app = createApp({
    env: { ...env, ...options.env },
    verifyFetch: async (url, init) => {
      verifications.push({ url, ...JSON.parse(init.body) });
      if (options.verifyFetch) return options.verifyFetch(url, init);
      return Response.json(options.verdict ?? passed);
    },
    sendMail: options.sendMail || (async mail => mails.push(mail)),
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body = valid, headers = {}) => fetch(base + '/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: env.CORS_ORIGIN, ...headers },
    body: JSON.stringify(body),
  });
  return { base, post, mails, verifications };
}

test('verified contact uses fixed sender/recipient and visitor only as reply-to', async t => {
  const f = await fixture(t);
  assert.equal((await f.post()).status, 202);
  assert.equal(f.mails.length, 1);
  assert.equal(f.mails[0].from, env.MAIL_FROM);
  assert.equal(f.mails[0].to, env.MAIL_TO);
  assert.deepEqual(f.mails[0].replyTo, { address: valid.email });
  assert.equal(f.verifications[0].secret, env.TURNSTILE_SECRET_KEY);
  assert.equal(f.verifications[0].response, valid.turnstileToken);
});

for (const [label, changes] of [
  ['missing token', { turnstileToken: undefined }],
  ['oversized token', { turnstileToken: 'a'.repeat(2049) }],
  ['honeypot', { website: 'spam.example' }],
  ['non-string honeypot', { website: {} }],
  ['missing message', { message: undefined }],
  ['object message', { message: {} }],
  ['empty message', { message: '  ' }],
  ['long message', { message: 'x'.repeat(2001) }],
  ['long name', { name: 'x'.repeat(81) }],
  ['header injection', { name: 'Spam\r\nBcc: victim@example.com' }],
  ['multiple addresses', { email: 'a@example.com,b@example.com' }],
  ['invalid email', { email: 'no-at-sign' }],
]) {
  test(`rejects ${label} before verification and SMTP`, async t => {
    const f = await fixture(t);
    assert.equal((await f.post({ ...valid, ...changes })).status, 400);
    assert.equal(f.mails.length, 0);
    assert.equal(f.verifications.length, 0);
  });
}

for (const verdict of [
  { success: false, 'error-codes': ['timeout-or-duplicate'] },
  { ...passed, hostname: 'other.example' },
  { ...passed, action: 'login' },
  { ...passed, success: 'true' },
]) {
  test(`rejects invalid verification ${JSON.stringify(verdict)}`, async t => {
    const f = await fixture(t, { verdict });
    assert.equal((await f.post()).status, 403);
    assert.equal(f.mails.length, 0);
  });
}

for (const verifyFetch of [
  async () => { throw new Error('timeout'); },
  async () => new Response('bad gateway', { status: 502 }),
  async () => new Response('not JSON'),
]) {
  test('verification outage fails closed', async t => {
    const f = await fixture(t, { verifyFetch });
    assert.equal((await f.post()).status, 503);
    assert.equal(f.mails.length, 0);
  });
}

test('missing keys block delivery and contact details but leave health available', async t => {
  const f = await fixture(t, { env: { TURNSTILE_SECRET_KEY: '' } });
  assert.equal((await f.post()).status, 503);
  assert.equal((await fetch(f.base + '/api/contact-config')).status, 503);
  assert.equal((await fetch(f.base + '/health')).status, 200);
  assert.equal((await fetch(f.base + '/api/contact-data')).status, 405);
  assert.equal(f.mails.length, 0);
});

test('public config only exposes site key and disables caching', async t => {
  const f = await fixture(t);
  const r = await fetch(f.base + '/api/contact-config');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await r.json(), { siteKey: env.TURNSTILE_SITE_KEY });
});

test('cross-site requests are rejected', async t => {
  const f = await fixture(t);
  assert.equal((await f.post(valid, { Origin: 'https://other.example' })).status, 403);
  assert.equal((await f.post(valid, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal(f.verifications.length, 0);
});

test('IP limit blocks the sixth attempt before verification; other IP is separate', async t => {
  const f = await fixture(t);
  for (let n = 0; n < 5; n++) assert.equal((await f.post({}, { 'X-Forwarded-For': '192.0.2.1' })).status, 400);
  const r = await f.post(valid, { 'X-Forwarded-For': '192.0.2.1' });
  assert.equal(r.status, 429);
  assert.ok(Number(r.headers.get('retry-after')) > 0);
  assert.equal(f.verifications.length, 0);
  assert.equal((await f.post(valid, { 'X-Forwarded-For': '192.0.2.2' })).status, 202);
});

test('IPv6 addresses within the same subnet share a rate limit', async t => {
  const f = await fixture(t);
  for (let n = 1; n <= 5; n++) assert.equal((await f.post({}, { 'X-Forwarded-For': `2001:db8:abcd:12::${n}` })).status, 400);
  assert.equal((await f.post(valid, { 'X-Forwarded-For': '2001:db8:abcd:12::99' })).status, 429);
});

test('global delivery cap applies across client IPs', async t => {
  const f = await fixture(t);
  for (let n = 1; n <= 30; n++) assert.equal((await f.post(valid, { 'X-Forwarded-For': `192.0.2.${n}` })).status, 202);
  assert.equal((await f.post(valid, { 'X-Forwarded-For': '192.0.2.31' })).status, 429);
  assert.equal(f.mails.length, 30);
});

test('rejects malformed, oversized and non-JSON bodies', async t => {
  const f = await fixture(t);
  for (const [body, type, status] of [['{', 'application/json', 400], ['x'.repeat(17000), 'application/json', 413], ['name=spam', 'text/plain', 415]]) {
    const r = await fetch(f.base + '/api/contact', { method: 'POST', headers: { 'Content-Type': type }, body });
    assert.equal(r.status, status);
  }
  assert.equal(f.mails.length, 0);
});

async function reveal(f, body, headers = {}) {
  return fetch(f.base + '/api/contact-data', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('old GET and HEAD do not reveal any contact values', async t => {
  const f = await fixture(t);
  for (const method of ['GET', 'HEAD']) {
    const r = await fetch(f.base + '/api/contact-data', { method });
    assert.equal(r.status, 405);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.ok(!(await r.text()).includes(env.CONTACT_EMAIL));
  }
});

for (const kind of ['email', 'phone']) {
  test(`verified reveal returns only ${kind}, independent of mail configuration`, async t => {
    const f = await fixture(t, { env: { MAIL_FROM: '' }, verdict: { ...passed, action: `contact_${kind}` } });
    const r = await reveal(f, { kind, turnstileToken: 'detail-token' });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await r.json(), { value: kind === 'email' ? env.CONTACT_EMAIL : env.CONTACT_PHONE });
    assert.equal(f.mails.length, 0);
    assert.equal((await fetch(f.base + '/api/contact-config')).status, 200);
  });
}

test('reveal requires token and supported kind', async t => {
  const f = await fixture(t);
  for (const body of [{ kind: 'email' }, { kind: 'all', turnstileToken: 'x' }, {}]) {
    assert.equal((await reveal(f, body)).status, 400);
  }
  assert.equal(f.verifications.length, 0);
});

for (const verdict of [passed, { ...passed, action: 'contact_phone' },
  { ...passed, action: 'contact_email', hostname: 'evil.example' },
  { success: false, 'error-codes': ['timeout-or-duplicate'] }]) {
  test(`reveal rejects wrong action, host or reused token: ${JSON.stringify(verdict)}`, async t => {
    const f = await fixture(t, { verdict });
    const r = await reveal(f, { kind: 'email', turnstileToken: 'x' });
    assert.equal(r.status, 403);
    assert.ok(!(await r.text()).includes(env.CONTACT_EMAIL));
  });
}

test('reveal fails closed with no keys or verification outage', async t => {
  for (const options of [{ env: { TURNSTILE_SECRET_KEY: '' } }, { verifyFetch: async () => { throw new Error('timeout'); } }]) {
    const f = await fixture(t, options);
    assert.equal((await reveal(f, { kind: 'phone', turnstileToken: 'x' })).status, 503);
  }
});

test('contact reveal has a separate IP limit and rejects cross-site requests', async t => {
  const f = await fixture(t);
  assert.equal((await reveal(f, { kind: 'email' }, { Origin: 'https://evil.example' })).status, 403);
  for (let n = 1; n < 10; n++) assert.equal((await reveal(f, { kind: 'email' })).status, 400);
  assert.equal((await reveal(f, { kind: 'email' })).status, 429);
  assert.equal((await f.post()).status, 202);
});
