const express = require('express');
const { getClient } = require('../db');

const router = express.Router();
const ALLOWED_USERS = new Set(['pandhi', 'kothi123']);

router.get('/story', async (_req, res) => {
  try {
    const db = getClient();
    const result = await db.execute(
      `SELECT location_id, completed, completed_by, completed_at
       FROM story_progress
       ORDER BY location_id ASC`
    );
    const locations = result.rows.map((r) => ({
      location_id: Number(r.location_id),
      completed: Number(r.completed) === 1,
      completed_by: r.completed_by || null,
      completed_at: r.completed_at || null,
    }));
    const completedCount = locations.filter((l) => l.completed).length;
    res.json({
      locations,
      completedCount,
      total: 21,
      titleUnlocked: completedCount >= 21,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch story progress' });
  }
});

router.post('/story/:locationId/complete', async (req, res) => {
  try {
    const locationId = Number(req.params.locationId);
    if (!Number.isInteger(locationId) || locationId < 1 || locationId > 21) {
      return res.status(400).json({ error: 'Invalid location' });
    }

    const username = String(req.body?.username || '')
      .toLowerCase()
      .trim();
    if (!ALLOWED_USERS.has(username)) {
      return res.status(400).json({ error: 'Invalid username' });
    }

    const db = getClient();

    // Sequential unlock: previous must be done (except #1)
    if (locationId > 1) {
      const prev = await db.execute({
        sql: `SELECT completed FROM story_progress WHERE location_id = ?`,
        args: [locationId - 1],
      });
      if (!prev.rows.length || Number(prev.rows[0].completed) !== 1) {
        return res.status(400).json({ error: 'Previous location not completed' });
      }
    }

    const existing = await db.execute({
      sql: `SELECT completed, completed_by, completed_at FROM story_progress WHERE location_id = ?`,
      args: [locationId],
    });
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Location not found' });
    }

    if (Number(existing.rows[0].completed) === 1) {
      // Idempotent no-op
      const all = await db.execute(
        `SELECT location_id, completed, completed_by, completed_at FROM story_progress ORDER BY location_id ASC`
      );
      const locations = all.rows.map((r) => ({
        location_id: Number(r.location_id),
        completed: Number(r.completed) === 1,
        completed_by: r.completed_by || null,
        completed_at: r.completed_at || null,
      }));
      return res.json({
        locations,
        completedCount: locations.filter((l) => l.completed).length,
        total: 21,
        titleUnlocked: locations.every((l) => l.completed),
        alreadyCompleted: true,
      });
    }

    await db.execute({
      sql: `UPDATE story_progress
            SET completed = 1, completed_by = ?, completed_at = datetime('now')
            WHERE location_id = ?`,
      args: [username, locationId],
    });

    const all = await db.execute(
      `SELECT location_id, completed, completed_by, completed_at FROM story_progress ORDER BY location_id ASC`
    );
    const locations = all.rows.map((r) => ({
      location_id: Number(r.location_id),
      completed: Number(r.completed) === 1,
      completed_by: r.completed_by || null,
      completed_at: r.completed_at || null,
    }));
    const completedCount = locations.filter((l) => l.completed).length;

    res.json({
      locations,
      completedCount,
      total: 21,
      titleUnlocked: completedCount >= 21,
      alreadyCompleted: false,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete location' });
  }
});

module.exports = router;
