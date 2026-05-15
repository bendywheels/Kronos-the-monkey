// Core game engine: state, physics, AI, rendering.
import { ARENA_W, ARENA_H, TILE, WALLS, SPAWNS } from "./map";

const PLAYER_RADIUS = 22;
const MAX_SPEED = 260;        // px/s
const ACCEL = 1400;           // px/s^2
const FRICTION = 6;           // damping
const INFECTED_SPEED_MULT = 1.06;
const INFECTION_GRACE = 0.6;  // seconds after infection before they can infect

const BOT_NAMES = [
  "GHOST", "VYPER", "NOVA", "RAZOR", "ECHO", "SLUG", "MERC",
  "ZARA", "FANG", "PIXL", "KORE", "RIOT", "NULL", "OZZY",
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
      // bounce velocity slightly
      const dot = (p.vx * dx + p.vy * dy) / (d * d);
      if (dot < 0) {
        p.vx -= dot * dx * 1.2;
        p.vy -= dot * dy * 1.2;
      }
    }
  }
  // arena bounds
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
  // human player
  players.push({
    id: "you",
    name: nickname || "KRONOS",
    isBot: false,
    x: spawns[0].x, y: spawns[0].y,
    vx: 0, vy: 0,
    facing: 1, // 1 = right, -1 = left
    infected: false,
    alive: true,
    trail: [],
    infectedAt: 0,
    pulses: [],
  });
  for (let i = 1; i < totalPlayers; i++) {
    players.push({
      id: `bot-${i}`,
      name: botNames[i - 1],
      isBot: true,
      x: spawns[i].x, y: spawns[i].y,
      vx: 0, vy: 0,
      facing: 1,
      infected: false,
      alive: true,
      trail: [],
      aiPhase: Math.random() * Math.PI * 2,
      infectedAt: 0,
      pulses: [],
    });
  }
  // pick first infected: prefer a bot so player isn't always patient zero
  const botIdx = players.findIndex(p => p.isBot);
  const patientZero = botIdx >= 0 ? botIdx : 0;
  players[patientZero].infected = true;
  players[patientZero].infectedAt = -INFECTION_GRACE; // no grace at start

  return {
    players,
    duration: durationSec,
    elapsed: 0,
    status: "starting", // 'starting' | 'playing' | 'ended'
    countdown: 3.0,
    result: null, // {winner: 'survivors' | 'infected', survivorsLeft, youSurvived, youWon, role}
    particles: [],
    infectionFlash: 0,
    playerInput: { ax: 0, ay: 0 },
    youInitiallyInfected: players[patientZero].id === "you",
  };
}

export function setPlayerInput(game, ax, ay) {
  // ax, ay in [-1,1]
  const len = Math.hypot(ax, ay) || 1;
  game.playerInput.ax = ax / Math.max(1, len);
  game.playerInput.ay = ay / Math.max(1, len);
}

function updateAI(p, game, dt) {
  // find nearest target
  let target = null, best = Infinity;
  for (const o of game.players) {
    if (o.id === p.id) continue;
    // survivor bots flee infected; infected bots chase survivors
    const wantInfected = !p.infected; // if survivor, want infected nearby (to flee)
    if (wantInfected !== o.infected) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < best) { best = d; target = o; }
  }

  p.aiPhase += dt * 2;
  let ax = 0, ay = 0;
  if (target) {
    const dx = target.x - p.x, dy = target.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const dir = p.infected ? 1 : -1; // chase or flee
    ax = (dx / d) * dir;
    ay = (dy / d) * dir;
    // wander noise
    ax += Math.cos(p.aiPhase * 1.3) * 0.35;
    ay += Math.sin(p.aiPhase * 1.7) * 0.35;
  } else {
    ax = Math.cos(p.aiPhase);
    ay = Math.sin(p.aiPhase);
  }

  // avoid walls (look-ahead)
  for (const w of WALLS) {
    const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
    const dx = p.x - cx, dy = p.y - cy;
    const d = Math.hypot(dx, dy);
    if (d < 90) {
      ax += (dx / d) * (90 - d) * 0.04;
      ay += (dy / d) * (90 - d) * 0.04;
    }
  }
  // arena edge avoidance
  const margin = 80;
  if (p.x < margin) ax += (margin - p.x) * 0.02;
  if (p.x > ARENA_W - margin) ax -= (p.x - (ARENA_W - margin)) * 0.02;
  if (p.y < margin) ay += (margin - p.y) * 0.02;
  if (p.y > ARENA_H - margin) ay -= (p.y - (ARENA_H - margin)) * 0.02;

  const len = Math.hypot(ax, ay) || 1;
  ax /= len; ay /= len;
  return { ax, ay };
}

