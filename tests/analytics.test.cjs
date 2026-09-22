const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../frontend/analytics.js'), 'utf8');
const key = 'dimundi-analytics-consent-v1';

function setup({ hostname = 'dimundi.com', saved = null, blocked = false } = {}) {
  const nodes = new Map();
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {
      hidden: true, listeners: {}, focus() {}, querySelector: node,
      addEventListener(name, fn) { this.listeners[name] = fn; },
    });
    return nodes.get(selector);
  }
  const scripts = [], cookies = [], listeners = {}, storage = new Map();
  if (saved) storage.set(key, JSON.stringify(saved));
  const document = {
    referrer: 'https://example.com/private?email=secret@example.com',
    head: { append: script => scripts.push(script) },
    createElement: () => ({}), querySelector: node, getElementById: node,
    get cookie() { return '_ga=123; _ga_BLCYHLE5Z3=456; unrelated=keep'; },
    set cookie(value) { cookies.push(value); },
  };
  const window = { addEventListener(name, fn) { listeners[name] = fn; } };
  const localStorage = {
    getItem(k) { if (blocked) throw Error('blocked'); return storage.get(k) || null; },
    setItem(k, v) { if (blocked) throw Error('blocked'); storage.set(k, v); },
  };
  vm.runInNewContext(source, { window, document, localStorage, URL, location: { hostname, pathname: '/snake', search: '?email=secret@example.com', hash: '#private' } });
  return { window, node, scripts, cookies, storage, listeners,
    accept: () => node('[data-analytics-accept]').listeners.click(),
    reject: () => node('[data-analytics-reject]').listeners.click(),
    commands: () => Array.from(window.dataLayer || [], x => Array.from(x)),
  };
}

test('no GA requests or queued events before consent or after rejection', () => {
  const g = setup();
  g.window.dimundiTrack('snake_start');
  assert.equal(g.scripts.length, 0);
  assert.equal(g.commands().length, 0);
  g.reject();
  assert.equal(g.node('analytics-consent').hidden, true);
  assert.equal(g.scripts.length, 0);
  assert.equal(JSON.parse(g.storage.get(key)).value, 'denied');
});

test('accept initializes once, excludes sensitive values, revoke stops custom events', () => {
  const g = setup();
  g.accept();
  g.accept();
  assert.equal(g.scripts.length, 1);
  assert.equal(g.commands().filter(c => c[1] === 'page_view').length, 1);
  assert.equal(g.commands()[0][0], 'consent');
  assert.equal(g.commands()[0][2].analytics_storage, 'denied');
  g.window.dimundiTrack('generate_lead', { email: 'secret@example.com', message: 'PRIVATE' });
  g.window.dimundiTrack('snake_level_complete', { level: 3, score: 120, message: 'PRIVATE' });
  g.window.dimundiTrack('contact_reveal', { kind: 'phone', value: 'PRIVATE' });
  g.window.dimundiTrack('arbitrary_event', { value: 'PRIVATE' });
  const data = JSON.stringify(g.commands());
  assert.ok(!data.includes('PRIVATE') && !data.includes('secret@example.com'));
  assert.ok(!data.includes('arbitrary_event'));
  assert.ok(data.includes('https://example.com'));
  assert.equal(g.commands().find(c => c[1] === 'snake_level_complete')[2].level, 3);
  g.reject();
  const count = g.commands().length;
  g.window.dimundiTrack('generate_lead');
  assert.equal(g.commands().length, count);
  assert.equal(g.window['ga-disable-G-BLCYHLE5Z3'], true);
  assert.ok(g.cookies.some(c => c.startsWith('_ga_BLCYHLE5Z3=')));
  assert.ok(!g.cookies.some(c => c.startsWith('unrelated=')));
});

test('stored choice, expiry, blocked storage, cross-tab revocation and local preview', () => {
  const granted = { value: 'granted', expires: Date.now() + 100000 };
  assert.equal(setup({ saved: granted }).scripts.length, 1);
  assert.equal(setup({ saved: { ...granted, expires: 0 } }).scripts.length, 0);
  const local = setup({ hostname: '127.0.0.1' });
  local.accept();
  assert.equal(local.scripts.length, 0);
  const blocked = setup({ blocked: true });
  blocked.accept();
  assert.equal(blocked.scripts.length, 1);
  blocked.reject();
  assert.equal(blocked.window['ga-disable-G-BLCYHLE5Z3'], true);
  const crossTab = setup({ saved: granted });
  crossTab.storage.set(key, JSON.stringify({ value: 'denied', expires: Date.now() + 100000 }));
  crossTab.listeners.storage({ key });
  assert.equal(crossTab.window['ga-disable-G-BLCYHLE5Z3'], true);
});
