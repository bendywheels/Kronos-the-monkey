import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  createGame, update, render, setPlayerInput, GAME_CONST,
} from "../game/engine";
import { loadAllSprites } from "../game/sprites";
import {
  initAudio, startMusic, stopMusic, sfxInfection, sfxRoundStart,
  sfxClick, sfxWin, sfxLose, setMuted, isMuted,
} from "../game/audio";
import HUD from "../components/HUD";
import EndOverlay from "../components/EndOverlay";
import { getSocket } from "../multiplayer/socket";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function GameScreen({ mode = "single", config, session, onExit }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const spritesRef = useRef({ survivor: null, infected: null });
  const inputRef = useRef({ w: false, a: false, s: false, d: false });
  const mouseHoldRef = useRef(false);
  const mouseWorldRef = useRef({ x: 0, y: 0, active: false });
  const transformRef = useRef(null);

  const [, setTick] = useState(0);
  const [, setMutedState] = useState(isMuted());
  const submittedRef = useRef(false);
  const lastInputRef = useRef({ ax: 0, ay: 0, sentAt: 0 });

  // Auto-request fullscreen on small touch devices (uses last user gesture before mount)
  useEffect(() => {
    const isTouch = "ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0;
    const isNarrow = window.innerWidth < 900;
    if (isTouch && isNarrow && document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    initAudio();
    startMusic();
    sfxRoundStart();

    // ===== Build initial game state =====
    let game;
    if (mode === "single") {
      game = createGame({
        nickname: config.nickname,
        botCount: config.botCount,
        durationSec: 90,
      });
      game._onInfection = () => sfxInfection();
      game._onEnd = (result) => {
        if (result.youWon) sfxWin(); else sfxLose();
        if (!submittedRef.current) {
          submittedRef.current = true;
          axios.post(`${API}/rounds`, {
            nickname: config.nickname,
            survived: result.youSurvived, won: result.youWon, role: result.role,
            survived_seconds: result.survivedSeconds, bots_count: config.botCount,
            survivors_left: result.survivorsLeft, mode: "single",
          }).catch(() => {});
        }
      };
      game._localId = "you";
    } else {
      // ONLINE mode: lightweight skeleton, will be replaced by server state
      game = {
        players: [],
        duration: 90, elapsed: 0,
        status: "starting", countdown: 3.0,
        result: null, particles: [],
        infectionFlash: 0, playerInput: { ax: 0, ay: 0 },
        youInitiallyInfected: false,
        _bgCanvas: null,
        _localId: session?.selfId || "",
      };
    }
    gameRef.current = game;

    let rafId = 0;
    let lastT = performance.now();
    let mounted = true;

    loadAllSprites().then((s) => { spritesRef.current = s; });

    // ===== Socket setup for online mode =====
    let socket = null;
    if (mode === "online") {
      socket = getSocket();

      const applyServerState = (payload) => {
        if (!gameRef.current) return;
        const g = gameRef.current;
        // map server -> client game shape
        g.players = payload.players.map(p => {
          const prev = g.players.find(x => x.id === p.id);
          return {
            id: p.id,
            name: p.name,
            isBot: p.isBot,
            x: p.x, y: p.y,
            vx: p.vx, vy: p.vy,
            facing: p.facing,
            infected: p.infected,
            alive: p.alive,
            trail: prev ? prev.trail : [],
            pulses: p.pulses || [],
            aiPhase: prev?.aiPhase ?? Math.random() * Math.PI * 2,
            infectedAt: 0,
          };
        });
        g.duration = payload.duration;
        g.elapsed = payload.elapsed;
        g.countdown = payload.countdown;
        g.infectionFlash = payload.infectionFlash;
        g.status = payload.phase === "lobby" ? "starting" :
                   payload.phase === "starting" ? "starting" :
                   payload.phase === "ended" ? "ended" : "playing";

        if (payload.phase === "ended" && payload.result) {
          const you = g.players.find(p => p.id === g._localId);
          const youSurvived = you ? !you.infected : false;
          const youWon = payload.result.winner === "survivors" ? youSurvived : !youSurvived;
          g.result = {
            winner: payload.result.winner,
            survivorsLeft: payload.result.survivorsLeft,
            youSurvived,
            youWon,
            role: youSurvived ? "survivor" : "infected",
            survivedSeconds: payload.result.survivedSeconds,
          };
          if (!submittedRef.current) {
            submittedRef.current = true;
            if (youWon) sfxWin(); else sfxLose();
          }
        }
      };

      const onState = (payload) => applyServerState(payload);
      const onStarting = (payload) => applyServerState(payload);
      const onEnded = (payload) => applyServerState(payload);
      const onInfection = () => sfxInfection();

      socket.on("state", onState);
      socket.on("round_starting", onStarting);
      socket.on("round_ended", onEnded);
      socket.on("infection", onInfection);

      // cleanup
      var cleanupSocket = () => {
        socket.off("state", onState);
        socket.off("round_starting", onStarting);
        socket.off("round_ended", onEnded);
        socket.off("infection", onInfection);
      };
    }

    // ===== Keyboard =====
    const onKey = (e, down) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(k)) { inputRef.current[k] = down; e.preventDefault(); }
      else if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        const map = { arrowup: "w", arrowdown: "s", arrowleft: "a", arrowright: "d" };
        inputRef.current[map[k]] = down; e.preventDefault();
      }
    };
    const kd = (e) => onKey(e, true);
    const ku = (e) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    // ===== Pointer =====
    const updateMouseWorld = (clientX, clientY) => {
      const canvas = canvasRef.current;
      const tr = transformRef.current;
      if (!canvas || !tr) return;
      const rect = canvas.getBoundingClientRect();
      mouseWorldRef.current = {
        x: (clientX - rect.left - tr.offX) / tr.scale,
        y: (clientY - rect.top - tr.offY) / tr.scale,
        active: true,
      };
    };
    const isOnJoystick = (cx, cy) => false;

    const onPointerDown = (e) => {
      if (e.target.closest("[data-no-game-input]")) return;
      // Unified: any pointer (mouse OR touch) hold → move toward that point
      mouseHoldRef.current = true;
      updateMouseWorld(e.clientX, e.clientY);
      e.preventDefault();
    };
    const onPointerMove = (e) => {
      if (mouseHoldRef.current) updateMouseWorld(e.clientX, e.clientY);
      else if (e.pointerType !== "touch") updateMouseWorld(e.clientX, e.clientY);
    };
    const onPointerUp = () => {
      mouseHoldRef.current = false;
    };

    const canvas = canvasRef.current;
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    const resize = () => {
      const c = canvasRef.current;
      if (!c) return;
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    const loop = (now) => {
      if (!mounted) return;
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      const g = gameRef.current;
      // compute input — unified mouse/touch hold + WASD
      let ax = 0, ay = 0;
      if (mouseHoldRef.current && mouseWorldRef.current.active) {
        const you = g.players.find(p => p.id === g._localId);
        if (you) {
          const dx = mouseWorldRef.current.x - you.x;
          const dy = mouseWorldRef.current.y - you.y;
          const d = Math.hypot(dx, dy);
          if (d > 12) {
            const norm = Math.min(d / 80, 1);
            ax = (dx / d) * norm; ay = (dy / d) * norm;
          }
        }
      } else {
        ax = (inputRef.current.d ? 1 : 0) - (inputRef.current.a ? 1 : 0);
        ay = (inputRef.current.s ? 1 : 0) - (inputRef.current.w ? 1 : 0);
      }

      if (mode === "single") {
        setPlayerInput(g, ax, ay);
        update(g, dt);
      } else {
        // online: send input to server at ~30Hz, no local simulation
        const last = lastInputRef.current;
        if (now - last.sentAt > 33 || Math.abs(ax - last.ax) > 0.05 || Math.abs(ay - last.ay) > 0.05) {
          lastInputRef.current = { ax, ay, sentAt: now };
          if (socket) socket.emit("input", { ax, ay });
        }
      }

      const c = canvasRef.current;
      if (c) transformRef.current = render(c, g, spritesRef.current, now / 1000);

      setTick(t => (t + 1) % 1000000);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      const cv = canvasRef.current;
      if (cv) cv.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      if (cleanupSocket) cleanupSocket();
      if (mode === "online" && socket) socket.emit("leave_room");
      stopMusic();
    };
  }, [mode, config, session]);

  const game = gameRef.current;

  const handleToggleMute = () => { setMuted(!isMuted()); setMutedState(isMuted()); sfxClick(); };
  const handleExit = () => { sfxClick(); onExit(); };
  const handleFullscreen = () => {
    sfxClick();
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  };

  return (
    <div className="relative w-full overflow-hidden bg-[#04050a]" data-testid="game-screen"
      style={{
        touchAction: "none",
        userSelect: "none",
        height: "100vh",
        minHeight: "100dvh",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
      <canvas ref={canvasRef} data-testid="game-canvas" className="absolute inset-0" style={{ touchAction: "none" }} />
      {game && (
        <>
          <HUD
            game={game} arenaW={GAME_CONST.ARENA_W} arenaH={GAME_CONST.ARENA_H}
            onExit={handleExit} muted={isMuted()} onToggleMute={handleToggleMute}
            onFullscreen={handleFullscreen}
            roomId={mode === "online" ? session?.roomId : null}
          />
          {mouseHoldRef.current && mouseWorldRef.current.active && transformRef.current && (
            <MouseTarget wx={mouseWorldRef.current.x} wy={mouseWorldRef.current.y} transform={transformRef.current} />
          )}
          {game.status === "ended" && game.result && (
            <EndOverlay result={game.result} onPlayAgain={() => { sfxClick(); onExit(); }} />
          )}
          {game.status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center" data-testid="countdown-overlay">
                <div className="text-lg md:text-2xl font-terminal ink-text-purple mb-2">// INFECTION INCOMING</div>
                <div className="font-splat ink-title-toxic ink-glitch leading-none"
                  style={{ fontSize: "clamp(90px, 22vw, 180px)" }} data-testid="countdown-number">
                  {Math.ceil(game.countdown || 0)}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MouseTarget({ wx, wy, transform }) {
  const x = wx * transform.scale + transform.offX;
  const y = wy * transform.scale + transform.offY;
  return (
    <div className="pointer-events-none" style={{ position: "absolute", left: x - 18, top: y - 18, width: 36, height: 36, zIndex: 30 }}>
      <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "2px dashed rgba(251, 191, 36, 0.85)", boxShadow: "0 0 14px rgba(251,191,36,0.45)", animation: "ink-pulse 1.2s ease-in-out infinite" }} />
    </div>
  );
}