function spawnInfectionParticles(game, x, y) {
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 80 + Math.random() * 180;
    game.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.8, max: 0.8, color: "#ff3355",
    });
  }
}

function spawnTrail(p) {
  // small skate motion trail
  p.trail.push({ x: p.x, y: p.y, life: 0.35 });
  if (p.trail.length > 22) p.trail.shift();
}

export function update(game, dt) {
  if (game.status === "ended") return;

  if (game.status === "starting") {
    game.countdown -= dt;
    if (game.countdown <= 0) {
      game.status = "playing";
      game.countdown = 0;
    }
    return;
  }

  game.elapsed += dt;
  game.infectionFlash = Math.max(0, game.infectionFlash - dt * 1.6);

  for (const p of game.players) {
    if (!p.alive) continue;

    let ax = 0, ay = 0;
    if (p.isBot) {
      const r = updateAI(p, game, dt);
      ax = r.ax; ay = r.ay;
    } else {
      ax = game.playerInput.ax;
      ay = game.playerInput.ay;
    }

    p.vx += ax * ACCEL * dt;
    p.vy += ay * ACCEL * dt;
    // friction
    p.vx -= p.vx * FRICTION * dt;
    p.vy -= p.vy * FRICTION * dt;

    // clamp speed
    const speedCap = MAX_SPEED * (p.infected ? INFECTED_SPEED_MULT : 1);
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > speedCap) { p.vx = (p.vx / sp) * speedCap; p.vy = (p.vy / sp) * speedCap; }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (Math.abs(p.vx) > 5) p.facing = p.vx > 0 ? 1 : -1;
    resolveWalls(p);

    // trail
    if (sp > 30) spawnTrail(p);
    for (const t of p.trail) t.life -= dt;
    p.trail = p.trail.filter(t => t.life > 0);

    // pulses
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

  // particles
  for (const p of game.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
    p.life -= dt;
  }
  game.particles = game.particles.filter(p => p.life > 0);

  // check end conditions
  const survivors = game.players.filter(p => !p.infected);
  if (survivors.length === 0) {
    endGame(game, "infected");
  } else if (game.elapsed >= game.duration) {
    endGame(game, "survivors");
  }
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

function drawArenaBackground(ctx, t) {
  // dark base
  ctx.fillStyle = "#070810";
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  // grid
  ctx.strokeStyle = "rgba(168, 85, 247, 0.18)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= ARENA_W; x += TILE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ARENA_H);
    ctx.stroke();
  }
  for (let y = 0; y <= ARENA_H; y += TILE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ARENA_W, y);
    ctx.stroke();
  }

  // bigger glowing accent grid
  ctx.strokeStyle = "rgba(168, 85, 247, 0.35)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= ARENA_W; x += TILE * 5) {
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); ctx.stroke();
  }
  for (let y = 0; y <= ARENA_H; y += TILE * 5) {
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(ARENA_W, y); ctx.stroke();
  }

  // central biohazard mark (faint)
  ctx.save();
  ctx.translate(ARENA_W / 2, ARENA_H / 2);
  ctx.globalAlpha = 0.07 + Math.sin(t * 1.5) * 0.02;
  ctx.fillStyle = "#a855f7";
  ctx.beginPath();
  ctx.arc(0, 0, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#22ff88";
  ctx.font = "bold 200px Bungee, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("☣", 0, 12);
  ctx.restore();

  // outer border glow
  ctx.strokeStyle = "rgba(34, 255, 136, 0.5)";
  ctx.lineWidth = 4;
  ctx.shadowColor = "#22ff88";
  ctx.shadowBlur = 18;
  ctx.strokeRect(2, 2, ARENA_W - 4, ARENA_H - 4);
  ctx.shadowBlur = 0;
}

