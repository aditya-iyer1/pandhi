const express = require('express');
const { getClient } = require('../db');

const router = express.Router();
const ALLOWED_USERS = new Set(['pandhi', 'kothi123']);
const VALID_TYPES = new Set(['twenty_questions', 'wavelength']);
const RESPONSES = new Set(['yes', 'no', 'sometimes', 'idk', 'got_it']);
const CATEGORIES = new Set(['people we know', 'celebrities', 'characters']);

function parseData(row) {
  if (!row) return null;
  const data =
    typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json;
  return { ...row, data_json: data };
}

router.get('/games', async (_req, res) => {
  try {
    const db = getClient();
    const result = await db.execute(
      `SELECT id, type, status, starter_username, created_at, updated_at
       FROM games
       ORDER BY datetime(updated_at) DESC, id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list games' });
  }
});

router.get('/games/:id', async (req, res) => {
  try {
    const db = getClient();
    const result = await db.execute({
      sql: 'SELECT * FROM games WHERE id = ?',
      args: [Number(req.params.id)],
    });
    if (!result.rows.length) return res.status(404).json({ error: 'Game not found' });
    res.json(parseData(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

router.post('/games', async (req, res) => {
  try {
    const type = String(req.body?.type || '').trim();
    const starter = String(req.body?.starter_username || '')
      .toLowerCase()
      .trim();

    if (!VALID_TYPES.has(type)) {
      return res.status(400).json({ error: 'Invalid game type' });
    }
    if (!ALLOWED_USERS.has(starter)) {
      return res.status(400).json({ error: 'Invalid username' });
    }

    const db = getClient();
    const active = await db.execute({
      sql: `SELECT id FROM games WHERE type = ? AND status = 'active' LIMIT 1`,
      args: [type],
    });
    if (active.rows.length) {
      return res.status(409).json({ error: 'A game of this type is already in progress' });
    }

    let data;
    if (type === 'twenty_questions') {
      const secret = String(req.body?.secret || '').trim();
      const category = String(req.body?.category || '').trim();
      if (!secret) return res.status(400).json({ error: 'Secret answer required' });
      if (!CATEGORIES.has(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }
      data = { category, secret, guesses: [] };
    } else {
      const secret = Number(req.body?.secret);
      if (!Number.isInteger(secret) || secret < 1 || secret > 100) {
        return res.status(400).json({ error: 'Secret must be an integer 1–100' });
      }
      data = {
        secret,
        roles: { a: starter, b: null },
        turns: [],
        finalGuess: null,
        distance: null,
      };
    }

    const result = await db.execute({
      sql: `INSERT INTO games (type, status, starter_username, data_json)
            VALUES (?, 'active', ?, ?)
            RETURNING *`,
      args: [type, starter, JSON.stringify(data)],
    });

    res.status(201).json(parseData(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

router.post('/games/:id/turn', async (req, res) => {
  try {
    const db = getClient();
    const id = Number(req.params.id);
    const result = await db.execute({
      sql: 'SELECT * FROM games WHERE id = ?',
      args: [id],
    });
    if (!result.rows.length) return res.status(404).json({ error: 'Game not found' });

    const game = result.rows[0];
    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Game is finished' });
    }

    const username = String(req.body?.username || '')
      .toLowerCase()
      .trim();
    if (!ALLOWED_USERS.has(username)) {
      return res.status(400).json({ error: 'Invalid username' });
    }

    const data =
      typeof game.data_json === 'string'
        ? JSON.parse(game.data_json)
        : game.data_json;
    const action = String(req.body?.action || '').trim();

    let status = 'active';

    if (game.type === 'twenty_questions') {
      applyTwentyQuestions(data, action, req.body, username, game);
      if (action === 'respond' && req.body.response === 'got_it') {
        status = 'finished';
      }
    } else if (game.type === 'wavelength') {
      const finished = applyWavelength(data, action, req.body, username, game);
      if (finished) status = 'finished';
    } else {
      return res.status(400).json({ error: 'Unknown game type' });
    }

    const updated = await db.execute({
      sql: `UPDATE games
            SET data_json = ?, status = ?, updated_at = datetime('now')
            WHERE id = ?
            RETURNING *`,
      args: [JSON.stringify(data), status, id],
    });

    res.json(parseData(updated.rows[0]));
  } catch (err) {
    console.error(err);
    const message = err.message || 'Failed to apply turn';
    const code = err.statusCode || 400;
    res.status(code).json({ error: message });
  }
});

function applyTwentyQuestions(data, action, body, username, game) {
  if (action === 'guess') {
    if (username === game.starter_username) {
      const e = new Error('Starter cannot guess');
      e.statusCode = 400;
      throw e;
    }
    const text = String(body.text || '').trim();
    if (!text) {
      const e = new Error('Guess text required');
      e.statusCode = 400;
      throw e;
    }
    data.guesses = data.guesses || [];
    data.guesses.push({
      text,
      response: null,
      by: username,
      at: new Date().toISOString(),
    });
    return;
  }

  if (action === 'respond') {
    if (username !== game.starter_username) {
      const e = new Error('Only the starter can respond');
      e.statusCode = 400;
      throw e;
    }
    const response = String(body.response || '').trim();
    if (!RESPONSES.has(response)) {
      const e = new Error('Invalid response');
      e.statusCode = 400;
      throw e;
    }
    const guessIndex = Number(body.guessIndex);
    if (!data.guesses || !data.guesses[guessIndex]) {
      const e = new Error('Guess not found');
      e.statusCode = 400;
      throw e;
    }
    if (data.guesses[guessIndex].response) {
      const e = new Error('Guess already answered');
      e.statusCode = 400;
      throw e;
    }
    data.guesses[guessIndex].response = response;
    data.guesses[guessIndex].respondedAt = new Date().toISOString();
    return;
  }

  const e = new Error('Invalid action');
  e.statusCode = 400;
  throw e;
}

function applyWavelength(data, action, body, username, game) {
  data.roles = data.roles || { a: game.starter_username, b: null };
  data.turns = data.turns || [];

  if (action === 'join') {
    if (username === data.roles.a) {
      const e = new Error('Person A cannot join as B');
      e.statusCode = 400;
      throw e;
    }
    if (data.roles.b && data.roles.b !== username) {
      const e = new Error('Person B already joined');
      e.statusCode = 400;
      throw e;
    }
    data.roles.b = username;
    return false;
  }

  // Auto-assign B if they act without joining
  if (!data.roles.b && username !== data.roles.a) {
    data.roles.b = username;
  }

  const isA = username === data.roles.a;
  const isB = username === data.roles.b;

  if (action === 'ask') {
    if (!isB) {
      const e = new Error('Only Person B can ask');
      e.statusCode = 400;
      throw e;
    }
    if (data.turns.length !== 0) {
      const e = new Error('First question already asked — use mid_guess for follow-ups');
      e.statusCode = 400;
      throw e;
    }
    const question = String(body.question || '').trim();
    if (!question) {
      const e = new Error('Question required');
      e.statusCode = 400;
      throw e;
    }
    data.turns.push({ question, answer: null, guess: null });
    return false;
  }

  if (action === 'answer') {
    if (!isA) {
      const e = new Error('Only Person A can answer');
      e.statusCode = 400;
      throw e;
    }
    const last = data.turns[data.turns.length - 1];
    if (!last || !last.question || last.answer) {
      const e = new Error('No pending question to answer');
      e.statusCode = 400;
      throw e;
    }
    const answer = String(body.answer || '').trim();
    if (!answer) {
      const e = new Error('Answer required');
      e.statusCode = 400;
      throw e;
    }
    last.answer = answer;
    return false;
  }

  if (action === 'mid_guess') {
    if (!isB) {
      const e = new Error('Only Person B can guess');
      e.statusCode = 400;
      throw e;
    }
    const last = data.turns[data.turns.length - 1];
    const answered = data.turns.filter((t) => t.answer).length;
    if (!last?.answer || last.guess != null || answered >= 3) {
      const e = new Error('Not time for a mid-round guess');
      e.statusCode = 400;
      throw e;
    }
    const guess = Number(body.guess);
    const question = String(body.question || '').trim();
    if (!Number.isInteger(guess) || guess < 1 || guess > 100) {
      const e = new Error('Guess must be an integer 1–100');
      e.statusCode = 400;
      throw e;
    }
    if (!question) {
      const e = new Error('Next question required');
      e.statusCode = 400;
      throw e;
    }
    last.guess = guess;
    data.turns.push({ question, answer: null, guess: null });
    return false;
  }

  if (action === 'final_guess') {
    if (!isB) {
      const e = new Error('Only Person B can make the final guess');
      e.statusCode = 400;
      throw e;
    }
    const answered = data.turns.filter((t) => t.answer).length;
    if (answered < 3) {
      const e = new Error('Need 3 answered questions before final guess');
      e.statusCode = 400;
      throw e;
    }
    const guess = Number(body.guess);
    if (!Number.isInteger(guess) || guess < 1 || guess > 100) {
      const e = new Error('Guess must be an integer 1–100');
      e.statusCode = 400;
      throw e;
    }
    data.finalGuess = guess;
    data.distance = Math.abs(guess - Number(data.secret));
    return true;
  }

  const e = new Error('Invalid action');
  e.statusCode = 400;
  throw e;
}

module.exports = router;
