// KRONOS INK PARK — server-side game simulation (pure JS, no DOM).
// Mirrors /app/frontend/src/game/engine.js + map.js for authoritative multiplayer.

const ARENA_W = 1600;
const ARENA_H = 960;
const PLAYER_RADIUS = 22;
const MAX_SPEED = 260;
const ACCEL = 1400;
const FRICTION = 6;
const INFECTED_SPEED_MULT = 1.06;
const INFECTION_GRACE = 0.6;

const BOT_NAMES = [
  "GHOST", "VYPER", "NOVA", "RAZOR", "ECHO", "SLUG", "MERC",
  "ZARA", "FANG", "PIXL", "KORE", "RIOT", "NULL", "OZZY",
];

const WALLS = [
  { x: 100,  y: 180, w: 280, h: 50, type: "ramp" },
  { x: 1220, y: 180, w: 280, h: 50, type: "ramp" },
  { x: 100,  y: 730, w: 280, h: 50, type: "ramp" },
  { x: 1220, y: 730, w: 280, h: 50, type: "ramp" },
  { x: 700,  y: 410, w: 200, h: 140, type: "bowl" },
  { x: 460,  y: 360, w: 70,  h: 70,  type: "block" },
  { x: 1070, y: 360, w: 70,  h: 70,  type: "block" },
  { x: 460,  y: 530, w: 70,  h: 70,  type: "block" },
  { x: 1070, y: 530, w: 70,  h: 70,  type: "block" },
  { x: 340,  y: 470, w: 140, h: 28,  type: "bench" },
  { x: 1120, y: 470, w: 140, h: 28,  type: "bench" },
  { x: 250,  y: 420, w: 42,  h: 42,  type: "barrel" },
  { x: 1308, y: 420, w: 42,  h: 42,  type: "barrel" },
  { x: 250,  y: 540, w: 42,  h: 42,  type: "barrel" },
  { x: 1308, y: 540, w: 42,  h: 42,  type: "barrel" },
  { x: 240,  y: 80,  w: 56,  h: 56,  type: "crate" },
  { x: 1304, y: 80,  w: 56,  h: 56,  type: "crate" },
  { x: 240,  y: 824, w: 56,  h: 56,  type: "crate" },
  { x: 1304, y: 824, w: 56,  h: 56,  type: "crate" },
  { x: 680,  y: 220, w: 26,  h: 26,  type: "cone" },
  { x: 894,  y: 220, w: 26,  h: 26,  type: "cone" },
  { x: 680,  y: 714, w: 26,  h: 26,  type: "cone" },
  { x: 894,  y: 714, w: 26,  h: 26,  type: "cone" },
  { x: 760,  y: 80,  w: 80,  h: 36,  type: "pallet" },
  { x: 760,  y: 844, w: 80,  h: 36,  type: "pallet" },
];

const SPAWNS = [
  { x: 80, y: 80 },
  { x: ARENA_W - 80, y: 80 },
  { x: 80, y: ARENA_H - 80 },
  { x: ARENA_W - 80, y: ARENA_H - 80 },
  { x: ARENA_W / 2, y: 60 },
  { x: ARENA_W / 2, y: ARENA_H - 60 },
  { x: 60, y: ARENA_H / 2 },
  { x: ARENA_W - 60, y: ARENA_H / 2 },
  { x: 380, y: 280 },
  { x: ARENA_W - 380, y: ARENA_H - 280 },
];

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rectOverlapsCircle(rx, ry, rw, rh, cx, cy, cr) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < cr * cr;
}

function resolveWalls(p) {
  for (const w of WALLS) {
    if (rectOverlapsCircle(w.x, w.y, w.w, w.h, p.x, p.y, PLAYER_RADIUS)) {
      const cx = Math.max(w.x, Math.min(p.x, w.x + w.w));
      const cy = Math.max(w.y, Math.min(p.y, w.y + w.h));
      let dx = p.x - cx, dy = p.y - cy;
      if (dx === 0 && dy === 0) { dx = 0.1; dy = 0.1; }
      const d = Math.hypot(dx, dy) || 1;
      const push = PLAYER_RADIUS - d;
      p.x += (dx / d) * push;
      p.y += (dy / d) * push;
      const dot = (p.vx * dx + p.vy * dy) / (d * d);
      if (dot < 0) { p.vx -= dot * dx * 1.2; p.vy -= dot * dy * 1.2; }
    }
  }
  if (p.x < PLAYER_RADIUS) { p.x = PLAYER_RADIUS; p.vx = Math.abs(p.vx) * 0.3; }
  if (p.y < PLAYER_RADIUS) { p.y = PLAYER_RADIUS; p.vy = Math.abs(p.vy) * 0.3; }
  if (p.x > ARENA_W - PLAYER_RADIUS) { p.x = ARENA_W - PLAYER_RADIUS; p.vx = -Math.abs(p.vx) * 0.3; }
  if (p.y > ARENA_H - PLAYER_RADIUS) { p.y = ARENA_H - PLAYER_RADIUS; p.vy = -Math.abs(p.vy) * 0.3; }
}

