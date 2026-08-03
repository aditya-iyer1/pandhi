const { createClient } = require('@libsql/client');
const path = require('path');

let client;

function getClient() {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url) {
    client = createClient({ url, authToken });
  } else {
    const filePath = path.join(__dirname, 'local.db');
    client = createClient({ url: `file:${filePath}` });
    console.log('Using local SQLite file:', filePath);
  }

  return client;
}

async function initDb() {
  const db = getClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      text TEXT NOT NULL,
      drawing_data_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      starter_username TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS story_progress (
      location_id INTEGER PRIMARY KEY,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_by TEXT,
      completed_at TEXT
    )
  `);

  // Seed all 21 locations if missing
  for (let id = 1; id <= 21; id++) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO story_progress (location_id, completed) VALUES (?, 0)`,
      args: [id],
    });
  }

  return db;
}

module.exports = { getClient, initDb };
