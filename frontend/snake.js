// Dimundi's original Snake implementation. UI, styles and game stay in this file.
(() => {
  'use strict';
  const root = document.getElementById('snake-root');
  if (!root || document.getElementById('snake-panel')) return;

  const style = document.createElement('style');
  style.textContent = `
    #snake-app { width: min(36rem, 100%); padding: 1.5rem 1rem; margin: auto; }
    #snake-title { margin: 0 0 0.5rem; color: var(--heading); font: 2.5rem var(--font-display); }
    #snake-app .snake-back { display: inline-block; margin: 0.75rem 0; color: var(--line); }
    #snake-root [hidden] { display: none !important; }
    #snake-loader { border: 1px solid var(--line); border-radius: 4px; padding: 1.25rem;
      margin: 0.65rem 0 1rem; color: var(--line); background: var(--bg); }
    #snake-loader p { margin: 0 0 1rem; }
    #snake-loader progress { display: block; width: 100%; height: 1rem; accent-color: var(--line); }
    #snake-loader output { display: block; text-align: right; margin-top: 0.5rem; }
    #snake-panel { width: 100%; padding-left: 0;
      border: 0; color: var(--line); font: 0.85rem/1.5 var(--font-mono); }
    #snake-panel .snake-terminal { border: 1px solid var(--line); padding: clamp(0.65rem, 2vw, 1rem);
      margin: 0.65rem 0 1rem; background: var(--bg); border-radius: 4px; }
    #snake-panel .snake-bar { display: flex; justify-content: space-between; align-items: center;
      gap: 0.75rem; flex-wrap: wrap; padding-bottom: 0.65rem; }
    #snake-panel .snake-command { color: var(--heading); }
    #snake-panel .snake-score { font-variant-numeric: tabular-nums; }
    #snake-panel .snake-task { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; margin-bottom: 0.65rem; }
    #snake-panel .snake-word { letter-spacing: 0.15em; color: var(--heading); }
    #snake-panel canvas { display: block; width: 100%; aspect-ratio: 5/4;
      border: 1px solid var(--active); touch-action: none; }
    #snake-panel canvas:focus-visible { outline: 2px solid var(--heading); outline-offset: 3px; }
    #snake-panel .snake-state { color: var(--heading); margin: 0.65rem 0 0; min-height: 1.5em; }
    #snake-panel .snake-help { color: var(--muted-footer); margin: 0.3rem 0 0.75rem; font-size: 0.75rem; }
    #snake-panel .snake-controls { display: flex; align-items: flex-end; gap: 0.9rem; flex-wrap: wrap; }
    #snake-panel .snake-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    #snake-panel button { color: var(--line); background: transparent; border: 1px solid var(--line);
      padding: 0.45rem 0.75rem; min-height: 44px; font: inherit; border-radius: 3px; cursor: pointer; }
    #snake-panel button:hover, #snake-panel button:focus-visible { background: var(--active);
      outline: 2px solid var(--heading); outline-offset: 2px; }
    #snake-panel .snake-actions button { min-height: 36px; padding: 0.3rem 0.55rem;
      font-size: 0.75rem; touch-action: manipulation; }
    @media (max-width: 480px) {
      #snake-panel .snake-actions { gap: 0.4rem; }
      #snake-panel .snake-actions button { min-height: 32px; padding: 0.2rem 0.4rem; font-size: 0.7rem; }
    }
    #snake-panel .snake-pad { display: grid; grid-template-columns: repeat(3, 44px);
      gap: 0.35rem; margin-left: auto; }
    #snake-panel .snake-pad button { font-size: 1.15rem; padding: 0.2rem; touch-action: manipulation; }
    #snake-panel .snake-pad [data-snake-dir="up"] { grid-column: 2; }
    #snake-panel .snake-pad [data-snake-dir="left"] { grid-column: 1; }
    @media (max-width: 770px), (pointer: coarse) {
      #snake-panel .snake-pad { grid-template-columns: repeat(3, 60px); gap: 14px; }
      #snake-panel .snake-pad button { min-height: 60px; font-size: 1.5rem; }
    }
  `;
  document.head.append(style);

  root.innerHTML = `
    <div id="snake-loader" role="status" aria-label="snake.exe">
      <p>&gt; run snake.exe</p>
      <progress max="100" value="0" aria-label="snake.exe"></progress>
      <output aria-hidden="true">0%</output>
    </div>
    <section id="snake-panel" hidden aria-label="Snake game">
      <div class="snake-terminal">
        <div class="snake-bar"><span class="snake-command">&gt; run snake.exe</span>
          <span class="snake-score">score: <output>000</output></span></div>
        <div class="snake-task"><span data-level></span><span data-word-count></span><strong class="snake-word" data-word></strong></div>
        <canvas width="600" height="480" tabindex="0" aria-label="Snake game board" aria-describedby="snake-help snake-state">
          Snake requires a browser with canvas support.
        </canvas>
        <p id="snake-state" class="snake-state" role="status">ready</p>
        <p id="snake-help" class="snake-help">Collect letters in order. Complete 4 words per level.</p>
        <div class="snake-controls">
        <div class="snake-actions">
          <button type="button" data-snake-action="play">start</button>
        </div>
        <div class="snake-pad" aria-label="Direction controls">
          <button type="button" data-snake-dir="up" aria-label="Move up">↑</button>
          <button type="button" data-snake-dir="left" aria-label="Move left">←</button>
          <button type="button" data-snake-dir="down" aria-label="Move down">↓</button>
          <button type="button" data-snake-dir="right" aria-label="Move right">→</button>
        </div>
        </div>
      </div>
    </section>`;
  const panel = root.querySelector('#snake-panel');
  const canvas = panel.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = panel.querySelector('output');
  const stateEl = panel.querySelector('.snake-state');
  const play = panel.querySelector('[data-snake-action="play"]');
  const directions = { up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 } };
  const keys = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left', w: 'up', d: 'right', s: 'down', a: 'left' };
  const columns = 20;
  const rows = 16;
  const vocabulary = [
    ['AI', 'IC', 'JS', 'IO', 'UI', 'UX'],
    ['CSS', 'LED', 'GIT', 'CPU', 'SQL', 'RAM', 'API', 'USB', 'DOM', 'PCB', 'GPU', 'PLC'],
    ['HTML', 'UART', 'JSON', 'GPIO', 'HTTP', 'FPGA', 'AJAX', 'RFID'],
    ['ENCJA', 'FLASH', 'LINUX', 'ESP32', 'REACT', 'REDIS'],
    ['PYTHON', 'SENSOR', 'DOCKER', 'MODBUS', 'SVELTE', 'EEPROM', 'SERIAL'],
    ['BACKEND', 'ARDUINO', 'FASTAPI', 'WEBHOOK', 'GRAPHQL'],
    ['FRONTEND', 'FIRMWARE', 'ETHERNET', 'RABBITMQ'],
    ['WEBSOCKET', 'OSCYLATOR', 'PROCESSOR', 'INTERFACE'],
    ['TYPESCRIPT', 'AUTOMATYKA', 'POSTGRESQL', 'KUBERNETES'],
  ];
  let snake, direction, letters, score, level, words, wordIndex, letterIndex;
  const word = () => words[wordIndex];
  const shuffled = items => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  let turns = [];
  let mode = 'ready';
  let timer;
  let pointer;

  const same = (a, b) => a.x === b.x && a.y === b.y;
  const isOpen = () => !panel.hidden;
  const exitGame = () => { pause(); window.location.assign('/about'); };
  const stop = () => { window.clearTimeout(timer); timer = undefined; };

  function placeWord() {
    letterIndex = 0;
    const free = [];
    const occupied = new Set(snake.map(p => p.y * columns + p.x));
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      if (!occupied.has(y * columns + x)) free.push({ x, y });
    }
    const available = p => p.x >= 0 && p.x < columns && p.y >= 0 && p.y < rows && !occupied.has(p.y * columns + p.x);
    const starts = shuffled(free);
    // Prefer words readable left-to-right or top-to-bottom.
    for (const start of starts) for (const dir of shuffled([directions.right, directions.down])) {
      const path = Array.from(word(), (_, i) => ({ x: start.x + dir.x * i, y: start.y + dir.y * i }));
      if (path.every(available)) { letters = path; return; }
    }
    // Allow bends when the body blocks straight placement. Bound the search.
    let budget = 10000;
    function extend(path) {
      if (path.length === word().length) return path;
      if (--budget <= 0) return null;
      const last = path.at(-1);
      for (const dir of shuffled(Object.values(directions))) {
        const next = { x: last.x + dir.x, y: last.y + dir.y };
        if (!available(next) || path.some(p => same(p, next))) continue;
        const found = extend([...path, next]);
        if (found) return found;
      }
      return null;
    }
    for (const start of starts) {
      const found = extend([start]);
      if (found) { letters = found; return; }
      if (budget <= 0) break;
    }
    // Keep play possible even when free space is fragmented.
    letters = starts.slice(0, word().length);
  }

  function updateProgress() {
    scoreEl.textContent = String(score).padStart(3, '0');
    panel.querySelector('[data-level]').textContent = `level: ${level + 1}/9`;
    panel.querySelector('[data-word-count]').textContent = `word: ${wordIndex + 1}/4`;
    panel.querySelector('[data-word]').textContent = word().slice(0, letterIndex) + '_'.repeat(word().length - letterIndex);
    panel.querySelector('[data-word]').setAttribute('aria-label', `${word()}: ${letterIndex}/${word().length}`);
  }

  function setMode(value) {
    mode = value;
    stateEl.textContent = { ready: 'ready', running: 'running…', paused: 'paused', over: 'game over', level: 'Enter — next level', won: 'all levels complete!' }[mode];
    play.textContent = mode === 'running' ? 'pause' : mode === 'paused' ? 'resume' : mode === 'level' ? 'next level' : 'start';
    updateProgress();
    panel.dataset.state = mode;
    draw();
  }

  function prepareLevel() {
    stop();
    snake = [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }];
    direction = directions.right;
    turns = [];
    words = shuffled(vocabulary[level]).slice(0, 4);
    wordIndex = 0;
    placeWord();
    setMode('ready');
  }

  function reset() {
    score = 0;
    level = 0;
    prepareLevel();
  }

  function schedule() { timer = window.setTimeout(step, Math.max(110, 170 - level * 7)); }

  function step() {
    if (mode !== 'running') return;
    if (!isOpen() || document.hidden) { pause(); return; }
    direction = turns.shift() || direction;
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    const eating = same(head, letters[letterIndex]);
    // The tail vacates its square on this tick unless the snake grows.
    const body = eating ? snake : snake.slice(0, -1);
    if (head.x < 0 || head.x >= columns || head.y < 0 || head.y >= rows || body.some(part => same(head, part))) {
      stop(); setMode('over'); return;
    }
    snake.unshift(head);
    if (eating) {
      score += 10;
      letterIndex++;
      if (letterIndex === word().length) {
        if (wordIndex === 3) {
          stop(); setMode(level === vocabulary.length - 1 ? 'won' : 'level'); return;
        }
        wordIndex++;
        placeWord();
      }
      updateProgress();
    } else snake.pop();
    draw();
    schedule();
  }

  function start() {
    if (!ctx || !isOpen() || document.hidden || mode === 'running') return;
    if (mode === 'over' || mode === 'won') reset();
    else if (mode === 'level') { level++; prepareLevel(); }
    setMode('running');
    canvas.focus({ preventScroll: true });
    schedule();
  }

  function pause() {
    if (mode !== 'running') return;
    stop(); setMode('paused');
  }

  function steer(name) {
    if (mode !== 'running' || turns.length >= 2) return;
    const next = directions[name];
    const last = turns.at(-1) || direction;
    if (same(next, last) || (next.x === -last.x && next.y === -last.y)) return;
    turns.push(next);
  }

  function draw() {
    if (!ctx || !snake) return;
    const css = getComputedStyle(document.documentElement);
    const color = name => css.getPropertyValue(name).trim();
    const width = 600, height = 480, cell = 30;
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    ctx.fillStyle = color('--bg');
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = color('--line');
    ctx.globalAlpha = 0.1;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= width; x += cell) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = 0; y <= height; y += cell) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();
    ctx.globalAlpha = 1;
    snake.forEach((part, index) => {
      ctx.fillStyle = color(index === 0 ? '--heading' : '--line');
      ctx.fillRect(part.x * cell + 3, part.y * cell + 3, cell - 6, cell - 6);
    });
    letters.forEach((part, index) => {
      if (index < letterIndex || snake.some(p => same(p, part))) return;
      const active = index === letterIndex;
      ctx.fillStyle = color(active ? '--active' : '--bg');
      ctx.fillRect(part.x * cell + 2, part.y * cell + 2, cell - 4, cell - 4);
      ctx.strokeStyle = color(active ? '--heading' : '--line');
      ctx.lineWidth = 1;
      ctx.strokeRect(part.x * cell + 2, part.y * cell + 2, cell - 4, cell - 4);
      ctx.fillStyle = color('--heading');
      ctx.font = `${active ? 'bold ' : ''}22px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(word()[index], part.x * cell + cell / 2, part.y * cell + cell / 2);
    });
    if (mode !== 'running') {
      ctx.fillStyle = color('--bg'); ctx.globalAlpha = 0.88;
      ctx.fillRect(0, height / 2 - 70, width, 140); ctx.globalAlpha = 1;
      ctx.fillStyle = color('--heading');
      ctx.font = `36px ${css.getPropertyValue('--font-display') || 'monospace'}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText({ ready: '> start', paused: '> paused', over: '> game over', level: `> level ${level + 1} complete`, won: '> all levels complete' }[mode], width / 2, height / 2 - (mode === 'level' ? 28 : 0));
      if (mode === 'level') {
        ctx.fillStyle = color('--active');
        ctx.fillRect(40, height / 2, width - 80, 52);
        ctx.fillStyle = color('--heading');
        ctx.fillText('Enter — next level', width / 2, height / 2 + 26);
      }
    }
  }

  function resize() {
    if (!isOpen()) return;
    const width = canvas.getBoundingClientRect().width;
    if (!width) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(width * 0.8 * ratio);
    draw();
  }

  play.addEventListener('click', () => mode === 'running' ? pause() : start());
  panel.querySelectorAll('[data-snake-dir]').forEach(button => {
    button.addEventListener('click', () => steer(button.dataset.snakeDir));
  });
  panel.addEventListener('keydown', event => {
    // Keep game controls away from the page's terminal menu navigation.
    event.stopPropagation();
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Enter' && mode === 'level') {
      event.preventDefault(); start(); return;
    }
    const name = keys[event.key] || keys[event.key.toLowerCase()];
    if (name) { event.preventDefault(); steer(name); }
    if ((event.key === ' ' || event.key === 'Enter') && event.target === canvas) {
      event.preventDefault(); mode === 'running' ? pause() : start();
    }
    if (event.key === 'Escape') { event.preventDefault(); exitGame(); }
  });
  canvas.addEventListener('pointerdown', event => {
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    pointer = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  canvas.addEventListener('pointercancel', () => { pointer = null; });
  panel.addEventListener('focusout', event => { if (!panel.contains(event.relatedTarget)) pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', pause);
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  new ResizeObserver(resize).observe(canvas);
  document.fonts?.ready.then(draw);
  reset();

  // A short decorative boot sequence; no network request or artificial download.
  const loader = root.querySelector('#snake-loader');
  const progress = loader.querySelector('progress');
  const percent = loader.querySelector('output');
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1400;
  const bootStarted = performance.now();
  function boot(now) {
    const value = duration ? Math.min(100, Math.floor((now - bootStarted) / duration * 100)) : 100;
    progress.value = value;
    percent.textContent = `${value}%`;
    if (value < 100) { window.requestAnimationFrame(boot); return; }
    loader.hidden = true;
    panel.hidden = false;
    resize();
    canvas.focus({ preventScroll: true });
  }
  window.requestAnimationFrame(boot);
})();