function updateAI(p, players, dt) {
  let target = null, best = Infinity;
  for (const o of players) {
    if (o.id === p.id || !o.alive) continue;
    const wantInfected = !p.infected;
    if (wantInfected !== o.infected) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < best) { best = d; target = o; }
  }
  p.aiPhase = (p.aiPhase || 0) + dt * 2;
  let ax = 0, ay = 0;
  if (target) {
    const dx = target.x - p.x, dy = target.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const dir = p.infected ? 1 : -1;
    ax = (dx / d) * dir + Math.cos(p.aiPhase * 1.3) * 0.35;
    ay = (dy / d) * dir + Math.sin(p.aiPhase * 1.7) * 0.35;
  } else {
    ax = Math.cos(p.aiPhase);
    ay = Math.sin(p.aiPhase);
  }
  for (const w of WALLS) {
    const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
    const dx = p.x - cx, dy = p.y - cy;
    const d = Math.hypot(dx, dy);
    if (d < 90 && d > 0) { ax += (dx / d) * (90 - d) * 0.04; ay += (dy / d) * (90 - d) * 0.04; }
  }
  const margin = 80;
  if (p.x < margin) ax += (margin - p.x) * 0.02;
  if (p.x > ARENA_W - margin) ax -= (p.x - (ARENA_W - margin)) * 0.02;
  if (p.y < margin) ay += (margin - p.y) * 0.02;
  if (p.y > ARENA_H - margin) ay -= (p.y - (ARENA_H - margin)) * 0.02;
  const len = Math.hypot(ax, ay) || 1;
  return { ax: ax / len, ay: ay / len };
}

function createRoomState(config) {
  return {
    phase: "lobby",
    countdown: 3.0,
    elapsed: 0,
    duration: config.duration || 90,
    infectionFlash: 0,
    particles: [],
    result: null,
    config,
  };
}

function startRound(room) {
  const playerList = Object.values(room.players);

  // Fill with bots if requested
  if (room.config.fillWithBots) {
    const desired = Math.min(10, Math.max(playerList.length + 1, room.config.targetPlayers || (playerList.length + 2)));
    const botsToAdd = desired - playerList.length;
    const usedNames = new Set(playerList.map(p => p.name));
    const available = shuffled(BOT_NAMES.filter(n => !usedNames.has(n)));
    for (let i = 0; i < botsToAdd && playerList.length < 10; i++) {
      const id = `bot-${Math.random().toString(36).slice(2, 10)}`;
      const bot = {
        id, name: available[i] || `BOT${i}`, isBot: true,
        x: 0, y: 0, vx: 0, vy: 0, facing: 1,
        infected: false, alive: true,
        inputAx: 0, inputAy: 0,
        aiPhase: Math.random() * Math.PI * 2,
        infectedAt: 0, pulses: [], trail: [],
      };
      room.players[id] = bot;
      playerList.push(bot);
    }
  }

  // Assign spawns
  const spawns = shuffled(SPAWNS).slice(0, playerList.length);
  playerList.forEach((p, i) => {
    p.x = spawns[i].x;
    p.y = spawns[i].y;
    p.vx = 0; p.vy = 0;
    p.facing = 1;
    p.infected = false;
    p.alive = true;
    p.trail = [];
    p.pulses = [];
    p.infectedAt = 0;
  });

  // Pick infected (prefer bots first)
  const infectedAtStart = Math.min(
    room.config.infectedAtStart || 1,
    Math.max(1, playerList.length - 1),
  );
  const botIndices = playerList.map((p, i) => p.isBot ? i : -1).filter(i => i >= 0);
  const humanIndices = playerList.map((p, i) => !p.isBot ? i : -1).filter(i => i >= 0);
  const pool = [...shuffled(botIndices), ...shuffled(humanIndices)];
  const chosen = pool.slice(0, infectedAtStart);
  for (const idx of chosen) {
    playerList[idx].infected = true;
    playerList[idx].infectedAt = -INFECTION_GRACE;
  }

  room.state.phase = "starting";
  room.state.countdown = 3.0;
  room.state.elapsed = 0;
  room.state.duration = room.config.duration || 90;
  room.state.infectionFlash = 0;
  room.state.particles = [];
  room.state.result = null;
  room.state.startedAt = Date.now();
}

