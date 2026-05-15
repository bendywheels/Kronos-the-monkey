// KRONOS ARENA — Node.js production server.
// Serves the built React app + REST API + MongoDB.
// Designed for Hostinger Node.js hosting (or any Node host).

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { randomUUID } = require("crypto");
const { MongoClient } = require("mongodb");

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "kronos_arena";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: (process.env.CORS_ORIGINS || "*").split(",") }));

// ---------- Mongo ----------
let db = null;
async function initDb() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db(DB_NAME);
  console.log(`[kronos] mongo connected → ${DB_NAME}`);
}

// ---------- API ----------
const api = express.Router();

api.get("/", (_req, res) => res.json({ message: "KRONOS ARENA online" }));

api.post("/status", async (req, res) => {
  const doc = {
    id: randomUUID(),
    client_name: String(req.body?.client_name || ""),
    timestamp: new Date().toISOString(),
  };
  await db.collection("status_checks").insertOne({ ...doc });
  res.json(doc);
});

api.get("/status", async (_req, res) => {
  const rows = await db.collection("status_checks")
    .find({}, { projection: { _id: 0 } })
    .limit(1000)
    .toArray();
  res.json(rows);
});

api.post("/rounds", async (req, res) => {
  const b = req.body || {};
  const doc = {
    id: randomUUID(),
    nickname: String(b.nickname || "KRONOS").slice(0, 16),
    survived: !!b.survived,
    won: !!b.won,
    role: String(b.role || "survivor"),
    survived_seconds: Number(b.survived_seconds) || 0,
    bots_count: Number(b.bots_count) || 0,
    survivors_left: Number(b.survivors_left) || 0,
    timestamp: new Date().toISOString(),
  };
  await db.collection("rounds").insertOne({ ...doc });
  res.json(doc);
});

api.get("/leaderboard", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
  const pipeline = [
    { $group: {
        _id: "$nickname",
        best_time: { $max: "$survived_seconds" },
        wins: { $sum: { $cond: [{ $eq: ["$won", true] }, 1, 0] } },
        games: { $sum: 1 },
    } },
    { $sort: { wins: -1, best_time: -1 } },
    { $limit: limit },
  ];
  const rows = await db.collection("rounds").aggregate(pipeline).toArray();
  res.json(rows.filter(r => r._id).map(r => ({
    nickname: r._id,
    best_time: r.best_time || 0,
    wins: r.wins || 0,
    games: r.games || 0,
  })));
});

app.use("/api", api);

// ---------- Static frontend ----------
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// SPA fallback — anything non-/api goes to index.html
app.get(/^\/(?!api).*/, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// ---------- Errors ----------
app.use((err, _req, res, _next) => {
  console.error("[kronos] error:", err);
  res.status(500).json({ error: "internal_error" });
});

// ---------- Start ----------
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`[kronos] arena online → http://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  console.error("[kronos] failed to connect to mongo:", err);
  process.exit(1);
});
