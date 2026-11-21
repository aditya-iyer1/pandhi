const express = require('express');
const { getClient } = require('../db');

const router = express.Router();
const ALLOWED_USERS = new Set(['pandhi', 'kothi123']);

/**
 * Daily games we log stats for. One shared entry per game per date.
 * Field types: int | number | bool (min/max optional).
 */
const GAME_FIELDS = {
  krillion: [
    { key: 'score', type: 'number', min: 0 },
    { key: 'pct_beat', type: 'number', min: 0, max: 100 },
  ],
  minute_cryptic: [{ key: 'hints_used', type: 'bool' }],
  dowsle: [
    { key: 'our_guesses', type: 'int', min: 1 },
    { key: 'avg_guesses', type: 'number', min: 0 },
  ],
  skyq: [{ key: 'correct', type: 'int', min: 0, max: 3 }],
  noillirk: [{ key: 'score', type: 'number' }],
};

function badRequest(message) {
  const e = new Error(message);
  e.statusCode = 400;
  return e;
}

function validDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

function cleanData(game, input) {
  const out = {};
  for (const f of GAME_FIELDS[game]) {
    const raw = input?.[f.key];
    if (f.type === 'bool') {
      if (typeof raw !== 'boolean') throw badRequest(`${f.key} must be true or false`);
      out[f.key] = raw;
      continue;
    }
    if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') {
      throw badRequest(`${f.key} is required`);
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) throw badRequest(`${f.key} must be a number`);
    if (f.type === 'int' && !Number.isInteger(n)) throw badRequest(`${f.key} must be a whole number`);
    if (f.min !== undefined && n < f.min) throw badRequest(`${f.key} must be at least ${f.min}`);
    if (f.max !== undefined && n > f.max) throw badRequest(`${f.key} must be at most ${f.max}`);
    out[f.key] = n;
  }
  return out;
}

function toEntry(row) {
  return {
    game: row.game,
    play_date: row.play_date,
    data: JSON.parse(row.data_json),
    logged_by: row.logged_by,
    updated_at: row.updated_at,
  };
}

router.get('/game-logs', async (_req, res) => {
  try {
    const db = getClient();
    const result = await db.execute(
      `SELECT game, play_date, data_json, logged_by, updated_at
       FROM game_logs
       ORDER BY play_date DESC, game ASC`
    );
    res.json(result.rows.map(toEntry));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch game logs' });
  }
});

router.put('/game-logs/:game/:date', async (req, res) => {
  try {
    const { game, date } = req.params;
    if (!GAME_FIELDS[game]) throw badRequest('Unknown game');
    if (!validDate(date)) throw badRequest('Invalid date');

    const username = String(req.body?.username || '')
      .toLowerCase()
      .trim();
    if (!ALLOWED_USERS.has(username)) throw badRequest('Invalid username');

    const data = cleanData(game, req.body?.data);

    const db = getClient();
    const result = await db.execute({
      sql: `INSERT INTO game_logs (game, play_date, data_json, logged_by)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(game, play_date) DO UPDATE SET
              data_json = excluded.data_json,
              logged_by = excluded.logged_by,
              updated_at = datetime('now')
            RETURNING game, play_date, data_json, logged_by, updated_at`,
      args: [game, date, JSON.stringify(data), username],
    });
    res.json(toEntry(result.rows[0]));
  } catch (err) {
    if (!err.statusCode) console.error(err);
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to save game log' });
  }
});

router.delete('/game-logs/:game/:date', async (req, res) => {
  try {
    const { game, date } = req.params;
    if (!GAME_FIELDS[game]) throw badRequest('Unknown game');
    if (!validDate(date)) throw badRequest('Invalid date');

    const db = getClient();
    await db.execute({
      sql: 'DELETE FROM game_logs WHERE game = ? AND play_date = ?',
      args: [game, date],
    });
    res.json({ ok: true });
  } catch (err) {
    if (!err.statusCode) console.error(err);
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to delete game log' });
  }
});

module.exports = router;
