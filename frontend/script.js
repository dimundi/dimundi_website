const TYPE_SPEED_MS = 35;
// One shared limit for the heading, menu and contact prompts on each page load.
let remainingTypingCharacters = 35;
const THEME_STORAGE_KEY = 'dimundi-theme';
const browserThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

function getBrowserTheme() {
  return browserThemeQuery.matches ? 'dark' : 'light';
}

function getStoredTheme() {
  try {
    const theme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return theme === 'dark' || theme === 'light' ? theme : null;
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The theme still applies for the current session when storage is unavailable.
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;

  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;

  const isDark = theme === 'dark';
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
  themeToggle.title = isDark ? 'Switch to light theme' : 'Switch to dark theme';
}

function setInitialTheme() {
  applyTheme(getStoredTheme() || getBrowserTheme());
}

setInitialTheme();

// Keep full company details visible on desktop and collapsible on mobile.
const footerDetails = document.querySelector('.footer-details');
if (footerDetails) {
  const mobileFooterQuery = window.matchMedia('(max-width: 770px)');
  const syncFooterDetails = () => {
    footerDetails.open = !mobileFooterQuery.matches;
  };
  syncFooterDetails();
  mobileFooterQuery.addEventListener('change', syncFooterDetails);
}

function typeWriter(targetEl, speed, onDone) {
  const text = targetEl.textContent;

  if (remainingTypingCharacters <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    onDone?.();
    return;
  }

  targetEl.textContent = '';

  let index = 0;
  function typeNextChar() {
    if (index >= text.length || remainingTypingCharacters <= 0) {
      targetEl.textContent = text;
      onDone?.();
      return;
    }

    targetEl.textContent += text.charAt(index);
    index += 1;
    remainingTypingCharacters -= 1;
    window.setTimeout(typeNextChar, speed);
  }

  typeNextChar();
}

document.addEventListener('DOMContentLoaded', () => {
  const introEl = document.querySelector('.typed');
  const cursorEl = document.getElementById('cursor');
  const themeToggle = document.getElementById('themeToggle');

  applyTheme(document.documentElement.dataset.theme || getBrowserTheme());

  themeToggle?.addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    storeTheme(nextTheme);
    applyTheme(nextTheme);
  });

  browserThemeQuery.addEventListener('change', () => {
    if (!getStoredTheme()) applyTheme(getBrowserTheme());
  });

  if (!introEl) return;

  typeWriter(introEl, TYPE_SPEED_MS, () => {
    if (cursorEl) cursorEl.hidden = true;
    document.dispatchEvent(new CustomEvent('dimundi:intro-typed'));
  });
});
