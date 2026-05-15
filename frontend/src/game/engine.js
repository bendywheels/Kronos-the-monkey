// INK PARK — Core game engine: state, physics, AI, rendering.
import { ARENA_W, ARENA_H, WALLS, SPAWNS, DECALS } from "./map";

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

// seeded RNG so the procedural floor is identical every frame
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
      if (dot < 0) {
        p.vx -= dot * dx * 1.2;
        p.vy -= dot * dy * 1.2;
      }
    }
  }
  if (p.x < PLAYER_RADIUS) { p.x = PLAYER_RADIUS; p.vx = Math.abs(p.vx) * 0.3; }
  if (p.y < PLAYER_RADIUS) { p.y = PLAYER_RADIUS; p.vy = Math.abs(p.vy) * 0.3; }
  if (p.x > ARENA_W - PLAYER_RADIUS) { p.x = ARENA_W - PLAYER_RADIUS; p.vx = -Math.abs(p.vx) * 0.3; }
  if (p.y > ARENA_H - PLAYER_RADIUS) { p.y = ARENA_H - PLAYER_RADIUS; p.vy = -Math.abs(p.vy) * 0.3; }
}

export function createGame({ nickname, botCount, durationSec = 90 }) {
  const totalPlayers = Math.min(10, 1 + botCount);
  const spawns = shuffled(SPAWNS).slice(0, totalPlayers);
  const botNames = shuffled(BOT_NAMES).slice(0, totalPlayers - 1);

  const players = [];
  players.push({
    id: "you", name: nickname || "KRONOS", isBot: false,
    x: spawns[0].x, y: spawns[0].y, vx: 0, vy: 0, facing: 1,
    infected: false, alive: true, trail: [], infectedAt: 0, pulses: [],
  });
  for (let i = 1; i < totalPlayers; i++) {
    players.push({
      id: `bot-${i}`, name: botNames[i - 1], isBot: true,
      x: spawns[i].x, y: spawns[i].y, vx: 0, vy: 0, facing: 1,
      infected: false, alive: true, trail: [],
      aiPhase: Math.random() * Math.PI * 2,
      infectedAt: 0, pulses: [],
    });
  }
  const botIdx = players.findIndex(p => p.isBot);
  // Start with up to 3 infected (1 + 2 extra), always leave >=1 survivor.
  const infectedAtStart = Math.min(3, Math.max(1, totalPlayers - 1));
  // Prefer bots as patient zero so the player isn't always infected.
  const botIndices = players
    .map((p, i) => (p.isBot ? i : -1))
    .filter(i => i >= 0);
  const chosen = shuffled(botIndices).slice(0, infectedAtStart);
  if (chosen.length < infectedAtStart) {
    const rest = players
      .map((_, i) => i)
      .filter(i => !chosen.includes(i));
    for (const i of shuffled(rest)) {
      if (chosen.length >= infectedAtStart) break;
      chosen.push(i);
    }
  }
  for (const i of chosen) {
    players[i].infected = true;
    players[i].infectedAt = -INFECTION_GRACE;
  }
  const youInitiallyInfected = chosen.includes(0);
  // (legacy var kept for compatibility with existing code paths)
  const patientZero = chosen[0] ?? (botIdx >= 0 ? botIdx : 0);

  return {
    players,
    duration: durationSec,
    elapsed: 0,
    status: "starting",
    countdown: 3.0,
    result: null,
    particles: [],
    infectionFlash: 0,
    playerInput: { ax: 0, ay: 0 },
    youInitiallyInfected,
    _bgCanvas: null,
    _patientZero: patientZero,
  };
}

export function setPlayerInput(game, ax, ay) {
  const len = Math.hypot(ax, ay) || 1;
  game.playerInput.ax = ax / Math.max(1, len);
  game.playerInput.ay = ay / Math.max(1, len);
}

