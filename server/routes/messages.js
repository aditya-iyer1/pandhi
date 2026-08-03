const express = require('express');
const { getClient } = require('../db');

const router = express.Router();
const ALLOWED_USERS = new Set(['pandhi', 'kothi123']);

router.get('/messages', async (_req, res) => {
  try {
    const db = getClient();
    const result = await db.execute(
      'SELECT id, username, text, drawing_data_url, created_at FROM messages ORDER BY datetime(created_at) DESC, id DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/messages', async (req, res) => {
  try {
    const username = String(req.body?.username || '')
      .toLowerCase()
      .trim();
    const text = String(req.body?.text || '').trim();
    const drawing_data_url = req.body?.drawing_data_url
      ? String(req.body.drawing_data_url)
      : null;

    if (!ALLOWED_USERS.has(username)) {
      return res.status(400).json({ error: 'Invalid username' });
    }
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    if (drawing_data_url && drawing_data_url.length > 2_000_000) {
      return res.status(400).json({ error: 'Drawing too large' });
    }

    const db = getClient();
    const result = await db.execute({
      sql: 'INSERT INTO messages (username, text, drawing_data_url) VALUES (?, ?, ?) RETURNING id, username, text, drawing_data_url, created_at',
      args: [username, text, drawing_data_url],
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

module.exports = router;
