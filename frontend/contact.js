const API_ENDPOINT = '/api/contact';
const QUESTION_TYPE_SPEED_MS = 35;

// Each step owns its UI hints and validation rules.
const steps = [
  { key: 'name', prompt: 'enter your name', autocomplete: 'name', maxLength: 40, required: true },
  { key: 'email', prompt: 'enter your email', autocomplete: 'email', maxLength: 35, required: true },
  { key: 'message', prompt: 'enter your message', autocomplete: 'off', maxLength: 100, required: true },
];

const form = document.getElementById('contact-form');
const listEl = document.getElementById('question-list');
const statusEl = document.getElementById('form-status');

const inputEl = document.createElement('textarea');
const rows = [];
const answers = {};
const typedQuestions = new Set();

let stepIndex = 0;
let furthestVisitedIndex = 0;
let isSending = false;
let isInputReady = false;
let promptTimer = 0;

inputEl.id = 'terminal-input';
inputEl.className = 'terminal-input';
inputEl.rows = 1;
inputEl.wrap = 'soft';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function setStatus(message, state = '') {
  statusEl.textContent = message;
  statusEl.className = `form-status ${state}`.trim();
}

function updateEditableRows() {
  rows.forEach(({ answer, index, row, step }) => {
    const isActive = index === stepIndex;
    const isSelectable = canSelectStep(index);

    row.classList.toggle('is-editable', isSelectable && !isActive);

    if (isActive) return;

    answer.setAttribute('aria-label', `edit ${step.prompt}`);
    answer.setAttribute('role', 'button');
    answer.tabIndex = isSelectable ? 0 : -1;
  });
}

function keepViewportStatic() {
  // The contact form grows as answers are typed; on wide screens the footer should stay anchored.
  const shouldAllowScroll = window.matchMedia('(max-width: 760px), (max-height: 640px)').matches;
  if (shouldAllowScroll) return;
  if (!form.hidden && window.scrollY !== 0) window.scrollTo(0, 0);
}

function syncInputSize() {
  inputEl.style.height = 'auto';
  inputEl.style.height = `${inputEl.scrollHeight}px`;
  keepViewportStatic();
}

function moveCaretToEnd() {
  const end = inputEl.value.length;
  inputEl.setSelectionRange(end, end);
}

function setInputEnabled(enabled) {
  isInputReady = enabled;
  inputEl.disabled = !enabled;
  updateEditableRows();

  if (enabled) {
    inputEl.focus({ preventScroll: true });
    moveCaretToEnd();
    window.requestAnimationFrame(keepViewportStatic);
  }
}

function rememberCurrentValue() {
  answers[steps[stepIndex].key] = inputEl.value.trim();
}

function canSelectStep(index) {
  return !isSending && isInputReady && index <= furthestVisitedIndex;
}

function selectStep(index) {
  if (index === stepIndex || !canSelectStep(index)) return;

  rememberCurrentValue();
  stepIndex = index;
  renderStep();
}

function createRows() {
  steps.forEach((step, index) => {
    const row = document.createElement('div');
    const question = document.createElement('p');
    const prompt = document.createElement('span');
    const answer = document.createElement('label');
    const answerText = document.createElement('span');

    row.className = 'question-row';
    question.className = 'question-line';
    prompt.className = 'question-prompt';
    answer.className = 'answer-line';
    answerText.className = 'answer-text';

    // Completed terminal rows act like editable input fields.
    answer.addEventListener('click', () => selectStep(index));
    answer.addEventListener('keydown', (event) => {
      if (event.target === inputEl) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      selectStep(index);
    });

    question.append(prompt);
    answer.append(answerText);
    row.append(question, answer);
    listEl.append(row);

    rows.push({ answer, answerText, prompt, row, step, index });
  });
}

