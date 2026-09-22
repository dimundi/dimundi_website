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
    #snake-panel .snake-pad { display: grid; grid-template-columns: repeat(3, 44px);
      gap: 0.35rem; margin-left: auto; }
    #snake-panel .snake-pad button { font-size: 1.15rem; padding: 0.2rem; touch-action: manipulation; }
    #snake-panel .snake-pad [data-snake-dir="up"] { grid-column: 2; }
    #snake-panel .snake-pad [data-snake-dir="left"] { grid-column: 1; }
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
        <canvas width="600" height="480" tabindex="0" aria-label="Snake game board" aria-describedby="snake-help snake-state">
          Snake requires a browser with canvas support.
        </canvas>
        <p id="snake-state" class="snake-state" role="status">ready</p>
        <p id="snake-help" class="snake-help">Collect {}. Avoid walls and your tail.<br>Arrow keys / WASD / swipe · Space: pause · Esc: exit</p>
        <div class="snake-controls">
        <div class="snake-actions">
          <button type="button" data-snake-action="play">start</button>
          <button type="button" data-snake-action="restart">restart</button>
          <button type="button" data-snake-action="exit">exit</button>
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
  let snake, direction, food, score;
  let turns = [];
  let mode = 'ready';
  let timer;
  let pointer;

  const same = (a, b) => a.x === b.x && a.y === b.y;
  const isOpen = () => !panel.hidden;
  const exitGame = () => { pause(); window.location.assign('/about'); };
  const stop = () => { window.clearTimeout(timer); timer = undefined; };

  function placeFood() {
    const free = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      if (!snake.some(part => part.x === x && part.y === y)) free.push({ x, y });
    }
    return free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function setMode(value) {
    mode = value;
    stateEl.textContent = { ready: 'ready', running: 'running…', paused: 'paused', over: 'game over', won: 'board complete!' }[mode];
    play.textContent = mode === 'running' ? 'pause' : mode === 'paused' ? 'resume' : 'start';
    scoreEl.textContent = String(score).padStart(3, '0');
    panel.dataset.state = mode;
    draw();
  }

  function reset() {
    stop();
    snake = [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }];
    direction = directions.right;
    turns = [];
    score = 0;
    food = placeFood();
    setMode('ready');
  }

  function schedule() { timer = window.setTimeout(step, Math.max(75, 155 - Math.floor(score / 20) * 5)); }

  function step() {
    if (mode !== 'running') return;
    if (!isOpen() || document.hidden) { pause(); return; }
    direction = turns.shift() || direction;
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    const eating = same(head, food);
    // The tail vacates its square on this tick unless the snake grows.
    const body = eating ? snake : snake.slice(0, -1);
    if (head.x < 0 || head.x >= columns || head.y < 0 || head.y >= rows || body.some(part => same(head, part))) {
      stop(); setMode('over'); return;
    }
    snake.unshift(head);
    if (eating) {
      score += 10;
      scoreEl.textContent = String(score).padStart(3, '0');
      food = placeFood();
      if (!food) { stop(); setMode('won'); return; }
    } else snake.pop();
    draw();
    schedule();
  }

  function start() {
    if (!ctx || !isOpen() || document.hidden || mode === 'running') return;
    if (mode === 'over' || mode === 'won') reset();
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
    if (food) {
      ctx.fillStyle = color('--heading');
      ctx.font = 'bold 23px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('{}', food.x * cell + cell / 2, food.y * cell + cell / 2);
    }
    if (mode !== 'running') {
      ctx.fillStyle = color('--bg'); ctx.globalAlpha = 0.88;
      ctx.fillRect(0, height / 2 - 40, width, 80); ctx.globalAlpha = 1;
      ctx.fillStyle = color('--heading');
      ctx.font = `36px ${css.getPropertyValue('--font-display') || 'monospace'}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText({ ready: '> start', paused: '> paused', over: '> game over', won: '> complete' }[mode], width / 2, height / 2);
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
  panel.querySelector('[data-snake-action="restart"]').addEventListener('click', () => { reset(); start(); });
  panel.querySelector('[data-snake-action="exit"]').addEventListener('click', exitGame);
  panel.querySelectorAll('[data-snake-dir]').forEach(button => {
    button.addEventListener('click', () => steer(button.dataset.snakeDir));
  });
  panel.addEventListener('keydown', event => {
    // Keep game controls away from the page's terminal menu navigation.
    event.stopPropagation();
    if (event.altKey || event.ctrlKey || event.metaKey) return;
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
