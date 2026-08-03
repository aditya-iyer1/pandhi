require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const gameRoutes = require('./routes/games');
const storyRoutes = require('./routes/story');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser tools (no Origin) and local file/dev hosts
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin) ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1')
      ) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
  })
);

app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use(authRoutes);
app.use(messageRoutes);
app.use(gameRoutes);
app.use(storyRoutes);

app.use((err, _req, res, _next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS blocked' });
  }
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Puffage API listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
