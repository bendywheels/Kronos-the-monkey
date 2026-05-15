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

export default function GameScreen({ config, onExit }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const spritesRef = useRef({ survivor: null, infected: null });
  const inputRef = useRef({ w: false, a: false, s: false, d: false });
  const [, setTick] = useState(0); // force re-render for HUD
  const [, setMutedState] = useState(isMuted());
  const submittedRef = useRef(false);

  // create game once
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

    loadAllSprites().then((s) => {
      spritesRef.current = s;
    });

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

    const resize = () => {
      const c = canvasRef.current;
      if (!c) return;
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = (now) => {
      if (!mounted) return;
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      const g = gameRef.current;
      const ax = (inputRef.current.d ? 1 : 0) - (inputRef.current.a ? 1 : 0);
      const ay = (inputRef.current.s ? 1 : 0) - (inputRef.current.w ? 1 : 0);
      setPlayerInput(g, ax, ay);

      update(g, dt);

      const canvas = canvasRef.current;
      if (canvas) render(canvas, g, spritesRef.current, now / 1000);

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

  const handleExit = () => {
    sfxClick();
    onExit();
  };

  return (
    <div className="relative w-full h-screen bg-[#04050a] overflow-hidden" data-testid="game-screen">
      <canvas ref={canvasRef} data-testid="game-canvas" className="absolute inset-0" />
      {game && (
        <>
          <HUD
            game={game}
            arenaW={GAME_CONST.ARENA_W}
            arenaH={GAME_CONST.ARENA_H}
            onExit={handleExit}
            muted={isMuted()}
            onToggleMute={handleToggleMute}
          />
          {game.status === "ended" && (
            <EndOverlay
              result={game.result}
              onPlayAgain={() => { sfxClick(); onExit(); }}
            />
          )}
          {game.status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center" data-testid="countdown-overlay">
                <div className="text-2xl font-terminal ink-text-purple mb-2">// INFECTION INCOMING</div>
                <div
                  className="font-splat ink-title-toxic ink-glitch"
                  style={{ fontSize: "180px", lineHeight: 1 }}
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