function updateAI(p, game, dt) {
  let target = null, best = Infinity;
  for (const o of game.players) {
    if (o.id === p.id) continue;
    const wantInfected = !p.infected;
    if (wantInfected !== o.infected) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < best) { best = d; target = o; }
  }
  p.aiPhase += dt * 2;
  let ax = 0, ay = 0;
  if (target) {
    const dx = target.x - p.x, dy = target.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const dir = p.infected ? 1 : -1;
    ax = (dx / d) * dir;
    ay = (dy / d) * dir;
    ax += Math.cos(p.aiPhase * 1.3) * 0.35;
    ay += Math.sin(p.aiPhase * 1.7) * 0.35;
  } else {
    ax = Math.cos(p.aiPhase);
    ay = Math.sin(p.aiPhase);
  }
  for (const w of WALLS) {
    const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
    const dx = p.x - cx, dy = p.y - cy;
    const d = Math.hypot(dx, dy);
    if (d < 90) {
      ax += (dx / d) * (90 - d) * 0.04;
      ay += (dy / d) * (90 - d) * 0.04;
    }
  }
  const margin = 80;
  if (p.x < margin) ax += (margin - p.x) * 0.02;
  if (p.x > ARENA_W - margin) ax -= (p.x - (ARENA_W - margin)) * 0.02;
  if (p.y < margin) ay += (margin - p.y) * 0.02;
  if (p.y > ARENA_H - margin) ay -= (p.y - (ARENA_H - margin)) * 0.02;
  const len = Math.hypot(ax, ay) || 1;
  return { ax: ax / len, ay: ay / len };
}

function spawnInfectionParticles(game, x, y) {
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 80 + Math.random() * 220;
    game.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.9, max: 0.9,
      color: Math.random() < 0.6 ? "#a855f7" : "#84cc16",
      size: 2 + Math.random() * 3,
    });
  }
}

function spawnTrail(p) {
  p.trail.push({ x: p.x, y: p.y, life: 0.35 });
  if (p.trail.length > 22) p.trail.shift();
}

export function update(game, dt) {
  if (game.status === "ended") return;
  if (game.status === "starting") {
    game.countdown -= dt;
    if (game.countdown <= 0) { game.status = "playing"; game.countdown = 0; }
    return;
  }

  game.elapsed += dt;
  game.infectionFlash = Math.max(0, game.infectionFlash - dt * 1.6);

  for (const p of game.players) {
    if (!p.alive) continue;
    let ax = 0, ay = 0;
    if (p.isBot) { const r = updateAI(p, game, dt); ax = r.ax; ay = r.ay; }
    else { ax = game.playerInput.ax; ay = game.playerInput.ay; }

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

    if (sp > 30) spawnTrail(p);
    // dust particles from wheels when skating fast
    if (sp > 120 && Math.random() < 0.6) {
      game.particles.push({
        x: p.x + (Math.random() - 0.5) * 10,
        y: p.y + PLAYER_RADIUS * 0.85 + (Math.random() - 0.5) * 4,
        vx: -p.vx * 0.06 + (Math.random() - 0.5) * 30,
        vy: -10 - Math.random() * 25,
        life: 0.45, max: 0.45,
        kind: "dust",
        size: 1.5 + Math.random() * 2.2,
      });
    }
    for (const t of p.trail) t.life -= dt;
    p.trail = p.trail.filter(t => t.life > 0);

    for (const pu of p.pulses) { pu.r += pu.speed * dt; pu.life -= dt; }
    p.pulses = p.pulses.filter(pu => pu.life > 0);
  }

  // infection collisions
  for (const a of game.players) {
    if (!a.alive || !a.infected) continue;
    if (game.elapsed - a.infectedAt < INFECTION_GRACE) continue;
    for (const b of game.players) {
      if (a === b || !b.alive || b.infected) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx * dx + dy * dy < (PLAYER_RADIUS * 2) * (PLAYER_RADIUS * 2)) {
        b.infected = true;
        b.infectedAt = game.elapsed;
        b.pulses.push({ r: 10, speed: 280, life: 0.7 });
        spawnInfectionParticles(game, b.x, b.y);
        game.infectionFlash = 1;
        game._onInfection?.(b);
      }
    }
  }

  for (const p of game.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.9; p.vy *= 0.9;
    p.life -= dt;
  }
  game.particles = game.particles.filter(p => p.life > 0);

  const survivors = game.players.filter(p => !p.infected);
  if (survivors.length === 0) endGame(game, "infected");
  else if (game.elapsed >= game.duration) endGame(game, "survivors");
}

