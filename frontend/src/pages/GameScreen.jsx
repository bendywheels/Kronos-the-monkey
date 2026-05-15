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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const JOY_RADIUS = 60;

export default function GameScreen({ config, onExit }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const spritesRef = useRef({ survivor: null, infected: null });
  const inputRef = useRef({ w: false, a: false, s: false, d: false });

  // Input state refs
  const mouseHoldRef = useRef(false);
  const mouseWorldRef = useRef({ x: 0, y: 0, active: false });
  const joystickRef = useRef({ active: false, baseX: 0, baseY: 0, dx: 0, dy: 0, pointerId: null });
  const transformRef = useRef(null);

  const [joyTick, setJoyTick] = useState(0); // re-render when joystick visual changes
  const [, setTick] = useState(0);
  const [, setMutedState] = useState(isMuted());
  const submittedRef = useRef(false);

  useEffect(() => {
    initAudio();
    startMusic();
    sfxRoundStart();

    const game = createGame({
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
          survived: result.youSurvived,
          won: result.youWon,
          role: result.role,
          survived_seconds: result.survivedSeconds,
          bots_count: config.botCount,
          survivors_left: result.survivorsLeft,
        }).catch(() => {});
      }
    };
    gameRef.current = game;

    let rafId = 0;
    let lastT = performance.now();
    let mounted = true;

    loadAllSprites().then((s) => { spritesRef.current = s; });

    // ===== keyboard =====
    const onKey = (e, down) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(k)) {
        inputRef.current[k] = down;
        e.preventDefault();
      } else if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        const map = { arrowup: "w", arrowdown: "s", arrowleft: "a", arrowright: "d" };
        inputRef.current[map[k]] = down;
        e.preventDefault();
      }
    };
    const kd = (e) => onKey(e, true);
    const ku = (e) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    // ===== pointer events (unifies mouse + touch) =====
    const updateMouseWorld = (clientX, clientY) => {
      const canvas = canvasRef.current;
      const tr = transformRef.current;
      if (!canvas || !tr) return;
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left - tr.offX) / tr.scale;
      const y = (clientY - rect.top - tr.offY) / tr.scale;
      mouseWorldRef.current = { x, y, active: true };
    };

    const isOnJoystick = (clientX, clientY) => {
      // joystick zone: bottom-left quarter of the screen
      return clientX < window.innerWidth * 0.45 && clientY > window.innerHeight * 0.55;
    };

    const onPointerDown = (e) => {
      // ignore if event originated from a HUD button
      if (e.target.closest("[data-no-game-input]")) return;
      const isTouch = e.pointerType === "touch";
      if (isTouch && isOnJoystick(e.clientX, e.clientY)) {
        joystickRef.current = {
          active: true,
          baseX: e.clientX,
          baseY: e.clientY,
          dx: 0, dy: 0,
          pointerId: e.pointerId,
        };
        setJoyTick(t => t + 1);
      } else {
        mouseHoldRef.current = true;
        updateMouseWorld(e.clientX, e.clientY);
      }
      e.preventDefault();
    };
    const onPointerMove = (e) => {
      const j = joystickRef.current;
      if (j.active && j.pointerId === e.pointerId) {
        j.dx = e.clientX - j.baseX;
        j.dy = e.clientY - j.baseY;
        const len = Math.hypot(j.dx, j.dy);
        if (len > JOY_RADIUS) {
          j.dx = (j.dx / len) * JOY_RADIUS;
          j.dy = (j.dy / len) * JOY_RADIUS;
        }
        setJoyTick(t => t + 1);
      } else if (e.pointerType !== "touch") {
        updateMouseWorld(e.clientX, e.clientY);
      } else if (mouseHoldRef.current) {
        updateMouseWorld(e.clientX, e.clientY);
      }
    };
    const onPointerUp = (e) => {
      const j = joystickRef.current;
      if (j.active && (j.pointerId === e.pointerId || e.pointerId == null)) {
        joystickRef.current = { active: false, baseX: 0, baseY: 0, dx: 0, dy: 0, pointerId: null };
        setJoyTick(t => t + 1);
      }
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
      // Determine input priority: joystick > mouse hold > WASD
      let ax = 0, ay = 0;
      const j = joystickRef.current;
      if (j.active) {
        const len = Math.hypot(j.dx, j.dy);
        if (len > 8) {
          const norm = Math.min(len / JOY_RADIUS, 1);
          ax = (j.dx / len) * norm;
          ay = (j.dy / len) * norm;
        }
      } else if (mouseHoldRef.current && mouseWorldRef.current.active) {
        const you = g.players.find(p => p.id === "you");
        if (you) {
          const dx = mouseWorldRef.current.x - you.x;
          const dy = mouseWorldRef.current.y - you.y;
          const d = Math.hypot(dx, dy);
          if (d > 12) {
            const norm = Math.min(d / 80, 1);
            ax = (dx / d) * norm;
            ay = (dy / d) * norm;
          }
        }
      } else {
        ax = (inputRef.current.d ? 1 : 0) - (inputRef.current.a ? 1 : 0);
        ay = (inputRef.current.s ? 1 : 0) - (inputRef.current.w ? 1 : 0);
      }
      setPlayerInput(g, ax, ay);

      update(g, dt);

      const c = canvasRef.current;
      if (c) {
        const transform = render(c, g, spritesRef.current, now / 1000);
        transformRef.current = transform;
      }

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
      stopMusic();
    };
  }, [config]);

  const game = gameRef.current;

  const handleToggleMute = () => {
    const m = !isMuted();
    setMuted(m);
    setMutedState(m);
    sfxClick();
  };

  const handleExit = () => { sfxClick(); onExit(); };

  const handleFullscreen = () => {
    sfxClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <div
      className="relative w-full h-screen bg-[#04050a] overflow-hidden"
      data-testid="game-screen"
      style={{ touchAction: "none", userSelect: "none" }}
    >
      <canvas
        ref={canvasRef}
        data-testid="game-canvas"
        className="absolute inset-0"
        style={{ touchAction: "none" }}
      />
      {game && (
        <>
          <HUD
            game={game}
            arenaW={GAME_CONST.ARENA_W}
            arenaH={GAME_CONST.ARENA_H}
            onExit={handleExit}
            muted={isMuted()}
            onToggleMute={handleToggleMute}
            onFullscreen={handleFullscreen}
          />

          {/* virtual joystick visual */}
          {joystickRef.current.active && (
            <Joystick
              baseX={joystickRef.current.baseX}
              baseY={joystickRef.current.baseY}
              dx={joystickRef.current.dx}
              dy={joystickRef.current.dy}
              tick={joyTick}
            />
          )}

          {/* mouse target indicator */}
          {mouseHoldRef.current && mouseWorldRef.current.active && transformRef.current && (
            <MouseTarget
              wx={mouseWorldRef.current.x}
              wy={mouseWorldRef.current.y}
              transform={transformRef.current}
              tick={joyTick}
            />
          )}

          {game.status === "ended" && (
            <EndOverlay
              result={game.result}
              onPlayAgain={() => { sfxClick(); onExit(); }}
            />
          )}
          {game.status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center" data-testid="countdown-overlay">
                <div className="text-lg md:text-2xl font-terminal ink-text-purple mb-2">// INFECTION INCOMING</div>
                <div
                  className="font-splat ink-title-toxic ink-glitch leading-none"
                  style={{ fontSize: "clamp(90px, 22vw, 180px)" }}
                  data-testid="countdown-number"
                >
                  {Math.ceil(game.countdown)}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Joystick({ baseX, baseY, dx, dy }) {
  return (
    <div
      className="pointer-events-none"
      style={{
        position: "absolute",
        left: baseX - 70,
        top: baseY - 70,
        width: 140,
        height: 140,
        zIndex: 50,
      }}
      data-testid="virtual-joystick"
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "rgba(20, 16, 28, 0.55)",
          border: "2px solid rgba(168, 85, 247, 0.7)",
          boxShadow: "0 0 24px rgba(168,85,247,0.5), inset 0 0 24px rgba(168,85,247,0.2)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 70 + dx - 28,
          top: 70 + dy - 28,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 30% 30%, #c084fc, #6b21a8 70%)",
          border: "2px solid rgba(253, 230, 138, 0.9)",
          boxShadow: "0 0 18px rgba(168,85,247,0.8)",
        }}
      />
    </div>
  );
}

function MouseTarget({ wx, wy, transform }) {
  const x = wx * transform.scale + transform.offX;
  const y = wy * transform.scale + transform.offY;
  return (
    <div
      className="pointer-events-none"
      style={{
        position: "absolute",
        left: x - 18,
        top: y - 18,
        width: 36,
        height: 36,
        zIndex: 30,
      }}
    >
      <div
        style={{
          width: "100%", height: "100%",
          borderRadius: "50%",
          border: "2px dashed rgba(251, 191, 36, 0.85)",
          boxShadow: "0 0 14px rgba(251,191,36,0.45)",
          animation: "ink-pulse 1.2s ease-in-out infinite",
        }}
      />
    </div>
  );
}
