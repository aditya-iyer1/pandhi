const Games = {
  pollTimer: null,
  currentGameId: null,
  view: 'lobby', // lobby | play | create
  gamesCache: [],

  init() {
    // loaded on panel open
  },

  isInGameView() {
    return this.view === 'play' || this.view === 'create';
  },

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },

  startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      if (this.currentGameId) this.refreshGame(this.currentGameId, true);
    }, 7000);
  },

  async showLobby() {
    this.view = 'lobby';
    this.currentGameId = null;
    this.stopPolling();
    const title = document.getElementById('games-title');
    const root = document.getElementById('games-root');
    if (title) title.textContent = 'Games';
    if (!root) return;
    root.innerHTML = `<p class="empty-state">Loading games…</p>`;

    try {
      const games = await App.api('/games');
      this.gamesCache = games;
      const active20 = games.find((g) => g.type === 'twenty_questions' && g.status === 'active');
      const activeWl = games.find((g) => g.type === 'wavelength' && g.status === 'active');
      const finished = games.filter((g) => g.status === 'finished').slice(0, 20);

      root.innerHTML = `
        <div class="games-lobby">
          <div class="game-card">
            <div class="game-info">
              <h3>20 Questions</h3>
              <p>${active20 ? 'Game in progress — view/respond' : 'No active game'}</p>
            </div>
            ${
              active20
                ? `<button type="button" class="btn-primary" data-open-game="${active20.id}">View / Respond</button>`
                : `<button type="button" class="btn-primary" data-create="twenty_questions">Start new game</button>`
            }
          </div>
          <div class="game-card">
            <div class="game-info">
              <h3>Wavelength</h3>
              <p>${activeWl ? 'Game in progress — view/respond' : 'No active game'}</p>
            </div>
            ${
              activeWl
                ? `<button type="button" class="btn-primary" data-open-game="${activeWl.id}">View / Respond</button>`
                : `<button type="button" class="btn-primary" data-create="wavelength">Start new game</button>`
            }
          </div>
          ${
            finished.length
              ? `<div class="replay-list">
                  <h3>Past games (replay)</h3>
                  ${finished
                    .map(
                      (g) => `
                    <button type="button" class="replay-item" data-open-game="${g.id}">
                      <span>${escapeHtml(this.labelType(g.type))} · ${escapeHtml(App.displayName(g.starter_username))}</span>
                      <span>${escapeHtml(this.fmtDate(g.updated_at || g.created_at))}</span>
                    </button>`
                    )
                    .join('')}
                </div>`
              : ''
          }
        </div>`;

      root.querySelectorAll('[data-create]').forEach((btn) => {
        btn.addEventListener('click', () => this.showCreate(btn.dataset.create));
      });
      root.querySelectorAll('[data-open-game]').forEach((btn) => {
        btn.addEventListener('click', () => this.openGame(Number(btn.dataset.openGame)));
      });
    } catch {
      root.innerHTML = `<p class="empty-state">Could not load games. Is the backend running?</p>`;
    }
  },

  labelType(type) {
    return type === 'twenty_questions' ? '20 Questions' : 'Wavelength';
  },

  fmtDate(iso) {
    try {
      return new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z').toLocaleString();
    } catch {
      return iso;
    }
  },

  showCreate(type) {
    this.view = 'create';
    const title = document.getElementById('games-title');
    const root = document.getElementById('games-root');
    if (title) title.textContent = `New ${this.labelType(type)}`;
    if (!root) return;

    if (type === 'twenty_questions') {
      root.innerHTML = `
        <form class="game-play" id="create-20q">
          <div class="field">
            <label for="secret-20q">Secret answer</label>
            <input id="secret-20q" required placeholder="What are they guessing?" />
          </div>
          <div class="field">
            <label for="category-20q">Category</label>
            <select id="category-20q" required>
              <option value="people we know">people we know</option>
              <option value="celebrities">celebrities</option>
              <option value="characters">characters</option>
            </select>
          </div>
          <p class="error-msg" id="create-error"></p>
          <button type="submit" class="btn-primary">Start game</button>
        </form>`;
      document.getElementById('create-20q').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.createGame({
          type: 'twenty_questions',
          starter_username: App.username,
          secret: document.getElementById('secret-20q').value.trim(),
          category: document.getElementById('category-20q').value,
        });
      });
    } else {
      root.innerHTML = `
        <form class="game-play" id="create-wl">
          <div class="field">
            <label for="secret-wl">Secret number (1–100)</label>
            <input id="secret-wl" type="number" min="1" max="100" required />
          </div>
          <p class="hint">You're Person A. The other player will ask questions and guess.</p>
          <p class="error-msg" id="create-error"></p>
          <button type="submit" class="btn-primary">Start game</button>
        </form>`;
      document.getElementById('create-wl').addEventListener('submit', async (e) => {
        e.preventDefault();
        const n = Number(document.getElementById('secret-wl').value);
        await this.createGame({
          type: 'wavelength',
          starter_username: App.username,
          secret: n,
        });
      });
    }
  },

  async createGame(payload) {
    const errorEl = document.getElementById('create-error');
    try {
      const game = await App.api('/games', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await this.openGame(game.id);
    } catch (err) {
      if (errorEl) errorEl.textContent = err.message || 'Could not create game.';
    }
  },

  async openGame(id) {
    this.view = 'play';
    this.currentGameId = id;
    await this.refreshGame(id, false);
    this.startPolling();
  },

  async refreshGame(id, quiet) {
    const root = document.getElementById('games-root');
    const title = document.getElementById('games-title');
    try {
      const game = await App.api(`/games/${id}`);
      if (title) {
        title.textContent =
          this.labelType(game.type) + (game.status === 'finished' ? ' (finished)' : '');
      }
      if (game.type === 'twenty_questions') {
        this.render20Q(root, game);
      } else {
        this.renderWavelength(root, game);
      }
    } catch {
      if (!quiet && root) {
        root.innerHTML = `<p class="empty-state">Could not load game.</p>`;
      }
    }
  },

  parseData(game) {
    if (typeof game.data_json === 'string') {
      try {
        return JSON.parse(game.data_json);
      } catch {
        return {};
      }
    }
    return game.data_json || {};
  },

  render20Q(root, game) {
    const data = this.parseData(game);
    const me = App.username;
    const isStarter = me === game.starter_username;
    const finished = game.status === 'finished';
    const guesses = data.guesses || [];
    const pending = guesses.filter((g) => !g.response);

    let actions = '';
    if (!finished && !isStarter) {
      actions = `
        <form class="game-actions" id="guess-form">
          <div class="field">
            <label for="guess-text">Your guess / question</label>
            <input id="guess-text" required placeholder="Is it…?" />
          </div>
          <button type="submit" class="btn-primary">Submit</button>
        </form>`;
    } else if (!finished && isStarter && pending.length) {
      actions = pending
        .map(
          (g, idx) => `
        <div class="game-actions" data-pending-idx="${guesses.indexOf(g)}">
          <p><strong>${escapeHtml(App.displayName(g.by))}</strong> asked: ${escapeHtml(g.text)}</p>
          <div class="response-btns">
            <button type="button" data-resp="yes">Yes</button>
            <button type="button" data-resp="no">No</button>
            <button type="button" data-resp="sometimes">Sometimes</button>
            <button type="button" data-resp="idk">IDK</button>
            <button type="button" class="got-it" data-resp="got_it">You've got it!</button>
          </div>
        </div>`
        )
        .join('');
    } else if (!finished && isStarter) {
      actions = `<div class="game-actions"><p>Waiting for guesses…</p></div>`;
    }

    const secretLine =
      isStarter || finished
        ? `<p><strong>Answer:</strong> ${escapeHtml(data.secret || '—')}</p>`
        : `<p><strong>Category:</strong> ${escapeHtml(data.category || '')}</p>`;

    root.innerHTML = `
      <div class="game-play">
        <div class="game-status">
          <p><strong>Starter:</strong> ${escapeHtml(App.displayName(game.starter_username))}</p>
          ${secretLine}
          ${isStarter && !finished ? `<p class="hint">You see the secret; the guesser does not.</p>` : ''}
        </div>
        <div class="game-history">
          ${
            guesses.length
              ? guesses
                  .map(
                    (g) => `
            <div class="turn-bubble">
              <p class="who">${escapeHtml(App.displayName(g.by))} · guess</p>
              <p>${escapeHtml(g.text)}</p>
              ${
                g.response
                  ? `<p><strong>Response:</strong> ${escapeHtml(this.respLabel(g.response))}</p>`
                  : `<p class="hint">Awaiting response…</p>`
              }
            </div>`
                  )
                  .join('')
              : `<p class="empty-state">No guesses yet.</p>`
          }
        </div>
        ${actions}
      </div>`;

    document.getElementById('guess-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = document.getElementById('guess-text').value.trim();
      await this.sendTurn(game.id, { action: 'guess', text, username: me });
    });

    root.querySelectorAll('[data-resp]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const wrap = btn.closest('[data-pending-idx]');
        const guessIndex = Number(wrap.dataset.pendingIdx);
        await this.sendTurn(game.id, {
          action: 'respond',
          guessIndex,
          response: btn.dataset.resp,
          username: me,
        });
      });
    });
  },

  respLabel(r) {
    const map = {
      yes: 'Yes',
      no: 'No',
      sometimes: 'Sometimes',
      idk: 'IDK',
      got_it: "You've got it!",
    };
    return map[r] || r;
  },

  renderWavelength(root, game) {
    const data = this.parseData(game);
    const me = App.username;
    const isA = me === (data.roles?.a || game.starter_username);
    const isB = me === data.roles?.b || (!isA && me !== game.starter_username);
    const finished = game.status === 'finished';
    const turns = data.turns || [];
    const phase = this.wavelengthPhase(data, game);

    let actions = '';
    if (!finished) {
      if (phase === 'need_b_join' && !isA) {
        actions = `
          <form class="game-actions" id="wl-join">
            <p>Join as Person B to start asking questions.</p>
            <button type="submit" class="btn-primary">I'm Person B</button>
          </form>`;
      } else if (phase === 'ask' && isB) {
        actions = `
          <form class="game-actions" id="wl-ask">
            <div class="field">
              <label for="wl-q">Your question (${turns.length + 1} of 3)</label>
              <input id="wl-q" required />
            </div>
            <button type="submit" class="btn-primary">Ask</button>
          </form>`;
      } else if (phase === 'answer' && isA) {
        const last = turns[turns.length - 1];
        actions = `
          <form class="game-actions" id="wl-answer">
            <p><strong>Question:</strong> ${escapeHtml(last.question)}</p>
            <div class="field">
              <label for="wl-a">Your answer</label>
              <input id="wl-a" required />
            </div>
            <button type="submit" class="btn-primary">Answer</button>
          </form>`;
      } else if (phase === 'mid_guess' && isB) {
        const last = turns[turns.length - 1];
        actions = `
          <form class="game-actions" id="wl-mid">
            <p><strong>Answer:</strong> ${escapeHtml(last.answer)}</p>
            <div class="field">
              <label for="wl-guess">Current guess (1–100)</label>
              <input id="wl-guess" type="number" min="1" max="100" required />
            </div>
            <div class="field">
              <label for="wl-next-q">Next question</label>
              <input id="wl-next-q" required />
            </div>
            <button type="submit" class="btn-primary">Submit guess + question</button>
          </form>`;
      } else if (phase === 'final_guess' && isB) {
        const last = turns[turns.length - 1];
        actions = `
          <form class="game-actions" id="wl-final">
            ${last.answer ? `<p><strong>Last answer:</strong> ${escapeHtml(last.answer)}</p>` : ''}
            <div class="field">
              <label for="wl-final-guess">Final guess (1–100)</label>
              <input id="wl-final-guess" type="number" min="1" max="100" required />
            </div>
            <button type="submit" class="btn-primary">Reveal!</button>
          </form>`;
      } else {
        actions = `<div class="game-actions"><p>Waiting for the other player…</p></div>`;
      }
    }

    const reveal =
      finished || isA
        ? `<p><strong>Secret number:</strong> ${escapeHtml(String(data.secret ?? '—'))}</p>`
        : `<p class="hint">Secret number is hidden until the end.</p>`;

    root.innerHTML = `
      <div class="game-play">
        <div class="game-status">
          <p><strong>Person A:</strong> ${escapeHtml(App.displayName(data.roles?.a || game.starter_username))}
          ${data.roles?.b ? ` · <strong>Person B:</strong> ${escapeHtml(App.displayName(data.roles.b))}` : ''}</p>
          ${reveal}
          ${
            finished
              ? `<p><strong>Final guess:</strong> ${escapeHtml(String(data.finalGuess))}
                 · <strong>Distance:</strong> ${escapeHtml(String(data.distance))}</p>`
              : ''
          }
        </div>
        <div class="game-history">
          ${
            turns.length
              ? turns
                  .map(
                    (t, i) => `
            <div class="turn-bubble">
              <p class="who">Round ${i + 1}</p>
              ${t.question ? `<p><strong>Q:</strong> ${escapeHtml(t.question)}</p>` : ''}
              ${t.answer ? `<p><strong>A:</strong> ${escapeHtml(t.answer)}</p>` : ''}
              ${t.guess != null ? `<p><strong>Guess:</strong> ${escapeHtml(String(t.guess))}</p>` : ''}
            </div>`
                  )
                  .join('')
              : `<p class="empty-state">No questions yet.</p>`
          }
        </div>
        ${actions}
      </div>`;

    document.getElementById('wl-join')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.sendTurn(game.id, { action: 'join', username: me });
    });
    document.getElementById('wl-ask')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.sendTurn(game.id, {
        action: 'ask',
        question: document.getElementById('wl-q').value.trim(),
        username: me,
      });
    });
    document.getElementById('wl-answer')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.sendTurn(game.id, {
        action: 'answer',
        answer: document.getElementById('wl-a').value.trim(),
        username: me,
      });
    });
    document.getElementById('wl-mid')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.sendTurn(game.id, {
        action: 'mid_guess',
        guess: Number(document.getElementById('wl-guess').value),
        question: document.getElementById('wl-next-q').value.trim(),
        username: me,
      });
    });
    document.getElementById('wl-final')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.sendTurn(game.id, {
        action: 'final_guess',
        guess: Number(document.getElementById('wl-final-guess').value),
        username: me,
      });
    });
  },

  wavelengthPhase(data, game) {
    if (!data.roles?.b) return 'need_b_join';
    const turns = data.turns || [];
    if (turns.length === 0) return 'ask';
    const last = turns[turns.length - 1];
    if (!last.answer) return 'answer';
    // After answer: if we have fewer than 3 answered rounds, B gives mid guess + next Q
    // Count completed Q/A pairs
    const answered = turns.filter((t) => t.answer).length;
    if (answered < 3) {
      // If last turn has answer but no guess yet and we need another question cycle
      if (last.answer && last.guess == null && answered < 3) {
        // For rounds 1-2 after answer: mid_guess adds guess + next question
        // Spec: B submits number + second free-text question, repeat until 3 Q/A
        return 'mid_guess';
      }
    }
    if (answered >= 3 && game.status !== 'finished') {
      return 'final_guess';
    }
    return 'wait';
  },

  async sendTurn(id, payload) {
    try {
      await App.api(`/games/${id}/turn`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await this.refreshGame(id, false);
    } catch (err) {
      alert(err.message || 'Turn failed');
    }
  },
};
