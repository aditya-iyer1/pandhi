const express = require('express');

const router = express.Router();

const ALLOWED_USERS = new Set(['pandhi', 'kothi123']);

router.post('/login', (req, res) => {
  const username = String(req.body?.username || '')
    .toLowerCase()
    .trim();
  const password = String(req.body?.password || '')
    .toLowerCase()
    .trim();
  const sitePassword = String(process.env.SITE_PASSWORD || 'puffage')
    .toLowerCase()
    .trim();

  if (username === 'kothi') {
    return res.status(401).json({ ok: false, error: "Are you sure that's you?" });
  }

  if (!ALLOWED_USERS.has(username) || password !== sitePassword) {
    return res.status(401).json({ ok: false, error: 'Try again!' });
  }

  return res.json({ ok: true, username });
});

module.exports = router;