function drawWalls(ctx) {
  for (const w of WALLS) {
    ctx.save();
    ctx.shadowColor = w.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = "rgba(20, 22, 38, 0.95)";
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = w.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
    ctx.restore();
  }
}

function drawPlayer(ctx, p, sprites, isLocal) {
  // trail
  for (let i = 0; i < p.trail.length; i++) {
    const t = p.trail[i];
    const alpha = (t.life / 0.35) * 0.35;
    ctx.fillStyle = p.infected
      ? `rgba(255, 51, 85, ${alpha})`
      : `rgba(34, 255, 136, ${alpha})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, PLAYER_RADIUS * 0.65, 0, Math.PI * 2);
    ctx.fill();
  }

  // pulses
  for (const pu of p.pulses) {
    ctx.strokeStyle = `rgba(255, 51, 85, ${pu.life / 0.7})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pu.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // glow under feet
  const grad = ctx.createRadialGradient(p.x, p.y, 5, p.x, p.y, PLAYER_RADIUS * 2.6);
  if (p.infected) {
    grad.addColorStop(0, "rgba(255, 51, 85, 0.7)");
    grad.addColorStop(1, "rgba(255, 51, 85, 0)");
  } else {
    grad.addColorStop(0, "rgba(34, 255, 136, 0.7)");
    grad.addColorStop(1, "rgba(34, 255, 136, 0)");
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_RADIUS * 2.6, 0, Math.PI * 2);
  ctx.fill();

  // sprite
  const img = p.infected ? sprites.infected : sprites.survivor;
  const size = PLAYER_RADIUS * 2.4;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.facing, 1);
  if (img) {
    ctx.drawImage(img, -size / 2, -size / 2 - 4, size, size);
  } else {
    // fallback circle
    ctx.fillStyle = p.infected ? "#ff3355" : "#22ff88";
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // player label
  ctx.font = "bold 14px Rajdhani, sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  const label = (isLocal ? "● " : "") + p.name + (p.infected ? " ☣" : "");
  ctx.strokeText(label, p.x, p.y - PLAYER_RADIUS - 14);
  ctx.fillStyle = isLocal
    ? "#ffd24a"
    : (p.infected ? "#ff6680" : "#5cffae");
  ctx.fillText(label, p.x, p.y - PLAYER_RADIUS - 14);
}

function drawParticles(ctx, game) {
  for (const p of game.particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.fillStyle = `rgba(255, 51, 85, ${a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function render(canvas, game, sprites, t) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;

  // compute scale: fit ARENA into canvas
  const scale = Math.min(w / ARENA_W, h / ARENA_H);
  const offX = (w - ARENA_W * scale) / 2;
  const offY = (h - ARENA_H * scale) / 2;

  ctx.save();
  ctx.fillStyle = "#040509";
  ctx.fillRect(0, 0, w, h);

  ctx.translate(offX, offY);
  ctx.scale(scale, scale);

  drawArenaBackground(ctx, t);
  drawWalls(ctx);
  // particles behind players
  drawParticles(ctx, game);

  // draw players: survivors first, then infected on top for clarity
  const survivors = game.players.filter(p => !p.infected);
  const infected = game.players.filter(p => p.infected);
  for (const p of survivors) drawPlayer(ctx, p, sprites, p.id === "you");
  for (const p of infected) drawPlayer(ctx, p, sprites, p.id === "you");

  // infection flash overlay
  if (game.infectionFlash > 0) {
    ctx.fillStyle = `rgba(255, 51, 85, ${game.infectionFlash * 0.18})`;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }

  ctx.restore();

  return { scale, offX, offY };
}

export const GAME_CONST = { ARENA_W, ARENA_H, PLAYER_RADIUS };