function tickRoom(room, dt) {
  const st = room.state;
  if (st.phase === "ended" || st.phase === "lobby") return [];
  const events = [];

  if (st.phase === "starting") {
    st.countdown -= dt;
    if (st.countdown <= 0) { st.phase = "playing"; st.countdown = 0; }
    return events;
  }

  st.elapsed += dt;
  st.infectionFlash = Math.max(0, st.infectionFlash - dt * 1.6);

  const players = Object.values(room.players);

  for (const p of players) {
    if (!p.alive) continue;
    let ax = 0, ay = 0;
    if (p.isBot) {
      const r = updateAI(p, players, dt);
      ax = r.ax; ay = r.ay;
    } else {
      ax = p.inputAx || 0;
      ay = p.inputAy || 0;
    }
    p.vx += ax * ACCEL * dt;
    p.vy += ay * ACCEL * dt;
    p.vx -= p.vx * FRICTION * dt;
    p.vy -= p.vy * FRICTION * dt;
    const speedCap = MAX_SPEED * (p.infected ? INFECTED_SPEED_MULT : 1);
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > speedCap) { p.vx = (p.vx / sp) * speedCap; p.vy = (p.vy / sp) * speedCap; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (Math.abs(p.vx) > 5) p.facing = p.vx > 0 ? 1 : -1;
    resolveWalls(p);

    // pulses age out
    if (p.pulses) {
      for (const pu of p.pulses) { pu.r += pu.speed * dt; pu.life -= dt; }
      p.pulses = p.pulses.filter(pu => pu.life > 0);
    }
  }

  // Infections
  for (const a of players) {
    if (!a.alive || !a.infected) continue;
    if (st.elapsed - a.infectedAt < INFECTION_GRACE) continue;
    for (const b of players) {
      if (a === b || !b.alive || b.infected) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx * dx + dy * dy < (PLAYER_RADIUS * 2) ** 2) {
        b.infected = true;
        b.infectedAt = st.elapsed;
        if (!b.pulses) b.pulses = [];
        b.pulses.push({ r: 10, speed: 280, life: 0.7 });
        st.infectionFlash = 1;
        events.push({ type: "infection", playerId: b.id, x: b.x, y: b.y });
      }
    }
  }

  // End check
  const survivors = players.filter(p => !p.infected && p.alive);
  if (survivors.length === 0) endRound(room, "infected");
  else if (st.elapsed >= st.duration) endRound(room, "survivors");

  return events;
}

function endRound(room, winner) {
  const players = Object.values(room.players);
  const survivors = players.filter(p => !p.infected);
  room.state.phase = "ended";
  room.state.result = {
    winner,
    survivorsLeft: survivors.length,
    survivedSeconds: room.state.elapsed,
    survivorIds: survivors.map(p => p.id),
  };
}

function makeStatePayload(room) {
  return {
    roomId: room.id,
    hostId: room.hostId,
    phase: room.state.phase,
    countdown: room.state.countdown,
    elapsed: room.state.elapsed,
    duration: room.state.duration,
    infectionFlash: room.state.infectionFlash,
    config: room.config,
    players: Object.values(room.players).map(p => ({
      id: p.id,
      name: p.name,
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      vx: Math.round(p.vx * 10) / 10,
      vy: Math.round(p.vy * 10) / 10,
      facing: p.facing,
      infected: p.infected,
      alive: p.alive,
      isBot: p.isBot,
      pulses: p.pulses || [],
    })),
    result: room.state.result || null,
  };
}

function makeLobbyPayload(room) {
  return {
    roomId: room.id,
    hostId: room.hostId,
    config: room.config,
    phase: room.state.phase,
    players: Object.values(room.players)
      .filter(p => !p.isBot)
      .map(p => ({
        id: p.id, name: p.name, isHost: p.id === room.hostId, isBot: p.isBot,
      })),
  };
}

module.exports = {
  ARENA_W, ARENA_H, PLAYER_RADIUS, BOT_NAMES, SPAWNS, WALLS,
  createRoomState, startRound, tickRoom, makeStatePayload, makeLobbyPayload, shuffled,
};
