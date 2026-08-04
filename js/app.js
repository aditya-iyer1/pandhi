const STORAGE_KEY = 'puffage_username';

const App = {
  username: null,

  getUsername() {
    return localStorage.getItem(STORAGE_KEY);
  },

  setUsername(name) {
    const normalized = String(name).toLowerCase().trim();
    localStorage.setItem(STORAGE_KEY, normalized);
    this.username = normalized;
  },

  /** Visible label — login id `kothi123` displays as `kothi`. */
  displayName(name = this.username) {
    const n = String(name || '').toLowerCase().trim();
    if (n === 'kothi123') return 'kothi';
    return n;
  },

  clearUsername() {
    localStorage.removeItem(STORAGE_KEY);
    this.username = null;
  },

  async api(path, options = {}) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || res.statusText || 'Request failed');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  showScreen(id) {
    document.querySelectorAll('.screen').forEach((el) => {
      el.classList.remove('active', 'fading-out');
    });
    document.querySelectorAll('.panel-view').forEach((el) => {
      el.classList.remove('active');
    });
    const screen = document.getElementById(id);
    if (screen) screen.classList.add('active');
  },

  fadeToScreen(fromId, toId, delayMs = 450) {
    const from = document.getElementById(fromId);
    if (!from) {
      this.showScreen(toId);
      return;
    }
    from.classList.add('fading-out');
    setTimeout(() => {
      this.showScreen(toId);
    }, delayMs);
  },

  PANELS: ['timeline', 'story', 'messages', 'games'],

  showPanel(name) {
    document.querySelectorAll('.screen').forEach((el) => {
      el.classList.remove('active', 'fading-out');
    });
    document.querySelectorAll('.panel-view').forEach((el) => {
      el.classList.remove('active');
    });
    const panel = document.getElementById(`panel-${name}`);
    if (panel) panel.classList.add('active');
  },

  renderPanel(name) {
    this.showPanel(name);
    if (name === 'timeline' && typeof Timeline !== 'undefined') Timeline.load();
    if (name === 'story' && typeof Story !== 'undefined') Story.load();
    if (name === 'messages' && typeof Messages !== 'undefined') Messages.load();
    if (name === 'games' && typeof Games !== 'undefined') Games.showLobby();
  },

  openPanel(name) {
    if (!this.requireAuth()) return;
    if (location.hash === `#${name}`) {
      this.renderPanel(name);
    } else {
      // hashchange listener does the rendering
      location.hash = name;
    }
  },

  showHub() {
    if (typeof Games !== 'undefined' && Games.stopPolling) {
      Games.stopPolling();
    }
    this.showScreen('screen-hub');
    const userEl = document.getElementById('hub-user');
    if (userEl && this.username) {
      userEl.textContent = `hi, ${this.displayName()}`;
    }
    if (typeof Hub !== 'undefined') Hub.renderCounters();
  },

  backToHub() {
    if (location.hash) {
      // hashchange listener shows the hub
      location.hash = '';
    } else {
      this.showHub();
    }
  },

  handleHash() {
    const name = location.hash.replace('#', '');
    if (!this.getUsername()) return;
    this.username = this.getUsername();
    if (this.PANELS.includes(name)) {
      this.renderPanel(name);
    } else {
      this.showHub();
    }
  },

  requireAuth() {
    const name = this.getUsername();
    if (!name) {
      this.showScreen('screen-login');
      return false;
    }
    this.username = name;
    return true;
  },

  init() {
    this.username = this.getUsername();

    document.querySelectorAll('[data-back]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.id === 'games-back' && typeof Games !== 'undefined' && Games.isInGameView?.()) {
          Games.showLobby();
          return;
        }
        this.backToHub();
      });
    });

    if (typeof Unlock !== 'undefined') Unlock.init();
    if (typeof Login !== 'undefined') Login.init();
    if (typeof Letter !== 'undefined') Letter.init();
    if (typeof Hub !== 'undefined') Hub.init();
    if (typeof Timeline !== 'undefined') Timeline.init();
    if (typeof Story !== 'undefined') Story.init();
    if (typeof Messages !== 'undefined') Messages.init();
    if (typeof Games !== 'undefined') Games.init();

    window.addEventListener('hashchange', () => this.handleHash());

    // Returning visitor with stored username skips unlock/login;
    // restore the panel from the URL hash if there is one
    if (this.username) {
      // Migrate old username if needed
      if (this.username === 'kothi') {
        this.setUsername('kothi123');
      }
      this.handleHash();
      if (typeof Letter !== 'undefined') Letter.maybeShow();
      if (typeof Story !== 'undefined') Story.refreshHubLabel();
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