function typeQuestion(row, onDone) {
  const { index, prompt, row: rowEl, step } = row;

  window.clearTimeout(promptTimer);
  rowEl.classList.add('is-revealed');

  if (typedQuestions.has(index) || remainingTypingCharacters <= 0 || prefersReducedMotion()) {
    prompt.textContent = step.prompt;
    typedQuestions.add(index);
    onDone();
    return;
  }

  prompt.textContent = '';
  let charIndex = 0;

  function typeNextChar() {
    if (charIndex >= step.prompt.length || remainingTypingCharacters <= 0) {
      prompt.textContent = step.prompt;
      typedQuestions.add(index);
      onDone();
      return;
    }

    prompt.textContent += step.prompt.charAt(charIndex);
    charIndex += 1;
    remainingTypingCharacters -= 1;
    promptTimer = window.setTimeout(typeNextChar, QUESTION_TYPE_SPEED_MS);
  }

  typeNextChar();
}

function renderRows() {
  rows.forEach(({ answer, answerText, index, row, step }) => {
    const answerValue = answers[step.key] || '';
    const isActive = index === stepIndex;
    const isSelectable = canSelectStep(index);

    row.classList.toggle('is-active', isActive);
    row.classList.toggle('is-revealed', typedQuestions.has(index) || isActive);
    row.classList.toggle('has-answer', Boolean(answerValue));
    answerText.textContent = answerValue;

    if (isActive) {
      answerText.textContent = '';
      inputEl.value = answerValue;
      inputEl.autocomplete = step.autocomplete;
      if (step.maxLength) inputEl.maxLength = step.maxLength;
      else inputEl.removeAttribute('maxlength');
      inputEl.required = Boolean(step.required);
      inputEl.inputMode = step.key === 'email' ? 'email' : 'text';
      answer.htmlFor = inputEl.id;
      answer.removeAttribute('aria-label');
      answer.removeAttribute('role');
      answer.removeAttribute('tabindex');
      answer.replaceChildren(inputEl);
      syncInputSize();
      return;
    }

    answer.removeAttribute('for');
    answer.setAttribute('aria-label', `edit ${step.prompt}`);
    answer.setAttribute('role', 'button');
    answer.tabIndex = isSelectable ? 0 : -1;
    answer.replaceChildren(answerText);
  });

  updateEditableRows();
}

function renderStep() {
  form.hidden = false;
  setInputEnabled(false);
  setStatus('');
  renderRows();
  typeQuestion(rows[stepIndex], () => setInputEnabled(!isSending));
}

function validate(step, value) {
  if (step.required && !value.trim()) return 'this field is required';
  if (step.maxLength && value.length > step.maxLength) {
    return `${step.key} must be ${step.maxLength} characters or less`;
  }
  if (step.key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'enter a valid email';
  return '';
}

async function sendContact() {
  isSending = true;
  setInputEnabled(false);
  setStatus('sending...', '');

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'message was not sent');

    setStatus('thank you. we will contact you soon.', 'is-success');
  } catch (error) {
    isSending = false;
    setInputEnabled(true);
    setStatus(error.message, 'is-error');
  }
}

function goNext() {
  if (isSending || !isInputReady) return;

  const step = steps[stepIndex];
  const value = inputEl.value.trim();
  const error = validate(step, value);

  if (error) {
    setStatus(error, 'is-error');
    return;
  }

  answers[step.key] = value;

  if (stepIndex === steps.length - 1) {
    renderRows();
    sendContact();
    return;
  }

  stepIndex += 1;
  furthestVisitedIndex = Math.max(furthestVisitedIndex, stepIndex);
  renderStep();
}

function goPrevious() {
  if (isSending || !isInputReady || stepIndex === 0) return;

  rememberCurrentValue();
  stepIndex -= 1;
  renderStep();
}

function handleTerminalInputKeydown(event) {
  if (event.isComposing) return;

  // Enter commits the current input: it moves forward or sends on the last question.
  if (event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    goNext();
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    event.stopPropagation();
    goNext();
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    event.stopPropagation();
    goPrevious();
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  goNext();
});

inputEl.addEventListener('input', syncInputSize);
inputEl.addEventListener('keydown', handleTerminalInputKeydown);

window.addEventListener('scroll', keepViewportStatic, { passive: true });

createRows();
document.addEventListener('dimundi:intro-typed', renderStep);
