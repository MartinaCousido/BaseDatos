const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.get('/profile', authenticate, async (req, res) => {
  try {
    const uid = req.user && req.user.uid;
    if (!uid) return res.status(401).json({ ok: false });
    // table users.user uses user_id as primary key
    const r = await db.query('SELECT user_id AS id, username, email, "name" FROM "user" WHERE user_id = $1', [uid]);
    if (r.rows.length === 0) return res.status(404).json({ ok: false });
    return res.json({ ok: true, user: r.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false });
  }
});

module.exports = router;
