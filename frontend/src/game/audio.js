// Procedural grunge/metal audio using Web Audio API.
// Generates: distorted bass drone + driving drum pattern + ambient noise pad.
// SFX: infection hit, round start, ui click.

let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let started = false;
let musicNodes = [];
let drumInterval = null;
let muted = false;

function makeDistortion(amount = 50) {
  const c = ctx;
  const k = amount;
  const ws = new Float32Array(2048);
  const deg = Math.PI / 180;
  for (let i = 0; i < 2048; i++) {
    const x = (i * 2) / 2048 - 1;
    ws[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  const node = c.createWaveShaper();
  node.curve = ws;
  node.oversample = "4x";
  return node;
}

function ensureCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.35;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.6;
    sfxGain.connect(master);
  }
}

export function initAudio() {
  ensureCtx();
  if (ctx.state === "suspended") ctx.resume();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.8;
}

export function isMuted() { return muted; }

// ===== Music: grunge/metal feel =====
// Bass riff using square wave -> distortion -> low-pass
// Drum pattern: kick (sine drop) on 1 & 3, snare (noise) on 2 & 4, hat (noise hp) 8th

const RIFF = [
  // freq (Hz), duration (s)
  [82.41, 0.25], [82.41, 0.25], [98.0, 0.25], [82.41, 0.25],
  [82.41, 0.25], [110.0, 0.25], [98.0, 0.25], [82.41, 0.25],
];

function playRiff(startAt) {
  const out = musicGain;
  let t = startAt;
  for (const [f, d] of RIFF) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f, t);

    const dist = makeDistortion(80);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1100;
    lp.Q.value = 8;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.7, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.95);

    osc.connect(dist).connect(lp).connect(g).connect(out);
    osc.start(t);
    osc.stop(t + d);
    musicNodes.push(osc);
    t += d;
  }
  return t;
}

function playKick(at) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(120, at);
  osc.frequency.exponentialRampToValueAtTime(40, at + 0.15);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.9, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
  osc.connect(g).connect(musicGain);
  osc.start(at); osc.stop(at + 0.2);
}

function noiseBuffer(d) {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, sr * d, sr);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  return buf;
}

function playSnare(at) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.2);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.6, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
  src.connect(hp).connect(g).connect(musicGain);
  src.start(at); src.stop(at + 0.2);
}

function playHat(at) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.06);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 5000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  src.connect(hp).connect(g).connect(musicGain);
  src.start(at); src.stop(at + 0.06);
}

export function startMusic() {
  ensureCtx();
  if (started) return;
  started = true;

  const bpm = 132;
  const beat = 60 / bpm;
  const bar = beat * 4;

  const scheduleAhead = () => {
    if (!started) return;
    const now = ctx.currentTime;
    // schedule next 4 bars
    let t = now;
    for (let b = 0; b < 4; b++) {
      // bass riff (one bar)
      playRiff(t);

      // drum pattern (one bar = 4 beats)
      for (let q = 0; q < 4; q++) {
        const beatTime = t + q * beat;
        if (q === 0 || q === 2) playKick(beatTime);
        if (q === 1 || q === 3) playSnare(beatTime);
        // hats every 8th
        playHat(beatTime);
        playHat(beatTime + beat / 2);
      }
      t += bar;
    }
  };

  scheduleAhead();
  drumInterval = setInterval(scheduleAhead, 4 * bar * 1000 - 100);
}

export function stopMusic() {
  started = false;
  if (drumInterval) {
    clearInterval(drumInterval);
    drumInterval = null;
  }
  musicNodes.forEach(n => { try { n.stop(); } catch (e) {} });
  musicNodes = [];
}

// ===== SFX =====
export function sfxInfection() {
  ensureCtx();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(660, t);
  osc.frequency.exponentialRampToValueAtTime(110, t + 0.35);
  const dist = makeDistortion(60);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  osc.connect(dist).connect(g).connect(sfxGain);
  osc.start(t); osc.stop(t + 0.45);
}

export function sfxClick() {
  ensureCtx();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(440, t + 0.07);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  osc.connect(g).connect(sfxGain);
  osc.start(t); osc.stop(t + 0.09);
}

export function sfxRoundStart() {
  ensureCtx();
  const t = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = i === 2 ? 880 : 440;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + i * 0.25);
    g.gain.exponentialRampToValueAtTime(0.3, t + i * 0.25 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.25 + 0.18);
    osc.connect(g).connect(sfxGain);
    osc.start(t + i * 0.25); osc.stop(t + i * 0.25 + 0.2);
  }
}

export function sfxWin() {
  ensureCtx();
  const t = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + i * 0.12);
    g.gain.exponentialRampToValueAtTime(0.35, t + i * 0.12 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.3);
    osc.connect(g).connect(sfxGain);
    osc.start(t + i * 0.12); osc.stop(t + i * 0.12 + 0.32);
  });
}

export function sfxLose() {
  ensureCtx();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(55, t + 0.8);
  const dist = makeDistortion(40);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
  osc.connect(dist).connect(g).connect(sfxGain);
  osc.start(t); osc.stop(t + 0.9);
}
