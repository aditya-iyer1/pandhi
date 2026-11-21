/** Light / dark mode. Light is the default; the choice is remembered per browser. */
const THEME_KEY = 'puffage_theme';

const Theme = {
  get() {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  },

  apply(theme) {
    document.documentElement.dataset.theme = theme;
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      const next = theme === 'dark' ? 'light' : 'dark';
      btn.setAttribute('aria-label', `Switch to ${next} mode`);
      btn.title = `Switch to ${next} mode`;
    }
  },

  toggle() {
    const next = this.get() === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable: still switch for this page view */
    }
    this.apply(next);
  },

  init() {
    this.apply(document.documentElement.dataset.theme || this.get());
    document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggle());
  },
};

// Apply before first paint (script is loaded in <head>) to avoid a flash of the wrong theme.
Theme.apply(Theme.get());
document.addEventListener('DOMContentLoaded', () => Theme.init());
