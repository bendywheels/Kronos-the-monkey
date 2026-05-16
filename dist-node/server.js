// KRONOS ARENA — Node.js production server with Socket.IO multiplayer.

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { randomUUID } = require("crypto");
const { MongoClient } = require("mongodb");
const { Server: IOServer } = require("socket.io");
const sim = require("./game-sim");

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "kronos_arena";
const SOCKET_PATH = "/api/socket.io";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: (process.env.CORS_ORIGINS || "*").split(",") }));
app.use((req, _res, next) => {
  if (!req.url.startsWith("/api/socket.io")) console.log(`[kronos] ${req.method} ${req.url}`);
  next();
});

// ---------- Mongo ----------
let db = null;
async function initDb() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db(DB_NAME);
  console.log(`[kronos] mongo connected → ${DB_NAME}`);
}

// ---------- REST API ----------
const api = express.Router();

api.get("/", (_req, res) => res.json({ message: "KRONOS ARENA online" }));

api.get("/health", (_req, res) => {
  const fs = require("fs");
  res.json({
    ok: true,
    node: process.version,
    cwd: process.cwd(),
    dirname: __dirname,
    public_exists: fs.existsSync(path.join(__dirname, "public")),
    index_exists: fs.existsSync(path.join(__dirname, "public", "index.html")),
    mongo_connected: db !== null,
    db_name: DB_NAME,
    port: PORT,
    rooms_active: Object.keys(ROOMS).length,
    socket_path: SOCKET_PATH,
  });
});

api.post("/status", async (req, res) => {
  if (!db) return res.status(503).json({ error: "db_not_ready" });
  const doc = { id: randomUUID(), client_name: String(req.body?.client_name || ""), timestamp: new Date().toISOString() };
  await db.collection("status_checks").insertOne({ ...doc });
  res.json(doc);
});

api.get("/status", async (_req, res) => {
  if (!db) return res.status(503).json({ error: "db_not_ready" });
  const rows = await db.collection("status_checks").find({}, { projection: { _id: 0 } }).limit(1000).toArray();
  res.json(rows);
});

api.post("/rounds", async (req, res) => {
  if (!db) return res.status(503).json({ error: "db_not_ready" });
  const b = req.body || {};
  const doc = {
    id: randomUUID(),
    nickname: String(b.nickname || "KRONOS").slice(0, 16),
    survived: !!b.survived, won: !!b.won,
    role: String(b.role || "survivor"),
    survived_seconds: Number(b.survived_seconds) || 0,
    bots_count: Number(b.bots_count) || 0,
    survivors_left: Number(b.survivors_left) || 0,
    mode: String(b.mode || "single"),
    timestamp: new Date().toISOString(),
  };
  await db.collection("rounds").insertOne({ ...doc });
  res.json(doc);
});

api.get("/leaderboard", async (req, res) => {
  if (!db) return res.json([]);
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
  const rows = await db.collection("rounds").aggregate([
    { $group: { _id: "$nickname", best_time: { $max: "$survived_seconds" }, wins: { $sum: { $cond: [{ $eq: ["$won", true] }, 1, 0] } }, games: { $sum: 1 } } },
    { $sort: { wins: -1, best_time: -1 } },
    { $limit: limit },
  ]).toArray();
  res.json(rows.filter(r => r._id).map(r => ({ nickname: r._id, best_time: r.best_time || 0, wins: r.wins || 0, games: r.games || 0 })));
});

api.get("/rooms", (_req, res) => {
  res.json(Object.values(ROOMS).map(r => ({
    id: r.id,
    players: Object.values(r.players).filter(p => !p.isBot).length,
    phase: r.state.phase,
    config: r.config,
  })));
});

app.use("/api", api);

// ---------- Static frontend ----------
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));
app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

app.use((err, _req, res, _next) => {
  console.error("[kronos] error:", err);
  res.status(500).json({ error: "internal_error" });
});

// ================================================================
// SOCKET.IO MULTIPLAYER
// ================================================================
const httpServer = http.createServer(app);
const io = new IOServer(httpServer, {
  path: SOCKET_PATH,
  cors: { origin: (process.env.CORS_ORIGINS || "*").split(","), methods: ["GET", "POST"] },
});

// In-memory rooms
const ROOMS = {}; // { roomId: { id, hostId, players: {socketId: player}, config, state, loop, sockets: Set } }

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = "";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (ROOMS[code]);
  return code;
}

function findRoomOfSocket(socket) {
  for (const r of Object.values(ROOMS)) {
    if (r.players[socket.id]) return r;
  }
  return null;
}

function sanitizeConfig(c) {
  return {
    infectedAtStart: Math.max(1, Math.min(3, parseInt(c?.infectedAtStart, 10) || 1)),
    duration: Math.max(30, Math.min(300, parseInt(c?.duration, 10) || 90)),
    fillWithBots: c?.fillWithBots !== false,
    targetPlayers: Math.max(2, Math.min(10, parseInt(c?.targetPlayers, 10) || 6)),
  };
}

function broadcastLobby(room) {
  io.to(room.id).emit("lobby_update", sim.makeLobbyPayload(room));
}