function endGame(game, winner) {
  game.status = "ended";
  const you = game.players.find(p => p.id === "you");
  const survivors = game.players.filter(p => !p.infected);
  const youWon = winner === "survivors" ? !you.infected : you.infected;
  game.result = {
    winner,
    survivorsLeft: survivors.length,
    youSurvived: !you.infected,
    youWon,
    role: game.youInitiallyInfected ? "infected" : "survivor",
    survivedSeconds: game.elapsed,
  };
  game._onEnd?.(game.result);
}

// ============ RENDERING ============

// Pre-render the static floor + decals to an offscreen canvas (once).
function buildBackground() {
  const off = document.createElement("canvas");
  off.width = ARENA_W;
  off.height = ARENA_H;
  const ctx = off.getContext("2d");
  const rand = mulberry32(1337);

  // base dark concrete
  ctx.fillStyle = "#171420";
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  // gradient vignette
  const vg = ctx.createRadialGradient(
    ARENA_W / 2, ARENA_H / 2, 200,
    ARENA_W / 2, ARENA_H / 2, Math.max(ARENA_W, ARENA_H) * 0.7,
  );
  vg.addColorStop(0, "rgba(40, 25, 60, 0.0)");
  vg.addColorStop(1, "rgba(0, 0, 0, 0.6)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  // concrete tile grid (subtle)
  ctx.strokeStyle = "rgba(80, 60, 95, 0.18)";
  ctx.lineWidth = 1;
  const T = 80;
  for (let x = 0; x <= ARENA_W; x += T) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); ctx.stroke();
  }
  for (let y = 0; y <= ARENA_H; y += T) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_W, y); ctx.stroke();
  }

  // concrete noise speckles
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let i = 0; i < 4500; i++) {
    ctx.fillRect(rand() * ARENA_W, rand() * ARENA_H, 1, 1);
  }
  // dark cracks
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 18; i++) {
    const sx = rand() * ARENA_W, sy = rand() * ARENA_H;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    let cx = sx, cy = sy;
    for (let k = 0; k < 5; k++) {
      cx += (rand() - 0.5) * 80;
      cy += (rand() - 0.5) * 80;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // ink splatters scattered on floor (procedural)
  for (let i = 0; i < 14; i++) {
    const cx = 60 + rand() * (ARENA_W - 120);
    const cy = 60 + rand() * (ARENA_H - 120);
    const baseR = 22 + rand() * 42;
    const hue = rand() < 0.8 ? "168, 85, 247" : "132, 204, 22";
    ctx.fillStyle = `rgba(${hue}, 0.11)`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, baseR, baseR * (0.6 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    // satellite drips
    for (let j = 0; j < 3; j++) {
      const a = rand() * Math.PI * 2;
      const dist = baseR * (0.6 + rand() * 1.0);
      const r = 3 + rand() * 9;
      ctx.fillStyle = `rgba(${hue}, ${0.10 + rand() * 0.10})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // explicit decal puddles from map
  for (const d of DECALS) {
    if (d.type !== "puddle") continue;
    ctx.fillStyle = "rgba(168, 85, 247, 0.20)";
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, d.r, d.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(168, 85, 247, 0.10)";
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, d.r * 1.5, d.r * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // graffiti texts
  for (const d of DECALS) {
    if (!d.text) continue;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot || 0);
    ctx.font = `${d.size}px Creepster, "Permanent Marker", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(d.text, 3, 3);
    ctx.fillStyle = d.color + "cc";
    ctx.fillText(d.text, 0, 0);
    ctx.restore();
  }

  // Chainlink fence border (diamond pattern)
  ctx.strokeStyle = "rgba(180, 180, 200, 0.18)";
  ctx.lineWidth = 1;
  const BD = 28;
  const FENCE_W = 40;
  // top + bottom bands
  for (let band of [0, ARENA_H - FENCE_W]) {
    for (let x = -BD; x < ARENA_W + BD; x += BD) {
      ctx.beginPath();
      ctx.moveTo(x, band);
      ctx.lineTo(x + BD / 2, band + FENCE_W);
      ctx.lineTo(x + BD, band);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, band + FENCE_W);
      ctx.lineTo(x + BD / 2, band);
      ctx.lineTo(x + BD, band + FENCE_W);
      ctx.stroke();
    }
  }
  // left + right bands
  for (let band of [0, ARENA_W - FENCE_W]) {
    for (let y = -BD; y < ARENA_H + BD; y += BD) {
      ctx.beginPath();
      ctx.moveTo(band, y);
      ctx.lineTo(band + FENCE_W, y + BD / 2);
      ctx.lineTo(band, y + BD);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(band + FENCE_W, y);
      ctx.lineTo(band, y + BD / 2);
      ctx.lineTo(band + FENCE_W, y + BD);
      ctx.stroke();
    }
  }

  // hazard caution stripes at corners
  for (const [cx, cy] of [[0, 0], [ARENA_W - 80, 0], [0, ARENA_H - 80], [ARENA_W - 80, ARENA_H - 80]]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = 0.55;
    for (let i = -80; i < 80; i += 18) {
      ctx.fillStyle = i % 36 === 0 ? "#1a1a1a" : "#e6c200";
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 14, 0);
      ctx.lineTo(i - 6, 80);
      ctx.lineTo(i - 20, 80);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  return off;
}

// ============ Wall / prop drawing ============
function drawWall(ctx, w, t) {
  switch (w.type) {
    case "ramp": return drawRamp(ctx, w);
    case "bowl": return drawBowl(ctx, w);
    case "block": return drawBlock(ctx, w);
    case "bench": return drawBench(ctx, w);
    case "barrel": return drawBarrel(ctx, w, t);
    case "crate": return drawCrate(ctx, w);
    case "cone": return drawCone(ctx, w);
    case "pallet": return drawPallet(ctx, w);
    default: return drawBlock(ctx, w);
  }
}

function drawRamp(ctx, w) {
  // concrete body
  const grad = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
  grad.addColorStop(0, "#5a5260");
  grad.addColorStop(1, "#2b2730");
  ctx.fillStyle = grad;
  ctx.fillRect(w.x, w.y, w.w, w.h);
  // concrete plank lines
  ctx.strokeStyle = "rgba(20,15,25,0.5)";
  ctx.lineWidth = 1;
  const stripes = 6;
  for (let i = 1; i < stripes; i++) {
    const x = w.x + (w.w / stripes) * i;
    ctx.beginPath(); ctx.moveTo(x, w.y); ctx.lineTo(x, w.y + w.h); ctx.stroke();
  }
  // painted purple top
  ctx.fillStyle = "#a855f7";
  ctx.fillRect(w.x, w.y, w.w, 6);
  ctx.fillStyle = "rgba(192,132,252,0.6)";
  ctx.fillRect(w.x, w.y, w.w, 2);
  // outline
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
}

function drawBowl(ctx, w) {
  // dark concrete bowl rim
  const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
  ctx.fillStyle = "#1a1620";
  ctx.beginPath();
  ctx.ellipse(cx, cy, w.w / 2, w.h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // rim purple
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#a855f7";
  ctx.beginPath();
  ctx.ellipse(cx, cy, w.w / 2 - 3, w.h / 2 - 3, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(192,132,252,0.6)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, w.w / 2 - 3, w.h / 2 - 3, 0, 0, Math.PI * 2);
  ctx.stroke();
  // ink inside
  ctx.fillStyle = "rgba(168, 85, 247, 0.25)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, w.w / 2 - 12, w.h / 2 - 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // biohazard mark
  ctx.font = "bold 60px Bungee, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(168, 85, 247, 0.7)";
  ctx.fillText("☣", cx, cy + 4);
}

function drawBlock(ctx, w) {
  const grad = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
  grad.addColorStop(0, "#4a4250");
  grad.addColorStop(1, "#241f2a");
  ctx.fillStyle = grad;
  ctx.fillRect(w.x, w.y, w.w, w.h);
  // purple top edge
  ctx.fillStyle = "#a855f7";
  ctx.fillRect(w.x, w.y, w.w, 5);
  // graffiti X
  ctx.strokeStyle = "rgba(132, 204, 22, 0.4)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w.x + 14, w.y + 18);
  ctx.lineTo(w.x + w.w - 14, w.y + w.h - 8);
  ctx.moveTo(w.x + w.w - 14, w.y + 18);
  ctx.lineTo(w.x + 14, w.y + w.h - 8);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 1;
  ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
}

function drawBench(ctx, w) {
  const grad = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
  grad.addColorStop(0, "#5a5260");
  grad.addColorStop(1, "#2b2730");
  ctx.fillStyle = grad;
  ctx.fillRect(w.x, w.y, w.w, w.h);
  ctx.fillStyle = "#a855f7";
  ctx.fillRect(w.x, w.y, w.w, 4);
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
}

function drawBarrel(ctx, w, t) {
  const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
  const r = w.w / 2;
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.95, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // body
  const grad = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  grad.addColorStop(0, "#3a4520");
  grad.addColorStop(0.5, "#6b8030");
  grad.addColorStop(1, "#3a4520");
  ctx.fillStyle = grad;
  ctx.fillRect(w.x, w.y, w.w, w.h);
  // metal bands
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(w.x, w.y + 6, w.w, 3);
  ctx.fillRect(w.x, w.y + w.h - 9, w.w, 3);
  // glowing top liquid
  const pulse = (Math.sin(t * 3) + 1) * 0.5;
  ctx.fillStyle = `rgba(132, 204, 22, ${0.6 + pulse * 0.3})`;
  ctx.beginPath();
  ctx.ellipse(cx, w.y + 4, r * 0.85, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // biohazard symbol
  ctx.font = `bold ${Math.floor(r * 1.0)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillText("☣", cx, cy + 2);
  // outline
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
}

function drawCrate(ctx, w) {
  // wooden body
  const grad = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
  grad.addColorStop(0, "#7a5530");
  grad.addColorStop(1, "#3d2a18");
  ctx.fillStyle = grad;
  ctx.fillRect(w.x, w.y, w.w, w.h);
  // planks
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1.2;
  const planks = 3;
  for (let i = 1; i < planks; i++) {
    const y = w.y + (w.h / planks) * i;
    ctx.beginPath(); ctx.moveTo(w.x, y); ctx.lineTo(w.x + w.w, y); ctx.stroke();
  }
  // X reinforcement
  ctx.strokeStyle = "rgba(20,15,8,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w.x + 4, w.y + 4);
  ctx.lineTo(w.x + w.w - 4, w.y + w.h - 4);
  ctx.moveTo(w.x + w.w - 4, w.y + 4);
  ctx.lineTo(w.x + 4, w.y + w.h - 4);
  ctx.stroke();
  // purple ink stamp
  ctx.font = "bold 14px Bungee, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(168, 85, 247, 0.7)";
  ctx.fillText("☣", w.x + w.w / 2, w.y + w.h / 2);
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 1;
  ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
}

function drawCone(ctx, w) {
  const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
  const r = w.w / 2;
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.9, r * 0.9, r * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  // base
  ctx.fillStyle = "#222";
  ctx.fillRect(w.x, cy + r * 0.55, w.w, r * 0.4);
  // cone body
  ctx.fillStyle = "#e8651a";
  ctx.beginPath();
  ctx.moveTo(cx, w.y + 2);
  ctx.lineTo(w.x + w.w - 2, cy + r * 0.6);
  ctx.lineTo(w.x + 2, cy + r * 0.6);
  ctx.closePath();
  ctx.fill();
  // reflective stripe
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy + r * 0.05);
  ctx.lineTo(cx + r * 0.55, cy + r * 0.05);
  ctx.lineTo(cx + r * 0.6, cy + r * 0.2);
  ctx.lineTo(cx - r * 0.6, cy + r * 0.2);
  ctx.closePath();
  ctx.fill();
  // outline
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.beginPath();
  ctx.moveTo(cx, w.y + 2);
  ctx.lineTo(w.x + w.w - 2, cy + r * 0.6);
  ctx.lineTo(w.x + 2, cy + r * 0.6);
  ctx.closePath();
  ctx.stroke();
}

function drawPallet(ctx, w) {
  ctx.fillStyle = "#5a3a1f";
  ctx.fillRect(w.x, w.y, w.w, w.h);
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  const planks = 4;
  for (let i = 1; i < planks; i++) {
    const x = w.x + (w.w / planks) * i;
    ctx.beginPath(); ctx.moveTo(x, w.y); ctx.lineTo(x, w.y + w.h); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
}

function drawPlayer(ctx, p, sprites, isLocal, t) {
  const speed = Math.hypot(p.vx, p.vy);

  // === GROUND TRAIL ===
  for (let i = 0; i < p.trail.length; i++) {
    const tr = p.trail[i];
    const alpha = (tr.life / 0.35) * 0.4;
    if (p.infected) {
      ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`;
    } else {
      ctx.fillStyle = `rgba(251, 191, 36, ${alpha * 0.7})`;
    }
    ctx.beginPath();
    ctx.arc(tr.x, tr.y, PLAYER_RADIUS * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // === MOTION-BLUR GHOSTS (at high speed) ===
  const img = p.infected ? sprites.infected : sprites.survivor;
  const size = PLAYER_RADIUS * 2.8;
  if (speed > 100 && img) {
    for (let g = 3; g >= 1; g--) {
      const tr = p.trail[p.trail.length - g * 2];
      if (!tr) continue;
      ctx.save();
      ctx.globalAlpha = 0.08 * g;
      ctx.translate(tr.x, tr.y - 4);
      ctx.scale(p.facing, 1);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }

  // === PULSES (newly infected ring) ===
  for (const pu of p.pulses) {
    ctx.strokeStyle = `rgba(168, 85, 247, ${pu.life / 0.7})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pu.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(132, 204, 22, ${(pu.life / 0.7) * 0.7})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pu.r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // === FOOT GLOW (radial under feet) ===
  const glowPulse = 1 + Math.sin(t * 4 + (p.aiPhase || 0)) * 0.07;
  const grad = ctx.createRadialGradient(p.x, p.y, 5, p.x, p.y, PLAYER_RADIUS * 2.9 * glowPulse);
  if (p.infected) {
    grad.addColorStop(0, "rgba(168, 85, 247, 0.78)");
    grad.addColorStop(0.6, "rgba(132, 204, 22, 0.18)");
    grad.addColorStop(1, "rgba(168, 85, 247, 0)");
  } else {
    grad.addColorStop(0, "rgba(251, 191, 36, 0.7)");
    grad.addColorStop(1, "rgba(251, 191, 36, 0)");
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_RADIUS * 2.9 * glowPulse, 0, Math.PI * 2);
  ctx.fill();

  // === SHADOW (stretches with speed) ===
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.beginPath();
  ctx.ellipse(
    p.x,
    p.y + PLAYER_RADIUS * 0.92,
    PLAYER_RADIUS * (0.7 + speed / 700),
    PLAYER_RADIUS * 0.25,
    0, 0, Math.PI * 2,
  );
  ctx.fill();

  // === SPRITE with BOB + LEAN animation ===
  // bob: vertical oscillation tied to speed (0 when still)
  const speedNorm = Math.min(speed / 240, 1);
  const bobPhase = (p.aiPhase || 0) * 3 + t * 16;
  const bob = Math.sin(bobPhase) * speedNorm * 4.5;
  // pump-style lean alternates with bob frequency, plus directional lean
  const dirLean = Math.max(-0.18, Math.min(0.18, (p.vx / MAX_SPEED) * 0.22 * p.facing));
  const pumpLean = Math.cos(bobPhase) * speedNorm * 0.08;
  const lean = dirLean + pumpLean;

  ctx.save();
  // color-grade sprite to integrate with grungy scene (kills the "PNG sticker" feel)
  if (p.infected) {
    ctx.filter = "brightness(0.78) saturate(1.05) contrast(1.08) hue-rotate(-8deg)";
  } else {
    ctx.filter = "brightness(0.86) saturate(0.92) contrast(1.05)";
  }
  ctx.translate(p.x, p.y - 4 + bob);
  ctx.rotate(lean);
  ctx.scale(p.facing, 1);
  if (img) {
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = p.infected ? "#a855f7" : "#fbbf24";
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = "none";
  ctx.restore();

  // === RIM-LIGHT OVERLAY (scene integration — kills the "PNG sticker" feel) ===
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  const rim = ctx.createRadialGradient(p.x, p.y - 4 + bob, 4, p.x, p.y - 4 + bob, PLAYER_RADIUS * 1.4);
  if (p.infected) {
    rim.addColorStop(0, "rgba(192, 132, 252, 0.5)");
    rim.addColorStop(1, "rgba(168, 85, 247, 0)");
  } else {
    rim.addColorStop(0, "rgba(253, 230, 138, 0.55)");
    rim.addColorStop(1, "rgba(251, 191, 36, 0)");
  }
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 4 + bob, PLAYER_RADIUS * 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // === DARKEN BOTTOM EDGE (color-burn) to ground the sprite ===
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  const burn = ctx.createLinearGradient(0, p.y, 0, p.y + PLAYER_RADIUS);
  burn.addColorStop(0, "rgba(255,255,255,1)");
  burn.addColorStop(1, "rgba(130, 100, 160, 1)");
  ctx.fillStyle = burn;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + PLAYER_RADIUS * 0.45, PLAYER_RADIUS * 0.85, PLAYER_RADIUS * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // === SKATE MOTION LINES under the board when fast ===
  if (speed > 140) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min((speed - 140) / 120, 1) * 0.45})`;
    ctx.lineWidth = 1.5;
    const dx = -p.vx * 0.06;
    const dy = -p.vy * 0.06;
    for (let i = 0; i < 3; i++) {
      const ox = (Math.random() - 0.5) * 8;
      ctx.beginPath();
      ctx.moveTo(p.x + ox, p.y + PLAYER_RADIUS * 0.85);
      ctx.lineTo(p.x + ox + dx * (1 + i * 0.4), p.y + PLAYER_RADIUS * 0.85 + dy * (1 + i * 0.4));
      ctx.stroke();
    }
  }

  // === LABEL ===
  ctx.font = "bold 14px 'Permanent Marker', 'Special Elite', cursive";
  ctx.textAlign = "center";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  const label = (isLocal ? "★ " : "") + p.name + (p.infected ? " ☣" : "");
  ctx.strokeText(label, p.x, p.y - PLAYER_RADIUS - 14 + bob * 0.5);
  ctx.fillStyle = isLocal
    ? "#fbbf24"
    : (p.infected ? "#c084fc" : "#fde68a");
  ctx.fillText(label, p.x, p.y - PLAYER_RADIUS - 14 + bob * 0.5);
}

function drawParticles(ctx, game) {
  for (const p of game.particles) {
    const a = Math.max(0, p.life / p.max);
    if (p.kind === "dust") {
      ctx.fillStyle = `rgba(190, 180, 210, ${a * 0.55})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size || 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const c = p.color || "#a855f7";
    const rgb = c === "#84cc16" ? "132, 204, 22" : "168, 85, 247";
    ctx.fillStyle = `rgba(${rgb}, ${a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function render(canvas, game, sprites, t) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;

  if (!game._bgCanvas) game._bgCanvas = buildBackground();

  const scale = Math.min(w / ARENA_W, h / ARENA_H);
  const offX = (w - ARENA_W * scale) / 2;
  const offY = (h - ARENA_H * scale) / 2;

  ctx.fillStyle = "#08060c";
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(scale, scale);

  // background
  ctx.drawImage(game._bgCanvas, 0, 0);

  // walls / props
  for (const wall of WALLS) drawWall(ctx, wall, t);

  // particles behind players
  drawParticles(ctx, game);

  // players: survivors below, infected on top
  const survivors = game.players.filter(p => !p.infected);
  const infected = game.players.filter(p => p.infected);
  for (const p of survivors) drawPlayer(ctx, p, sprites, p.id === "you", t);
  for (const p of infected) drawPlayer(ctx, p, sprites, p.id === "you", t);

  // infection flash overlay
  if (game.infectionFlash > 0) {
    ctx.fillStyle = `rgba(168, 85, 247, ${game.infectionFlash * 0.22})`;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }

  // subtle scanline grit
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#000";
  for (let y = 0; y < ARENA_H; y += 3) ctx.fillRect(0, y, ARENA_W, 1);
  ctx.globalAlpha = 1;

  ctx.restore();

  return { scale, offX, offY };
}

export const GAME_CONST = { ARENA_W, ARENA_H, PLAYER_RADIUS };
