// src/services/activity.js
const { getMongoDb } = require("../db/mongo");

// Inserta un documento de actividad en Mongo (idempotente si pasás idempotencyKey)
async function logActivity({ userId, type, details, idempotencyKey, timestamp }) {
  const db = await getMongoDb();
  const doc = {
    userId: String(userId), // usamos el user_id de SQL como string
    type,                   // "RATED_MOVIE" | "ADDED_TO_FAVORITES" | "WROTE_REVIEW"
    details,                // { movieId, movieTitle, ... }
    timestamp: timestamp ? new Date(timestamp) : new Date(),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };

  if (idempotencyKey) {
    await db.collection("user_activity").updateOne(
      { idempotencyKey },
      { $setOnInsert: doc },
      { upsert: true }
    );
  } else {
    await db.collection("user_activity").insertOne(doc);
  }
}

// Wrappers por tipo de evento
async function onRatedMovie({ userId, movieId, movieTitle, rating }) {
  return logActivity({
    userId,
    type: "RATED_MOVIE",
    details: { movieId, movieTitle, rating },
    idempotencyKey: `rated:${movieId}:${userId}:${rating}`,
  });
}

async function onAddedToFavorites({ userId, movieId, movieTitle }) {
  return logActivity({
    userId,
    type: "ADDED_TO_FAVORITES",
    details: { movieId, movieTitle },
    idempotencyKey: `fav:${movieId}:${userId}`,
  });
}

async function onWroteReview({ userId, movieId, movieTitle, reviewId }) {
  return logActivity({
    userId,
    type: "WROTE_REVIEW",
    details: { movieId, movieTitle, reviewId },
    idempotencyKey: `review:${reviewId}:${userId}`,
  });
}

module.exports = {
  logActivity,
  onRatedMovie,
  onAddedToFavorites,
  onWroteReview,
};
