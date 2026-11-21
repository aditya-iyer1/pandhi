/** Daily games: links out to each game, plus a shared log of our daily stats. */
const Games = {
  GAMES: [
    {
      id: 'krillion',
      name: 'Krillion',
      url: 'https://krillion.io',
      fields: [
        { key: 'score', label: 'Score', type: 'number', min: 0 },
        { key: 'pct_beat', label: '% of users beat today', type: 'number', min: 0, max: 100 },
      ],
      summary: (d) => `${d.score} · beat ${d.pct_beat}%`,
    },
    {
      id: 'minute_cryptic',
      name: 'Minute Cryptic',
      url: 'https://www.minutecryptic.com/',
      fields: [{ key: 'hints_used', label: 'Any hints used?', type: 'bool' }],
      summary: (d) => (d.hints_used ? 'hints used' : 'no hints'),
    },
    {
      id: 'dowsle',
      name: 'Dowsle',
      url: 'https://dowsle.com/',
      fields: [
        { key: 'our_guesses', label: 'Guesses we took', type: 'int', min: 1 },
        { key: 'avg_guesses', label: 'Average guesses (everyone)', type: 'number', min: 0 },
      ],
      summary: (d) => `${d.our_guesses} guesses (avg ${d.avg_guesses})`,
    },
    {
      id: 'skyq',
      name: 'SkyQ',
      url: 'https://flightq.app/skyq',
      fields: [{ key: 'correct', label: 'How many did we get?', type: 'choice', options: [0, 1, 2, 3] }],
      summary: (d) => `${d.correct}/3`,
    },
    {
      id: 'noillirk',
      name: 'Noillirk',
      url: 'https://noillirk.com',
      fields: [{ key: 'score', label: 'Score', type: 'number' }],
      summary: (d) => `${d.score}`,
    },
  ],

  HISTORY_LIMIT: 7,
  logs: [],
  date: null,

  todayStr() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },

  prettyDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  },

  async load() {
    const root = document.getElementById('games-root');
    if (!root) return;
    if (!this.date) this.date = this.todayStr();
    root.innerHTML = `<p class="empty-state">Loading games…</p>`;
    try {
      this.logs = await App.api('/game-logs');
      this.render();
    } catch (err) {
      root.innerHTML = `<p class="empty-state">Couldn’t load game logs. ${escapeHtml(err.message)}</p>`;
    }
  },

  entryFor(gameId, date = this.date) {
    return this.logs.find((l) => l.game === gameId && l.play_date === date) || null;
  },

  render() {
    const root = document.getElementById('games-root');
    if (!root) return;

    root.innerHTML = `
      <div class="gamelog">
        <div class="gamelog-date">
          <label for="gamelog-date-input">Date</label>
          <input type="date" id="gamelog-date-input" value="${this.date}" max="${this.todayStr()}" />
          <button type="button" class="btn-ghost" id="gamelog-today">Today</button>
        </div>
        ${this.GAMES.map((g) => this.cardHtml(g)).join('')}
      </div>`;

    const dateInput = document.getElementById('gamelog-date-input');
    dateInput.addEventListener('change', () => {
      if (!dateInput.value) return;
      this.date = dateInput.value;
      this.render();
    });
    document.getElementById('gamelog-today').addEventListener('click', () => {
      this.date = this.todayStr();
      this.render();
    });

    root.querySelectorAll('form.gamelog-form').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.save(form);
      });
    });
    root.querySelectorAll('[data-clear]').forEach((btn) => {
      btn.addEventListener('click', () => this.clear(btn.dataset.clear));
    });
  },

  fieldHtml(game, f, value) {
    const id = `gl-${game.id}-${f.key}`;
    if (f.type === 'bool') {
      const yes = value === true ? 'checked' : '';
      const no = value === false ? 'checked' : '';
      return `
        <div class="field">
          <span class="field-label">${f.label}</span>
          <div class="pill-group">
            <label><input type="radio" name="${id}" value="false" ${no} required /> No</label>
            <label><input type="radio" name="${id}" value="true" ${yes} required /> Yes</label>
          </div>
        </div>`;
    }
    if (f.type === 'choice') {
      return `
        <div class="field">
          <span class="field-label">${f.label}</span>
          <div class="pill-group">
            ${f.options
              .map(
                (o) =>
                  `<label><input type="radio" name="${id}" value="${o}" ${value === o ? 'checked' : ''} required /> ${o}/3</label>`
              )
              .join('')}
          </div>
        </div>`;
    }
    const attrs = [
      f.min !== undefined ? `min="${f.min}"` : '',
      f.max !== undefined ? `max="${f.max}"` : '',
      f.type === 'int' ? 'step="1" inputmode="numeric"' : 'step="any" inputmode="decimal"',
    ].join(' ');
    return `
      <div class="field">
        <label for="${id}">${f.label}</label>
        <input type="number" id="${id}" name="${id}" ${attrs} value="${value ?? ''}" required />
      </div>`;
  },

  cardHtml(game) {
    const entry = this.entryFor(game.id);
    const history = this.logs
      .filter((l) => l.game === game.id)
      .slice(0, this.HISTORY_LIMIT)
      .map(
        (l) =>
          `<li><span>${this.prettyDate(l.play_date)}</span><span>${escapeHtml(game.summary(l.data))}</span></li>`
      )
      .join('');

    return `
      <article class="gamelog-card" data-game="${game.id}">
        <header class="gamelog-head">
          <h3>${game.name}</h3>
          ${entry ? '<span class="logged-badge">✓ logged</span>' : ''}
          <a class="play-link" href="${game.url}" target="_blank" rel="noopener noreferrer">Play ↗</a>
        </header>
        <form class="gamelog-form" data-game="${game.id}">
          ${game.fields.map((f) => this.fieldHtml(game, f, entry?.data[f.key])).join('')}
          <div class="gamelog-actions">
            <button type="submit" class="btn-secondary">${entry ? 'Update' : 'Save'}</button>
            ${entry ? `<button type="button" class="btn-ghost" data-clear="${game.id}">Clear</button>` : ''}
            <span class="error-msg" data-msg></span>
          </div>
        </form>
        ${
          history
            ? `<details class="gamelog-history"><summary>Recent</summary><ul>${history}</ul></details>`
            : ''
        }
      </article>`;
  },

  readForm(game, form) {
    const data = {};
    for (const f of game.fields) {
      const name = `gl-${game.id}-${f.key}`;
      if (f.type === 'bool') {
        data[f.key] = form.elements[name].value === 'true';
      } else {
        data[f.key] = Number(form.elements[name].value);
      }
    }
    return data;
  },

  setMsg(form, text, ok = false) {
    const el = form.querySelector('[data-msg]');
    if (!el) return;
    el.textContent = text;
    el.style.color = ok ? 'var(--ink-muted)' : '';
  },

  async save(form) {
    const game = this.GAMES.find((g) => g.id === form.dataset.game);
    if (!game) return;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    this.setMsg(form, 'Saving…', true);
    try {
      const saved = await App.api(`/game-logs/${game.id}/${this.date}`, {
        method: 'PUT',
        body: JSON.stringify({ username: App.username, data: this.readForm(game, form) }),
      });
      this.logs = this.logs.filter((l) => !(l.game === saved.game && l.play_date === saved.play_date));
      this.logs.push(saved);
      this.logs.sort((a, b) => b.play_date.localeCompare(a.play_date));
      this.render();
    } catch (err) {
      this.setMsg(form, err.message);
      submit.disabled = false;
    }
  },

  async clear(gameId) {
    const game = this.GAMES.find((g) => g.id === gameId);
    if (!game || !confirm(`Clear ${game.name} for ${this.prettyDate(this.date)}?`)) return;
    try {
      await App.api(`/game-logs/${gameId}/${this.date}`, { method: 'DELETE' });
      this.logs = this.logs.filter((l) => !(l.game === gameId && l.play_date === this.date));
      this.render();
    } catch (err) {
      alert(err.message);
    }
  },
};
