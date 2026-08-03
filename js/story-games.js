/**
 * Reusable mini-game engines for Our Story.
 * Each mount(container, content, { solved, onSolved }) API.
 */
const StoryGames = (() => {
  function normalize(s) {
    return String(s || '')
      .toUpperCase()
      .replace(/[^A-Z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function answersMatch(a, b) {
    return normalize(a) === normalize(b);
  }

  function el(html) {
    const d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  // —— Wordle ——
  function wordle(container, content, opts) {
    const answer = normalize(content.answer).replace(/ /g, '');
    const len = answer.length;
    const maxGuesses = 6;
    let row = 0;
    let col = 0;
    let current = Array(len).fill('');
    let done = !!opts.solved;

    container.innerHTML = '';
    const wrap = el(`<div class="sg-wordle"></div>`);
    const grid = el(`<div class="sg-wordle-grid" style="--len:${len}"></div>`);
    const rows = [];
    for (let r = 0; r < maxGuesses; r++) {
      const rowEl = el(`<div class="sg-wordle-row"></div>`);
      const cells = [];
      for (let c = 0; c < len; c++) {
        const cell = el(`<div class="sg-wordle-cell"></div>`);
        rowEl.appendChild(cell);
        cells.push(cell);
      }
      grid.appendChild(rowEl);
      rows.push(cells);
    }
    const msg = el(`<p class="sg-msg"></p>`);
    const kbHint = el(`<p class="hint">Type letters · Enter to guess · Backspace to delete (${len}-letter word, ${maxGuesses} tries)</p>`);
    wrap.append(grid, kbHint, msg);
    container.appendChild(wrap);

    if (opts.solved) {
      msg.textContent = `Solved: ${answer}`;
      rows[0].forEach((cell, i) => {
        cell.textContent = answer[i];
        cell.classList.add('correct');
      });
      return;
    }

    function paintCurrent() {
      rows[row].forEach((cell, i) => {
        cell.textContent = current[i] || '';
      });
    }

    function scoreGuess(guess) {
      const res = Array(len).fill('absent');
      const ans = answer.split('');
      const g = guess.split('');
      const used = Array(len).fill(false);
      for (let i = 0; i < len; i++) {
        if (g[i] === ans[i]) {
          res[i] = 'correct';
          used[i] = true;
        }
      }
      for (let i = 0; i < len; i++) {
        if (res[i] === 'correct') continue;
        const idx = ans.findIndex((ch, j) => !used[j] && ch === g[i]);
        if (idx >= 0) {
          res[i] = 'present';
          used[idx] = true;
        }
      }
      return res;
    }

    function submit() {
      if (done || current.some((c) => !c)) return;
      const guess = current.join('');
      const scores = scoreGuess(guess);
      scores.forEach((s, i) => rows[row][i].classList.add(s));
      if (guess === answer) {
        done = true;
        msg.textContent = 'Nice!';
        opts.onSolved();
        return;
      }
      row += 1;
      col = 0;
      current = Array(len).fill('');
      if (row >= maxGuesses) {
        done = true;
        msg.textContent = `Out of guesses — it was ${answer}. Try again!`;
        // Allow retry
        setTimeout(() => wordle(container, content, opts), 1200);
      }
    }

    function onKey(e) {
      if (done) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        if (col > 0 && !current[col]) col -= 1;
        current[col] = '';
        if (col > 0) col -= 1;
        // simpler: clear last filled
        let last = current.reduce((a, ch, i) => (ch ? i : a), -1);
        if (last >= 0) {
          current[last] = '';
          col = last;
        }
        paintCurrent();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        if (col < len) {
          current[col] = e.key.toUpperCase();
          col = Math.min(len - 1, col + 1);
          // advance past filled
          while (col < len - 1 && current[col]) col += 1;
          if (current[col]) col = Math.min(len, col + 1);
          // fix: find first empty
          const empty = current.findIndex((c) => !c);
          col = empty === -1 ? len - 1 : empty;
          paintCurrent();
        }
      }
    }

    // Cleaner keyboard handler
    function onKey2(e) {
      if (done) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (current.every(Boolean)) submit();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        for (let i = len - 1; i >= 0; i--) {
          if (current[i]) {
            current[i] = '';
            col = i;
            break;
          }
        }
        paintCurrent();
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        const empty = current.findIndex((c) => !c);
        if (empty >= 0) {
          current[empty] = e.key.toUpperCase();
          col = empty + 1;
          paintCurrent();
        }
      }
    }

    wrap._keydown = onKey2;
    document.addEventListener('keydown', onKey2);
    wrap._cleanup = () => document.removeEventListener('keydown', onKey2);
  }

  // —— Hangman ——
  function hangman(container, content, opts) {
    const phrase = normalize(content.phrase);
    const letters = phrase.replace(/ /g, '');
    const maxWrong = 8;
    let guessed = new Set();
    let wrong = 0;
    let done = !!opts.solved;

    function render() {
      container.innerHTML = '';
      const wrap = el(`<div class="sg-hangman"></div>`);
      const clue = el(`<p class="hint">Clue: ${escape(content.clue || '')}</p>`);
      const display = phrase
        .split('')
        .map((ch) => {
          if (ch === ' ') return '<span class="sg-hang-space"></span>';
          const show = done || guessed.has(ch);
          return `<span class="sg-hang-letter">${show ? ch : '_'}</span>`;
        })
        .join('');
      const board = el(`<div class="sg-hang-board">${display}</div>`);
      const status = el(
        `<p class="sg-msg">${done && opts.solved ? 'Solved!' : `Wrong guesses: ${wrong}/${maxWrong}`}</p>`
      );
      const alphabet = el(`<div class="sg-hang-keys"></div>`);
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((L) => {
        const btn = el(`<button type="button" class="sg-key">${L}</button>`);
        if (guessed.has(L) || done) btn.disabled = true;
        if (guessed.has(L) && !letters.includes(L)) btn.classList.add('miss');
        if (guessed.has(L) && letters.includes(L)) btn.classList.add('hit');
        btn.addEventListener('click', () => guess(L));
        alphabet.appendChild(btn);
      });
      wrap.append(clue, board, status, alphabet);
      container.appendChild(wrap);
    }

    function guess(L) {
      if (done || guessed.has(L)) return;
      guessed.add(L);
      if (!letters.includes(L)) {
        wrong += 1;
        if (wrong >= maxWrong) {
          done = true;
          render();
          container.querySelector('.sg-msg').textContent = `Out of tries — it was "${phrase}". Try again!`;
          setTimeout(() => hangman(container, content, opts), 1400);
          return;
        }
      } else {
        const won = [...letters].every((ch) => guessed.has(ch));
        if (won) {
          done = true;
          opts.onSolved();
        }
      }
      render();
    }

    if (opts.solved) {
      guessed = new Set(letters.split(''));
      done = true;
    }
    render();
  }

  function escape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // —— Word Search ——
  function wordsearch(container, content, opts) {
    const words = content.words.map((w) => normalize(w).replace(/ /g, ''));
    const size = Math.max(12, ...words.map((w) => w.length + 2));
    const grid = Array.from({ length: size }, () => Array(size).fill(null));
    const placed = [];

    function canPlace(word, r, c, dr, dc) {
      for (let i = 0; i < word.length; i++) {
        const rr = r + dr * i;
        const cc = c + dc * i;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) return false;
        if (grid[rr][cc] && grid[rr][cc] !== word[i]) return false;
      }
      return true;
    }

    function place(word) {
      const dirs = [
        [0, 1],
        [1, 0],
        [1, 1],
        [-1, 1],
      ];
      for (let attempt = 0; attempt < 80; attempt++) {
        const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
        const r = Math.floor(Math.random() * size);
        const c = Math.floor(Math.random() * size);
        if (!canPlace(word, r, c, dr, dc)) continue;
        for (let i = 0; i < word.length; i++) {
          grid[r + dr * i][c + dc * i] = word[i];
        }
        placed.push({ word, r, c, dr, dc });
        return true;
      }
      // fallback horizontal
      for (let r = 0; r < size; r++) {
        for (let c = 0; c <= size - word.length; c++) {
          if (canPlace(word, r, c, 0, 1)) {
            for (let i = 0; i < word.length; i++) grid[r][c + i] = word[i];
            placed.push({ word, r, c, dr: 0, dc: 1 });
            return true;
          }
        }
      }
      return false;
    }

    words.forEach((w) => place(w));
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!grid[r][c]) grid[r][c] = alphabet[Math.floor(Math.random() * 26)];
      }
    }

    const found = new Set(opts.solved ? words : []);
    let selecting = false;
    let path = [];

    container.innerHTML = '';
    const wrap = el(`<div class="sg-wordsearch"></div>`);
    const list = el(
      `<ul class="sg-ws-list">${words
        .map((w) => `<li data-word="${w}" class="${found.has(w) ? 'found' : ''}">${w}</li>`)
        .join('')}</ul>`
    );
    const board = el(`<div class="sg-ws-grid" style="--n:${size}"></div>`);
    const cells = [];
    for (let r = 0; r < size; r++) {
      cells[r] = [];
      for (let c = 0; c < size; c++) {
        const cell = el(`<button type="button" class="sg-ws-cell" data-r="${r}" data-c="${c}">${grid[r][c]}</button>`);
        cells[r][c] = cell;
        board.appendChild(cell);
      }
    }
    const msg = el(`<p class="sg-msg">${opts.solved ? 'All words found!' : 'Click and drag (or click start + end) to select words.'}</p>`);
    wrap.append(list, board, msg);
    container.appendChild(wrap);

    if (opts.solved) {
      words.forEach((w) => list.querySelector(`[data-word="${w}"]`)?.classList.add('found'));
      return;
    }

    function cellAt(t) {
      return t?.closest?.('.sg-ws-cell');
    }

    function clearSel() {
      board.querySelectorAll('.sg-ws-cell.sel').forEach((c) => c.classList.remove('sel'));
    }

    function lineBetween(a, b) {
      const r1 = +a.dataset.r;
      const c1 = +a.dataset.c;
      const r2 = +b.dataset.r;
      const c2 = +b.dataset.c;
      const dr = Math.sign(r2 - r1);
      const dc = Math.sign(c2 - c1);
      if (dr !== 0 && dc !== 0 && Math.abs(r2 - r1) !== Math.abs(c2 - c1)) return null;
      if (dr === 0 && dc === 0) return [[r1, c1]];
      const out = [];
      let r = r1;
      let c = c1;
      while (true) {
        out.push([r, c]);
        if (r === r2 && c === c2) break;
        r += dr;
        c += dc;
        if (out.length > size + 2) return null;
      }
      return out;
    }

    let startCell = null;

    board.addEventListener('click', (e) => {
      const cell = cellAt(e.target);
      if (!cell) return;
      if (!startCell) {
        startCell = cell;
        clearSel();
        cell.classList.add('sel');
        return;
      }
      const line = lineBetween(startCell, cell);
      startCell = null;
      clearSel();
      if (!line) return;
      const word = line.map(([r, c]) => grid[r][c]).join('');
      const rev = word.split('').reverse().join('');
      const match = words.find((w) => w === word || w === rev);
      if (match && !found.has(match)) {
        found.add(match);
        line.forEach(([r, c]) => cells[r][c].classList.add('found'));
        list.querySelector(`[data-word="${match}"]`)?.classList.add('found');
        if (found.size === words.length) {
          msg.textContent = 'All words found!';
          opts.onSolved();
        }
      }
    });
  }

  // —— Crossword ——
  function crossword(container, content, opts) {
    const { rows, cols, words } = content;
    const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
    words.forEach((w) => {
      const ans = normalize(w.answer).replace(/ /g, '');
      for (let i = 0; i < ans.length; i++) {
        const r = w.dir === 'across' ? w.row : w.row + i;
        const c = w.dir === 'across' ? w.col + i : w.col;
        grid[r][c] = ans[i];
      }
    });

    container.innerHTML = '';
    const wrap = el(`<div class="sg-crossword"></div>`);
    const board = el(`<div class="sg-cw-grid" style="--cols:${cols}"></div>`);
    const inputs = {};
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!grid[r][c]) {
          board.appendChild(el(`<div class="sg-cw-block"></div>`));
        } else {
          const inp = el(
            `<input class="sg-cw-cell" maxlength="1" data-r="${r}" data-c="${c}" ${opts.solved ? 'disabled' : ''} />`
          );
          if (opts.solved) inp.value = grid[r][c];
          inputs[`${r},${c}`] = inp;
          board.appendChild(inp);
        }
      }
    }
    const clues = el(
      `<ol class="sg-cw-clues">${words
        .map(
          (w, i) =>
            `<li><strong>${i + 1}. ${w.dir}</strong> — ${escape(w.clue)} (${normalize(w.answer).replace(/ /g, '').length})</li>`
        )
        .join('')}</ol>`
    );
    const btn = el(`<button type="button" class="btn-primary">Check</button>`);
    const msg = el(`<p class="sg-msg"></p>`);
    if (!opts.solved) wrap.append(board, clues, btn, msg);
    else {
      msg.textContent = 'Solved!';
      wrap.append(board, clues, msg);
    }
    container.appendChild(wrap);

    btn?.addEventListener('click', () => {
      let ok = true;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!grid[r][c]) continue;
          const v = (inputs[`${r},${c}`].value || '').toUpperCase();
          if (v !== grid[r][c]) ok = false;
        }
      }
      if (ok) {
        msg.textContent = 'Perfect!';
        opts.onSolved();
      } else {
        msg.textContent = 'Not quite — keep trying!';
      }
    });
  }

  // —— Emoji Pictionary ——
  function emoji(container, content, opts) {
    const rounds = content.rounds || [];
    let idx = 0;
    if (opts.solved) {
      container.innerHTML = `<div class="sg-emoji"><p class="sg-msg">Solved!</p><ul>${rounds
        .map((r) => `<li>${r.emojis} → <strong>${escape(r.answer)}</strong></li>`)
        .join('')}</ul></div>`;
      return;
    }

    function showRound() {
      const round = rounds[idx];
      container.innerHTML = '';
      const wrap = el(`<div class="sg-emoji"></div>`);
      wrap.appendChild(el(`<p class="hint">Round ${idx + 1} of ${rounds.length}</p>`));
      wrap.appendChild(el(`<p class="sg-emoji-big">${round.emojis}</p>`));
      const form = el(
        `<form class="sg-form"><input type="text" required placeholder="What is it?" autocomplete="off" /><button class="btn-primary" type="submit">Guess</button></form>`
      );
      const msg = el(`<p class="sg-msg"></p>`);
      wrap.append(form, msg);
      container.appendChild(wrap);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = form.querySelector('input').value;
        if (answersMatch(val, round.answer)) {
          idx += 1;
          if (idx >= rounds.length) {
            msg.textContent = 'Nailed it!';
            opts.onSolved();
          } else {
            showRound();
          }
        } else {
          msg.textContent = 'Try again!';
        }
      });
    }
    showRound();
  }

  // —— 24 game ——
  function twentyfour(container, content, opts) {
    const nums = content.numbers;
    const target = content.target || 24;
    container.innerHTML = '';
    const wrap = el(`<div class="sg-24"></div>`);
    wrap.appendChild(
      el(
        `<p>Use each number exactly once — <strong>${nums.join(', ')}</strong> — with +, −, ×, ÷ and parentheses to make <strong>${target}</strong>.</p>`
      )
    );
    if (opts.solved) {
      wrap.appendChild(el(`<p class="sg-msg">Solved!</p>`));
      container.appendChild(wrap);
      return;
    }
    const form = el(
      `<form class="sg-form"><input type="text" placeholder="e.g. (13-4)/(3/8)" required /><button class="btn-primary" type="submit">Check</button></form>`
    );
    const msg = el(`<p class="sg-msg"></p>`);
    wrap.append(form, msg);
    container.appendChild(wrap);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const expr = form.querySelector('input').value.trim();
      const result = evalTwentyFour(expr, nums);
      if (result.ok && Math.abs(result.value - target) < 1e-6) {
        msg.textContent = '24! Perfect.';
        opts.onSolved();
      } else {
        msg.textContent = result.error || `That equals ${result.value}, not ${target}.`;
      }
    });
  }

  function evalTwentyFour(expr, nums) {
    // Only allow digits, ops, parens, whitespace
    if (!/^[\d+\-*/().\s]+$/.test(expr)) return { ok: false, error: 'Invalid characters.' };
    const used = expr.match(/\d+/g)?.map(Number) || [];
    const sortedUsed = [...used].sort((a, b) => a - b);
    const sortedNeed = [...nums].sort((a, b) => a - b);
    if (sortedUsed.length !== sortedNeed.length || sortedUsed.some((n, i) => n !== sortedNeed[i])) {
      return { ok: false, error: 'Use each given number exactly once.' };
    }
    try {
      // eslint-disable-next-line no-new-func
      const value = Function(`"use strict"; return (${expr});`)();
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { ok: false, error: 'Could not evaluate.' };
      }
      return { ok: true, value };
    } catch {
      return { ok: false, error: 'Could not evaluate expression.' };
    }
  }

  // —— Connections ——
  function connections(container, content, opts) {
    const groups = content.groups;
    const allWords = groups.flatMap((g) => g.words);
    const shuffled = opts.solved ? allWords : [...allWords].sort(() => Math.random() - 0.5);
    const solvedGroups = opts.solved ? groups.map((g) => g.name) : [];
    let selected = [];
    let mistakes = 0;

    function render() {
      container.innerHTML = '';
      const wrap = el(`<div class="sg-conn"></div>`);
      solvedGroups.forEach((name) => {
        const g = groups.find((x) => x.name === name);
        wrap.appendChild(
          el(
            `<div class="sg-conn-solved"><strong>${escape(name)}</strong><div>${g.words.map(escape).join(' · ')}</div></div>`
          )
        );
      });
      if (opts.solved || solvedGroups.length === 4) {
        wrap.appendChild(el(`<p class="sg-msg">All groups found!</p>`));
        container.appendChild(wrap);
        if (!opts.solved && solvedGroups.length === 4) opts.onSolved();
        return;
      }
      const remaining = shuffled.filter((w) => !solvedGroups.some((n) => groups.find((g) => g.name === n).words.includes(w)));
      const grid = el(`<div class="sg-conn-grid"></div>`);
      remaining.forEach((w) => {
        const btn = el(`<button type="button" class="sg-conn-tile${selected.includes(w) ? ' selected' : ''}">${escape(w)}</button>`);
        btn.addEventListener('click', () => {
          if (selected.includes(w)) selected = selected.filter((x) => x !== w);
          else if (selected.length < 4) selected.push(w);
          render();
        });
        grid.appendChild(btn);
      });
      const actions = el(`<div class="sg-conn-actions"></div>`);
      const submit = el(`<button type="button" class="btn-primary">Submit</button>`);
      const deselect = el(`<button type="button" class="btn-secondary">Deselect</button>`);
      const msg = el(`<p class="sg-msg">Mistakes: ${mistakes}</p>`);
      deselect.addEventListener('click', () => {
        selected = [];
        render();
      });
      submit.addEventListener('click', () => {
        if (selected.length !== 4) return;
        const match = groups.find(
          (g) =>
            !solvedGroups.includes(g.name) &&
            g.words.every((w) => selected.includes(w)) &&
            selected.every((w) => g.words.includes(w))
        );
        if (match) {
          solvedGroups.push(match.name);
          selected = [];
          if (solvedGroups.length === 4) {
            render();
            opts.onSolved();
            return;
          }
        } else {
          mistakes += 1;
          selected = [];
        }
        render();
      });
      actions.append(submit, deselect);
      wrap.append(grid, actions, msg);
      container.appendChild(wrap);
    }
    render();
  }

  // —— Two truths ——
  function twotruths(container, content, opts) {
    container.innerHTML = '';
    const wrap = el(`<div class="sg-truths"></div>`);
    wrap.appendChild(el(`<p>Pick the <strong>lie</strong>:</p>`));
    if (opts.solved) {
      const lie = content.statements.find((s) => s.lie);
      wrap.appendChild(el(`<p class="sg-msg">The lie was: “${escape(lie.text)}”</p>`));
      container.appendChild(wrap);
      return;
    }
    const msg = el(`<p class="sg-msg"></p>`);
    content.statements.forEach((s, i) => {
      const btn = el(`<button type="button" class="sg-truth-btn">${escape(s.text)}</button>`);
      btn.addEventListener('click', () => {
        if (s.lie) {
          msg.textContent = 'Yep — that was the lie!';
          opts.onSolved();
        } else {
          msg.textContent = 'That’s actually true — try again!';
        }
      });
      wrap.appendChild(btn);
    });
    wrap.appendChild(msg);
    container.appendChild(wrap);
  }

  // —— Chess mate-in-1 ——
  function chess(container, content, opts) {
    // Simple board from FEN (placement only); click piece then square
    const fen = content.fen;
    const solution = content.solution.toLowerCase(); // e1e8
    container.innerHTML = '';
    const wrap = el(`<div class="sg-chess"></div>`);
    wrap.appendChild(el(`<p class="hint">${escape(content.hint || 'Find mate!')}</p>`));

    const parts = fen.split(' ');
    const rows = parts[0].split('/');
    const turn = parts[1] || 'w';
    let board = Array.from({ length: 8 }, () => Array(8).fill(null));
    rows.forEach((row, ri) => {
      let ci = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) ci += Number(ch);
        else {
          board[ri][ci] = ch;
          ci += 1;
        }
      }
    });

    const glyphs = {
      K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
      k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
    };

    let from = null;
    const msg = el(`<p class="sg-msg"></p>`);
    const boardEl = el(`<div class="sg-chess-board"></div>`);

    function sqName(r, c) {
      return 'abcdefgh'[c] + (8 - r);
    }

    function render() {
      boardEl.innerHTML = '';
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const dark = (r + c) % 2 === 1;
          const sq = el(
            `<button type="button" class="sg-chess-sq ${dark ? 'dark' : 'light'}${from && from[0] === r && from[1] === c ? ' selected' : ''}" data-r="${r}" data-c="${c}"></button>`
          );
          const p = board[r][c];
          if (p) sq.textContent = glyphs[p] || p;
          sq.addEventListener('click', () => onSq(r, c));
          boardEl.appendChild(sq);
        }
      }
    }

    function onSq(r, c) {
      if (opts.solved) return;
      const p = board[r][c];
      if (!from) {
        if (!p) return;
        const isWhite = p === p.toUpperCase();
        if ((turn === 'w' && !isWhite) || (turn === 'b' && isWhite)) return;
        from = [r, c];
        render();
        return;
      }
      const [fr, fc] = from;
      const move = sqName(fr, fc) + sqName(r, c);
      from = null;
      if (move === solution) {
        // apply move visually
        board[r][c] = board[fr][fc];
        board[fr][fc] = null;
        render();
        msg.textContent = 'Checkmate!';
        opts.onSolved();
      } else {
        msg.textContent = 'Not the mating move — try again.';
        render();
      }
    }

    if (opts.solved) {
      // show solution applied
      const fr = 8 - Number(solution[1]);
      const fc = solution.charCodeAt(0) - 97;
      const tr = 8 - Number(solution[3]);
      const tc = solution.charCodeAt(2) - 97;
      board[tr][tc] = board[fr][fc];
      board[fr][fc] = null;
      msg.textContent = 'Solved — mate!';
    }

    wrap.append(boardEl, msg);
    container.appendChild(wrap);
    render();
  }

  // —— Trivia ——
  function trivia(container, content, opts) {
    const qs = content.questions;
    let idx = 0;
    if (opts.solved) {
      container.innerHTML = `<div class="sg-trivia"><p class="sg-msg">Quiz complete!</p><ul>${qs
        .map((q) => `<li>${escape(q.q)} → <strong>${escape(q.a)}</strong></li>`)
        .join('')}</ul></div>`;
      return;
    }
    function show() {
      const q = qs[idx];
      container.innerHTML = '';
      const wrap = el(`<div class="sg-trivia"></div>`);
      wrap.appendChild(el(`<p class="hint">Question ${idx + 1} of ${qs.length}</p>`));
      wrap.appendChild(el(`<p><strong>${escape(q.q)}</strong></p>`));
      const form = el(
        `<form class="sg-form"><input type="text" required autocomplete="off" /><button class="btn-primary" type="submit">Answer</button></form>`
      );
      const msg = el(`<p class="sg-msg"></p>`);
      wrap.append(form, msg);
      container.appendChild(wrap);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (answersMatch(form.querySelector('input').value, q.a)) {
          idx += 1;
          if (idx >= qs.length) {
            msg.textContent = 'All correct!';
            opts.onSolved();
          } else show();
        } else {
          msg.textContent = 'Nope — try again (no penalty)!';
        }
      });
    }
    show();
  }

  // —— Cipher ——
  function cipher(container, content, opts) {
    container.innerHTML = '';
    const wrap = el(`<div class="sg-cipher"></div>`);
    wrap.appendChild(el(`<p class="hint">${escape(content.prompt || '')}</p>`));
    wrap.appendChild(el(`<p class="sg-cipher-text">${escape(content.ciphertext)}</p>`));
    if (opts.solved) {
      wrap.appendChild(el(`<p class="sg-msg solved-reveal">${escape(content.answer)}</p>`));
      container.appendChild(wrap);
      return;
    }
    const form = el(
      `<form class="sg-form"><input type="text" required placeholder="Decoded message" autocomplete="off" /><button class="btn-primary" type="submit">Decode</button></form>`
    );
    const msg = el(`<p class="sg-msg"></p>`);
    wrap.append(form, msg);
    container.appendChild(wrap);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (answersMatch(form.querySelector('input').value, content.answer)) {
        msg.textContent = content.answer;
        msg.classList.add('solved-reveal');
        opts.onSolved();
      } else {
        msg.textContent = 'Not quite — keep decoding!';
      }
    });
  }

  const engines = {
    wordle,
    hangman,
    wordsearch,
    crossword,
    emoji,
    twentyfour,
    connections,
    twotruths,
    chess,
    trivia,
    cipher,
  };

  function mount(container, game, content, opts) {
    // cleanup prior wordle key listener if any
    const prev = container.querySelector('.sg-wordle');
    if (prev && prev._cleanup) prev._cleanup();
    const fn = engines[game];
    if (!fn) {
      container.innerHTML = `<p class="error-msg">Unknown game: ${game}</p>`;
      return;
    }
    fn(container, content, opts);
  }

  return { mount, normalize, answersMatch };
})();
