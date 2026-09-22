const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function game() {
  const elements = new Map();
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      hidden: false, dataset: {}, textContent: '',
      querySelector: element, querySelectorAll: () => [],
      addEventListener() {}, setAttribute() {}, append() {}, focus() {},
      contains: () => true,
      getContext: () => new Proxy({}, { get: () => () => {} }),
    });
    return elements.get(selector);
  }
  const sandbox = {
    document: {
      getElementById: id => id === 'snake-root' ? element(id) : null,
      createElement: element, head: element('head'), documentElement: element('html'),
      hidden: false, addEventListener() {},
    },
    window: { clearTimeout() {}, setTimeout() {}, requestAnimationFrame() {}, addEventListener() {}, matchMedia: () => ({ matches: true }) },
    performance: { now: () => 0 },
    getComputedStyle: () => ({ getPropertyValue: () => '#000' }),
    MutationObserver: class { observe() {} }, ResizeObserver: class { observe() {} },
  };
  // Expose internals only in the test VM; no debug API ships to the browser.
  const source = fs.readFileSync(path.join(__dirname, '../frontend/snake.js'), 'utf8');
  vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, `
    globalThis.game = {
      start, step, reset, pause, steer,
      state: () => ({ level, words: [...words], wordIndex, letterIndex, score, mode,
        snake: snake.map(p => ({...p})), letters: letters.map(p => ({...p})) }),
      vocabulary,
      arrange: (body, heading, tiles) => { snake = body; direction = directions[heading]; turns = []; letters = tiles; },
      target: p => { letters[letterIndex] = p; },
    };
  })();`), sandbox);
  return sandbox.game;
}

test('word pools match all nine lengths and contain four distinct choices', () => {
  const g = game();
  assert.equal(g.vocabulary.length, 9);
  g.vocabulary.forEach((pool, i) => {
    assert.ok(new Set(pool).size >= 4);
    pool.forEach(word => assert.equal(word.length, i + 2, word));
  });
});

test('complete 36 words: score survives levels, each level starts at length four', () => {
  const g = game();
  let expectedScore = 0;
  for (let level = 0; level < 9; level++) {
    g.start();
    let s = g.state();
    assert.equal(s.level, level);
    assert.equal(s.snake.length, 4);
    assert.equal(s.score, expectedScore);
    assert.equal(new Set(s.words).size, 4);
    // Feed consecutive tiles on a collision-free serpentine route. The normal
    // step function still handles growth, word changes and level completion.
    g.arrange([{x:3,y:0},{x:2,y:0},{x:1,y:0},{x:0,y:0}], 'right', s.letters);
    let x = 3, y = 0, heading = 'right';
    for (let i = 0; i < 4 * (level + 2); i++) {
      s = g.state();
      if (s.letterIndex === 0) {
        assert.equal(new Set(s.letters.map(p => `${p.x},${p.y}`)).size, level + 2);
        s.letters.forEach(p => {
          assert.ok(p.x >= 0 && p.x < 20 && p.y >= 0 && p.y < 16);
          // First word was placed before arranging the test body.
          if (i > 0) assert.ok(!s.snake.some(b => b.x === p.x && b.y === p.y));
        });
      }
      let nextHeading;
      if (y % 2 === 0) { if (x < 19) { x++; nextHeading = 'right'; } else { y++; nextHeading = 'down'; } }
      else { if (x > 0) { x--; nextHeading = 'left'; } else { y++; nextHeading = 'down'; } }
      if (nextHeading !== heading) g.steer(nextHeading);
      heading = nextHeading;
      g.target({ x, y });
      g.step();
      expectedScore += 10;
      assert.equal(g.state().score, expectedScore);
    }
    s = g.state();
    assert.equal(s.snake.length, 4 + 4 * (level + 2));
    assert.equal(s.mode, level === 8 ? 'won' : 'level');
    g.step();
    assert.equal(g.state().score, expectedScore);
  }
  assert.equal(expectedScore, 2160);
  g.reset();
  assert.equal(g.state().score, 0);
  assert.equal(g.state().level, 0);
  assert.equal(g.state().snake.length, 4);
});

test('out-of-order letters are passable; pause and wall collision stop movement', () => {
  const g = game();
  g.start();
  g.arrange([{x:6,y:8},{x:5,y:8},{x:4,y:8},{x:3,y:8}], 'right', [{x:12,y:8},{x:7,y:8}]);
  g.step();
  assert.equal(g.state().letterIndex, 0);
  assert.equal(g.state().snake.length, 4);
  assert.equal(g.state().score, 0);
  g.pause();
  const before = JSON.stringify(g.state().snake);
  g.step();
  assert.equal(JSON.stringify(g.state().snake), before);
  g.start();
  g.arrange([{x:19,y:8},{x:18,y:8},{x:17,y:8},{x:16,y:8}], 'right', [{x:1,y:1},{x:2,y:1}]);
  g.step();
  assert.equal(g.state().mode, 'over');
});
