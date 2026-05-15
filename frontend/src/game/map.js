// Arena map definition: walls/obstacles laid out in a neon skatepark grid.
// Coords in world units (px). Arena: 1600 x 960.

export const ARENA_W = 1600;
export const ARENA_H = 960;
export const TILE = 40;

// Each wall is an AABB: { x, y, w, h, color }
export const WALLS = [
  // outer borders (already drawn by engine, no need)
  // central biohazard pit
  { x: 720, y: 420, w: 160, h: 120, color: "#a855f7" },

  // half-pipes (rectangles representing ramp blocks)
  { x: 120, y: 120, w: 220, h: 40, color: "#22ff88" },
  { x: 120, y: 120, w: 40, h: 180, color: "#22ff88" },

  { x: 1260, y: 120, w: 220, h: 40, color: "#22ff88" },
  { x: 1440, y: 120, w: 40, h: 180, color: "#22ff88" },

  { x: 120, y: 800, w: 220, h: 40, color: "#22ff88" },
  { x: 120, y: 660, w: 40, h: 180, color: "#22ff88" },

  { x: 1260, y: 800, w: 220, h: 40, color: "#22ff88" },
  { x: 1440, y: 660, w: 40, h: 180, color: "#22ff88" },

  // mid pillars
  { x: 500, y: 240, w: 60, h: 60, color: "#ff3355" },
  { x: 1040, y: 240, w: 60, h: 60, color: "#ff3355" },
  { x: 500, y: 660, w: 60, h: 60, color: "#ff3355" },
  { x: 1040, y: 660, w: 60, h: 60, color: "#ff3355" },

  // long benches
  { x: 360, y: 460, w: 200, h: 30, color: "#a855f7" },
  { x: 1040, y: 460, w: 200, h: 30, color: "#a855f7" },

  // top/bottom mid blocks
  { x: 740, y: 80,  w: 120, h: 40, color: "#22ff88" },
  { x: 740, y: 840, w: 120, h: 40, color: "#22ff88" },
];

// Spawn points spread around the arena
export const SPAWNS = [
  { x: 80, y: 80 },
  { x: ARENA_W - 80, y: 80 },
  { x: 80, y: ARENA_H - 80 },
  { x: ARENA_W - 80, y: ARENA_H - 80 },
  { x: ARENA_W / 2, y: 60 },
  { x: ARENA_W / 2, y: ARENA_H - 60 },
  { x: 60, y: ARENA_H / 2 },
  { x: ARENA_W - 60, y: ARENA_H / 2 },
  { x: 300, y: 300 },
  { x: ARENA_W - 300, y: ARENA_H - 300 },
];
