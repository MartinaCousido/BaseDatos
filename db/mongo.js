// src/db/mongo.js
const { MongoClient, ObjectId } = require("mongodb");

const client = new MongoClient(process.env.MONGODB_URI, {
  maxPoolSize: 10,
});

let db;

async function getMongoDb() {
  if (!db) {
    await client.connect();
    db = client.db(process.env.MONGODB_DB || "movieweb");

    // Índices para performance e idempotencia
    await db.collection("user_activity").createIndexes([
      { key: { userId: 1, timestamp: -1 } },
      { key: { type: 1, "details.movieId": 1, userId: 1 } },
      { key: { idempotencyKey: 1 }, unique: true, sparse: true },
    ]);
  }
  return db;
}

module.exports = { getMongoDb, ObjectId };
