import React from "react";
import { Volume2, VolumeX, LogOut, Skull, Shield, Maximize2 } from "lucide-react";

function fmtTime(s) {
  const total = Math.max(0, Math.ceil(s));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function HUD({ game, arenaW, arenaH, onExit, muted, onToggleMute, onFullscreen }) {
  const survivors = game.players.filter(p => !p.infected && p.alive);
  const infected = game.players.filter(p => p.infected && p.alive);
  const remaining = Math.max(0, game.duration - game.elapsed);
  const you = game.players.find(p => p.id === "you");

  return (
    <>
      <div className="hazard-tape h-1.5 w-full absolute top-0 left-0 z-10 opacity-80" />
      <div className="hazard-tape h-1.5 w-full absolute bottom-0 left-0 z-10 opacity-60" />

      {/* TOP BAR */}
      <div
        className="absolute top-3 left-0 right-0 z-10 flex items-start justify-between px-3 sm:px-6 py-2 sm:py-4 pointer-events-none gap-2"
        data-no-game-input
      >
        <div className="pointer-events-auto hidden sm:block">
          <div className="font-marker text-lg sm:text-2xl ink-text-gold tracking-wider" data-testid="hud-title">
            KRONOS <span className="font-splat ink-text-purple text-sm sm:text-xl">INK PARK</span>
          </div>
          <div className="text-[10px] sm:text-xs font-terminal text-[#6b5d7a] mt-1">
            map::INK_PARK_ALPHA · outbreak//07
          </div>
        </div>

        {/* center: timer + counts */}
        <div className="flex items-center gap-2 sm:gap-6 pointer-events-auto mx-auto sm:mx-0">
          <div className="ink-panel px-3 sm:px-5 py-2 sm:py-3 text-center min-w-[88px] sm:min-w-[120px]" data-testid="hud-timer">
            <div className="text-[9px] sm:text-[10px] font-terminal text-[#6b5d7a] tracking-widest">TIMER</div>
            <div
              className={`text-xl sm:text-3xl font-marker ${remaining < 15 ? "ink-text-blood ink-pulse" : "ink-text-toxic"}`}
              data-testid="hud-timer-value"
            >
              {fmtTime(remaining)}
            </div>
          </div>

          <div className="ink-panel px-2 sm:px-4 py-2 sm:py-3 flex gap-3 sm:gap-5">
            <div className="text-center" data-testid="hud-survivors">
              <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-terminal text-[#6b5d7a] tracking-widest">
                <Shield size={10} className="text-[#fbbf24]" /> SKATERS
              </div>
              <div className="text-lg sm:text-2xl font-marker ink-text-gold">{survivors.length}</div>
            </div>
            <div className="text-center" data-testid="hud-infected">
              <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-terminal text-[#6b5d7a] tracking-widest">
                <Skull size={10} className="text-[#a855f7]" /> INFECTED
              </div>
              <div className="text-lg sm:text-2xl font-marker ink-text-purple">{infected.length}</div>
            </div>
          </div>
        </div>

        {/* right controls */}
        <div className="flex items-center gap-1 sm:gap-2 pointer-events-auto">
          <button
            data-testid="fullscreen-btn"
            data-no-game-input
            onClick={onFullscreen}
            className="ink-panel p-2 hover:bg-[#a855f7]/10 transition-colors hidden sm:inline-flex"
            title="Fullscreen"
          >
            <Maximize2 size={18} className="text-[#c084fc]" />
          </button>
          <button
            data-testid="mute-toggle-btn"
            data-no-game-input
            onClick={onToggleMute}
            className="ink-panel p-2 hover:bg-[#a855f7]/10 transition-colors"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted
              ? <VolumeX size={18} className="text-[#9fa3bd]" />
              : <Volume2 size={18} className="text-[#84cc16]" />}
          </button>
          <button
            data-testid="exit-btn"
            data-no-game-input
            onClick={onExit}
            className="ink-panel p-2 hover:bg-[#ec4899]/10 transition-colors"
            title="Exit"
          >
            <LogOut size={18} className="text-[#f472b6]" />
          </button>
        </div>
      </div>

      {/* OBJECTIVE BANNER */}
      <div className="absolute top-[78px] sm:top-24 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div
          className="ink-panel px-3 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-marker tracking-widest whitespace-nowrap"
          data-testid="hud-objective"
        >
          {you?.infected ? (
            <span className="ink-text-purple">&gt; INFECT ALL SKATERS</span>
          ) : (
            <span className="ink-text-gold">&gt; ESCAPE THE INFECTION</span>
          )}
        </div>
      </div>

      {/* LEGEND - hidden on mobile (screen too small) */}
      <div className="absolute top-1/2 left-3 -translate-y-1/2 z-10 pointer-events-none hidden md:block">
        <div className="ink-panel p-3 space-y-2">
          <div className="text-[10px] font-terminal text-[#6b5d7a] tracking-widest mb-1">[ LEGEND ]</div>
          <div className="flex items-center gap-2 text-xs font-marker">
            <span className="w-3 h-3 rounded-full bg-[#fbbf24] shadow-[0_0_10px_#fbbf24]" />
            <span className="ink-text-gold">SKATER</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-marker">
            <span className="w-3 h-3 rounded-full bg-[#a855f7] shadow-[0_0_10px_#a855f7]" />
            <span className="ink-text-purple">INFECTED</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-marker">
            <span className="w-3 h-3 rounded-full bg-[#fde68a] shadow-[0_0_10px_#fde68a]" />
            <span className="ink-text-gold">YOU</span>
          </div>
        </div>
      </div>

      {/* CONTROLS hint - hidden on mobile (joystick is enough) */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none hidden lg:block">
        <div className="ink-panel px-4 py-3 font-terminal text-xs">
          <div className="text-[10px] text-[#6b5d7a] tracking-widest mb-2">[ CONTROLS ]</div>
          <div className="grid grid-cols-3 gap-1 w-[110px]">
            <div></div>
            <div className="border border-[#a855f7]/60 text-center py-1 ink-text-purple">W</div>
            <div></div>
            <div className="border border-[#a855f7]/60 text-center py-1 ink-text-purple">A</div>
            <div className="border border-[#a855f7]/60 text-center py-1 ink-text-purple">S</div>
            <div className="border border-[#a855f7]/60 text-center py-1 ink-text-purple">D</div>
          </div>
          <div className="text-[9px] text-[#6b5d7a] mt-2 tracking-wider">+ HOLD MOUSE</div>
        </div>
      </div>

      <Minimap game={game} arenaW={arenaW} arenaH={arenaH} />
    </>
  );
}

function Minimap({ game, arenaW, arenaH }) {
  // smaller minimap on mobile
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const W = isMobile ? 110 : 180;
  const H = Math.round(W * (arenaH / arenaW));
  return (
    <div className="absolute bottom-4 right-3 sm:right-6 z-10 pointer-events-none" data-testid="hud-minimap">
      <div className="ink-panel p-2">
        <div className="text-[9px] sm:text-[10px] font-terminal text-[#6b5d7a] tracking-widest mb-1 px-1">[ MAP ]</div>
        <div
          className="relative overflow-hidden"
          style={{
            width: W, height: H,
            background: "#100d18",
            border: "1px solid rgba(168,85,247,0.45)",
          }}
        >
          <div className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(168,85,247,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.15) 1px, transparent 1px)",
              backgroundSize: `${W / 5}px ${H / 5}px`,
            }}
          />
          {game.players.filter(p => p.alive).map(p => {
            const x = (p.x / arenaW) * W;
            const y = (p.y / arenaH) * H;
            const isYou = p.id === "you";
            const color = isYou ? "#fde68a" : (p.infected ? "#a855f7" : "#fbbf24");
            return (
              <div
                key={p.id}
                className="absolute rounded-full"
                style={{
                  left: x - (isYou ? 4 : 3),
                  top: y - (isYou ? 4 : 3),
                  width: isYou ? 8 : 6,
                  height: isYou ? 8 : 6,
                  background: color,
                  boxShadow: `0 0 8px ${color}`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