function startGameLoop(room) {
  if (room.loop) return;
  let lastT = Date.now();
  let tickCount = 0;
  room.loop = setInterval(() => {
    const now = Date.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const events = sim.tickRoom(room, dt);
    for (const ev of events) {
      if (ev.type === "infection") io.to(room.id).emit("infection", ev);
    }
    // broadcast state at ~20 Hz (every other tick at 30 Hz)
    if (tickCount % 2 === 0) {
      io.to(room.id).emit("state", sim.makeStatePayload(room));
    }
    if (room.state.phase === "ended") {
      io.to(room.id).emit("round_ended", sim.makeStatePayload(room));
      stopGameLoop(room);
      // save round results for human players
      saveRoundResults(room).catch(e => console.error("[kronos] save error:", e));
      // After 5s, reset to lobby
      setTimeout(() => {
        if (!ROOMS[room.id]) return;
        // remove bots
        for (const id of Object.keys(room.players)) {
          if (room.players[id].isBot) delete room.players[id];
        }
        room.state = sim.createRoomState(room.config);
        broadcastLobby(room);
      }, 5000);
    }
    tickCount++;
  }, 33);
}

function stopGameLoop(room) {
  if (room.loop) { clearInterval(room.loop); room.loop = null; }
}

async function saveRoundResults(room) {
  if (!db || !room.state.result) return;
  const winners = new Set(room.state.result.survivorIds);
  for (const p of Object.values(room.players)) {
    if (p.isBot) continue;
    const doc = {
      id: randomUUID(),
      nickname: p.name,
      survived: !p.infected,
      won: winners.has(p.id),
      role: "survivor",
      survived_seconds: room.state.elapsed,
      bots_count: Object.values(room.players).filter(x => x.isBot).length,
      survivors_left: room.state.result.survivorsLeft,
      mode: "multi",
      timestamp: new Date().toISOString(),
    };
    await db.collection("rounds").insertOne(doc);
  }
}

io.on("connection", (socket) => {
  console.log(`[kronos] socket connect ${socket.id}`);

  socket.on("create_room", ({ nickname, config }, ack) => {
    try {
      const id = makeRoomCode();
      const cfg = sanitizeConfig(config);
      const room = {
        id, hostId: socket.id, players: {}, config: cfg, loop: null,
        state: sim.createRoomState(cfg),
      };
      ROOMS[id] = room;
      addPlayer(room, socket, nickname);
      ack?.({ ok: true, roomId: id });
    } catch (e) {
      console.error(e);
      ack?.({ ok: false, error: "create_failed" });
    }
  });

  socket.on("join_room", ({ roomId, nickname }, ack) => {
    const code = String(roomId || "").toUpperCase().trim();
    const room = ROOMS[code];
    if (!room) return ack?.({ ok: false, error: "room_not_found" });
    const humans = Object.values(room.players).filter(p => !p.isBot).length;
    if (humans >= 10) return ack?.({ ok: false, error: "room_full" });
    if (room.state.phase !== "lobby") return ack?.({ ok: false, error: "in_progress" });
    addPlayer(room, socket, nickname);
    ack?.({ ok: true, roomId: room.id });
  });

  socket.on("update_config", ({ config }) => {
    const room = findRoomOfSocket(socket);
    if (!room || room.hostId !== socket.id || room.state.phase !== "lobby") return;
    room.config = sanitizeConfig(config);
    room.state.duration = room.config.duration;
    broadcastLobby(room);
  });

  socket.on("start_game", () => {
    const room = findRoomOfSocket(socket);
    if (!room || room.hostId !== socket.id || room.state.phase !== "lobby") return;
    sim.startRound(room);
    io.to(room.id).emit("round_starting", sim.makeStatePayload(room));
    startGameLoop(room);
  });

  socket.on("input", ({ ax, ay }) => {
    const room = findRoomOfSocket(socket);
    if (!room) return;
    const p = room.players[socket.id];
    if (!p) return;
    p.inputAx = Math.max(-1, Math.min(1, Number(ax) || 0));
    p.inputAy = Math.max(-1, Math.min(1, Number(ay) || 0));
  });

  socket.on("leave_room", () => {
    handleLeave(socket);
  });

  socket.on("get_lobby", () => {
    const room = findRoomOfSocket(socket);
    if (room) socket.emit("lobby_update", sim.makeLobbyPayload(room));
  });

  socket.on("disconnect", () => {
    console.log(`[kronos] socket disconnect ${socket.id}`);
    handleLeave(socket);
  });
});

function addPlayer(room, socket, nickname) {
  const name = String(nickname || "KRONOS").slice(0, 14).toUpperCase() || "KRONOS";
  room.players[socket.id] = {
    id: socket.id, name, isBot: false,
    x: 0, y: 0, vx: 0, vy: 0, facing: 1,
    infected: false, alive: true,
    inputAx: 0, inputAy: 0,
    infectedAt: 0, pulses: [], trail: [],
  };
  socket.join(room.id);
  socket.emit("room_joined", { roomId: room.id, selfId: socket.id });
  broadcastLobby(room);
}

function handleLeave(socket) {
  const room = findRoomOfSocket(socket);
  if (!room) return;
  delete room.players[socket.id];
  socket.leave(room.id);
  const humans = Object.values(room.players).filter(p => !p.isBot);
  if (humans.length === 0) {
    stopGameLoop(room);
    delete ROOMS[room.id];
    console.log(`[kronos] room ${room.id} destroyed (empty)`);
  } else {
    if (room.hostId === socket.id) {
      room.hostId = humans[0].id;
    }
    broadcastLobby(room);
  }
}

// ---------- Start ----------
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[kronos] arena listening on 0.0.0.0:${PORT}`);
  console.log(`[kronos] socket.io path: ${SOCKET_PATH}`);
});
initDb().catch(err => console.error("[kronos] mongo connect error:", err.message));
