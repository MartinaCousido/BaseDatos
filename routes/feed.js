// src/routes/feed.js
const express = require("express");
const router = express.Router();
const { getMongoDb, ObjectId } = require("../db/mongo");
const { renderActivity } = require("./renderactivity");
const { authenticate } = require("./auth"); // usá el tuyo si ya existe

// GET /api/me/feed?limit=20&before=<mongoId>
router.get("/api/me/feed", authenticate, async (req, res, next) => {
  try {
    const uid = req.user && req.user.uid; // user_id de SQL proveniente del JWT
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

    const db = await getMongoDb();
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const before = req.query.before;

    const filter = { userId: String(uid) };
    if (before) filter._id = { $lt: new ObjectId(before) };

    const items = await db
      .collection("user_activity")
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit)
      .toArray();

    const hydrated = items.map(ev => ({ ...ev, summary: renderActivity(ev) }));
    const nextCursor = items.length ? items[items.length - 1]._id.toString() : null;

    return res.json({ ok: true, items: hydrated, nextCursor });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
