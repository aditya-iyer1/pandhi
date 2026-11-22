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
      chart: {
        kind: 'line',
        series: [
          { key: 'score', label: 'Score', axis: 'left', color: 'a' },
          { key: 'pct_beat', label: '% beat', axis: 'right', color: 'b', suffix: '%' },
        ],
      },
      stats: (rows) => [
        ['Best score', Games.max(rows, 'score')],
        ['Avg score', Games.avg(rows, 'score')],
        ['Avg % beat', Games.avg(rows, 'pct_beat') + '%'],
      ],
    },
    {
      id: 'minute_cryptic',
      name: 'Minute Cryptic',
      url: 'https://www.minutecryptic.com/',
      fields: [{ key: 'hints_used', label: 'Any hints used?', type: 'bool' }],
      summary: (d) => (d.hints_used ? 'hints used' : 'no hints'),
      chart: { kind: 'dots', key: 'hints_used' },
      stats: (rows) => [
        ['No-hint rate', Math.round((100 * rows.filter((r) => !r.hints_used).length) / rows.length) + '%'],
        ['No-hint streak', Games.streak(rows, (r) => !r.hints_used)],
        ['Days played', rows.length],
      ],
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
      chart: {
        kind: 'line',
        series: [
          { key: 'our_guesses', label: 'Us', axis: 'left', color: 'a' },
          { key: 'avg_guesses', label: 'Everyone', axis: 'left', color: 'b' },
        ],
      },
      stats: (rows) => [
        ['Our avg', Games.avg(rows, 'our_guesses')],
        ['Everyone avg', Games.avg(rows, 'avg_guesses')],
        ['Beat the avg', rows.filter((r) => r.our_guesses < r.avg_guesses).length + '/' + rows.length],
      ],
    },
    {
      id: 'skyq',
      name: 'SkyQ',
      url: 'https://flightq.app/skyq',
      fields: [{ key: 'correct', label: 'How many did we get?', type: 'choice', options: [0, 1, 2, 3] }],
      summary: (d) => `${d.correct}/3`,
      chart: { kind: 'bar', series: [{ key: 'correct', label: 'Correct', axis: 'left', color: 'a' }], yMax: 3 },
      stats: (rows) => [
        ['Avg', Games.avg(rows, 'correct') + '/3'],
        ['Perfect days', rows.filter((r) => r.correct === 3).length],
        ['Days played', rows.length],
      ],
    },
    {
      id: 'noillirk',
      name: 'Noillirk',
      url: 'https://noillirk.com',
      fields: [{ key: 'score', label: 'Score', type: 'number' }],
      summary: (d) => `${d.score}`,
      chart: { kind: 'line', series: [{ key: 'score', label: 'Score', axis: 'left', color: 'a' }] },
      stats: (rows) => [
        ['Best', Games.max(rows, 'score')],
        ['Avg', Games.avg(rows, 'score')],
        ['Days played', rows.length],
      ],
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
      this.startPolling();
    } catch (err) {
      root.innerHTML = `<p class="empty-state">Couldn’t load game logs. ${escapeHtml(err.message)}</p>`;
    }
  },


  /* ---------- analytics ---------- */

  avg(rows, key) {
    if (!rows.length) return '–';
    return Math.round((rows.reduce((t, r) => t + r[key], 0) / rows.length) * 100) / 100;
  },

  max(rows, key) {
    return rows.length ? Math.max(...rows.map((r) => r[key])) : '–';
  },

  /** Consecutive qualifying days counting back from the latest log. */
  streak(rows, ok) {
    let n = 0;
    for (let i = rows.length - 1; i >= 0 && ok(rows[i]); i--) n++;
    return n;
  },

  rowsFor(gameId) {
    return this.logs
      .filter((l) => l.game === gameId)
      .sort((a, b) => a.play_date.localeCompare(b.play_date))
      .map((l) => ({ date: l.play_date, ...l.data }));
  },

  dayNum(str) {
    const [y, m, d] = str.split('-').map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / 86400000);
  },

  shortDate(str) {
    const [, m, d] = str.split('-').map(Number);
    return `${m}/${d}`;
  },

  /** A round-numbered axis covering [lo, hi] with ~4 ticks. */
  niceAxis(lo, hi, forceMax) {
    if (hi === lo) {
      hi += 1;
      lo = Math.max(0, lo - 1);
    }
    const raw = (hi - lo) / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw);
    const min = Math.floor(lo / step) * step;
    const max = forceMax ?? Math.ceil(hi / step) * step;
    const ticks = [];
    for (let v = min; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
    return { min, max, ticks };
  },

  chartHtml(game) {
    const rows = this.rowsFor(game.id);
    const title = `<h4>Analytics</h4>`;
    if (!rows.length) {
      return `${title}<p class="chart-empty">Log a few days of ${escapeHtml(game.name)} and the trend shows up here.</p>`;
    }
    const spec = game.chart;
    const body = spec.kind === 'dots' ? this.dotsHtml(rows, spec) : this.svgChart(game, rows);
    const stats = game
      .stats(rows)
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
      .join('');
    return `${title}${body}<dl class="chart-stats">${stats}</dl>`;
  },

  dotsHtml(rows, spec) {
    const cells = rows
      .slice(-42)
      .map((r) => {
        const bad = r[spec.key];
        return `<span class="dot ${bad ? 'bad' : 'good'}" title="${this.prettyDate(r.date)}: ${bad ? 'hints used' : 'no hints'}"></span>`;
      })
      .join('');
    return `<div class="chart-dots">${cells}</div>
      <div class="chart-legend"><span><i class="swatch good"></i>No hints</span><span><i class="swatch bad"></i>Hints used</span></div>`;
  },

  svgChart(game, rows) {
    const { kind, series, yMax } = game.chart;
    const W = 360, H = 210;
    const pad = { l: 36, r: series.some((s) => s.axis === 'right') ? 36 : 14, t: 12, b: 30 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

    const axes = {};
    for (const side of ['left', 'right']) {
      const vals = series.filter((s) => s.axis === side).flatMap((s) => rows.map((r) => r[s.key]));
      if (!vals.length) continue;
      const lo = kind === 'bar' ? 0 : Math.min(...vals);
      axes[side] = this.niceAxis(lo, Math.max(...vals), yMax);
    }
    const y = (side, v) => {
      const a = axes[side];
      return pad.t + ih - ((v - a.min) / (a.max - a.min)) * ih;
    };

    const d0 = this.dayNum(rows[0].date), d1 = this.dayNum(rows[rows.length - 1].date);
    const x = (r, i) => {
      if (kind === 'bar') return pad.l + (iw * (i + 0.5)) / rows.length;
      if (d1 === d0) return pad.l + iw / 2;
      return pad.l + 8 + ((this.dayNum(r.date) - d0) / (d1 - d0)) * (iw - 16);
    };

    let out = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="${escapeHtml(game.name)} over time">`;

    // grid + y labels
    const base = axes.left ? 'left' : 'right';
    for (const t of axes[base].ticks) {
      const ty = y(base, t);
      out += `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${ty}" y2="${ty}"/>`;
    }
    for (const side of Object.keys(axes)) {
      const sx = side === 'left' ? pad.l - 6 : W - pad.r + 6;
      const color = series.length > 1 ? series.find((s) => s.axis === side).color : null;
      for (const t of axes[side].ticks) {
        out += `<text class="tick ${color ? 'c-' + color : ''}" x="${sx}" y="${y(side, t) + 3}" text-anchor="${side === 'left' ? 'end' : 'start'}">${t}</text>`;
      }
    }

    // x labels (at most 5)
    const every = Math.max(1, Math.ceil(rows.length / 5));
    rows.forEach((r, i) => {
      if (i % every === 0 || i === rows.length - 1) {
        out += `<text class="tick" x="${x(r, i)}" y="${H - 10}" text-anchor="middle">${this.shortDate(r.date)}</text>`;
      }
    });

    for (const s of series) {
      const sy = (v) => y(s.axis, v);
      if (kind === 'bar') {
        const bw = Math.min(26, (iw / rows.length) * 0.65);
        rows.forEach((r, i) => {
          const top = sy(r[s.key]), bot = y(s.axis, axes[s.axis].min);
          out += `<rect class="bar c-${s.color}" x="${x(r, i) - bw / 2}" y="${top}" width="${bw}" height="${Math.max(bot - top, 1)}" rx="4"><title>${this.prettyDate(r.date)}: ${r[s.key]}</title></rect>`;
        });
      } else {
        const pts = rows.map((r, i) => `${x(r, i).toFixed(1)},${sy(r[s.key]).toFixed(1)}`);
        if (rows.length > 1) out += `<polyline class="line c-${s.color}" points="${pts.join(' ')}"/>`;
        rows.forEach((r, i) => {
          out += `<circle class="pt c-${s.color}" cx="${x(r, i).toFixed(1)}" cy="${sy(r[s.key]).toFixed(1)}" r="4"><title>${this.prettyDate(r.date)} · ${s.label}: ${r[s.key]}${s.suffix || ''}</title></circle>`;
        });
      }
    }
    out += '</svg>';

    if (series.length > 1) {
      out += `<div class="chart-legend">${series
        .map((s) => `<span><i class="swatch c-${s.color}"></i>${s.label}</span>`)
        .join('')}</div>`;
    }
    return out;
  },

  refreshCharts() {
    document.querySelectorAll('#games-root [data-chart]').forEach((el) => {
      const game = this.GAMES.find((g) => g.id === el.dataset.chart);
      if (game) el.innerHTML = this.chartHtml(game);
    });
  },

  /** Pick up the other person's logs while the Games panel is open. */
  startPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(async () => {
      const root = document.getElementById('games-root');
      if (!root || !root.offsetParent || document.hidden) return;
      try {
        const fresh = await App.api('/game-logs');
        if (JSON.stringify(fresh) === JSON.stringify(this.logs)) return;
        this.logs = fresh;
        // Don't wipe a half-typed form: only redraw everything when nothing is focused in it.
        if (root.contains(document.activeElement) && document.activeElement.closest('form')) this.refreshCharts();
        else this.render();
      } catch {
        /* try again next tick */
      }
    }, 15000);
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
        ${this.GAMES.map(
          (g) => `<div class="gamelog-row">${this.cardHtml(g)}<aside class="gamelog-chart" data-chart="${g.id}">${this.chartHtml(g)}</aside></div>`
        ).join('')}
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
