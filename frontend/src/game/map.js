// INK PARK arena map.
// Each obstacle has: x,y,w,h (AABB collision) + type for visual rendering.
// Types: 'ramp', 'block', 'bowl', 'barrel', 'crate', 'cone', 'fence', 'bench', 'pallet'

export const ARENA_W = 1600;
export const ARENA_H = 960;
export const TILE = 40;

export const WALLS = [
  // === RAMPS / QUARTERS (long benches with painted purple top) ===
  { x: 100, y: 180, w: 280, h: 50, type: "ramp" },
  { x: 1220, y: 180, w: 280, h: 50, type: "ramp" },
  { x: 100, y: 730, w: 280, h: 50, type: "ramp" },
  { x: 1220, y: 730, w: 280, h: 50, type: "ramp" },

  // === CENTRAL BOWL (rim) ===
  { x: 700, y: 410, w: 200, h: 140, type: "bowl" },

  // === CONCRETE BLOCKS ===
  { x: 460, y: 360, w: 70, h: 70, type: "block" },
  { x: 1070, y: 360, w: 70, h: 70, type: "block" },
  { x: 460, y: 530, w: 70, h: 70, type: "block" },
  { x: 1070, y: 530, w: 70, h: 70, type: "block" },

  // === BENCHES ===
  { x: 340, y: 470, w: 140, h: 28, type: "bench" },
  { x: 1120, y: 470, w: 140, h: 28, type: "bench" },

  // === TOXIC BARRELS ===
  { x: 250, y: 420, w: 42, h: 42, type: "barrel" },
  { x: 1308, y: 420, w: 42, h: 42, type: "barrel" },
  { x: 250, y: 540, w: 42, h: 42, type: "barrel" },
  { x: 1308, y: 540, w: 42, h: 42, type: "barrel" },

  // === WOODEN CRATES ===
  { x: 240, y: 80, w: 56, h: 56, type: "crate" },
  { x: 1304, y: 80, w: 56, h: 56, type: "crate" },
  { x: 240, y: 824, w: 56, h: 56, type: "crate" },
  { x: 1304, y: 824, w: 56, h: 56, type: "crate" },

  // === TRAFFIC CONES ===
  { x: 680, y: 220, w: 26, h: 26, type: "cone" },
  { x: 894, y: 220, w: 26, h: 26, type: "cone" },
  { x: 680, y: 714, w: 26, h: 26, type: "cone" },
  { x: 894, y: 714, w: 26, h: 26, type: "cone" },

  // === PALLETS (small platforms) ===
  { x: 760, y: 80, w: 80, h: 36, type: "pallet" },
  { x: 760, y: 844, w: 80, h: 36, type: "pallet" },
];

// Decorative-only items (no collision)
export const DECALS = [
  // graffiti texts on floor (rendered painted/dripped)
  { x: 200, y: 280, text: "SK8 OR DIE", color: "#84cc16", rot: -0.15, size: 28 },
  { x: 1180, y: 280, text: "INFECTED", color: "#c084fc", rot: 0.12, size: 32 },
  { x: 200, y: 660, text: "NO HUMANS", color: "#ec4899", rot: 0.08, size: 24 },
  { x: 1140, y: 660, text: "INK PARK", color: "#a855f7", rot: -0.1, size: 36 },
  { x: 600, y: 150, text: "RIP", color: "#84cc16", rot: -0.4, size: 30 },
  { x: 1000, y: 800, text: "☣", color: "#a855f7", rot: 0, size: 64 },
  // ink puddles (procedural in renderer); these are extra puddles
  { x: 360, y: 580, type: "puddle", r: 38 },
  { x: 1240, y: 360, type: "puddle", r: 44 },
  { x: 800, y: 220, type: "puddle", r: 30 },
  { x: 800, y: 740, type: "puddle", r: 30 },
];

// Spawn points
export const SPAWNS = [
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
