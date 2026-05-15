import React from "react";
import { Volume2, VolumeX, LogOut, Skull, Shield } from "lucide-react";

function fmtTime(s) {
  const total = Math.max(0, Math.ceil(s));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function HUD({ game, arenaW, arenaH, onExit, muted, onToggleMute }) {
  const survivors = game.players.filter(p => !p.infected && p.alive);
  const infected = game.players.filter(p => p.infected && p.alive);
  const remaining = Math.max(0, game.duration - game.elapsed);
  const you = game.players.find(p => p.id === "you");

  return (
    <>
      {/* TOP BAR */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-start justify-between px-6 py-4 pointer-events-none">
        {/* left: title + status */}
        <div className="pointer-events-auto">
          <div className="font-display text-xl neon-text-purple tracking-widest" data-testid="hud-title">
            KRONOS // ARENA
          </div>
          <div className="text-xs font-mono-ui text-[#6b6f85] mt-1">
            map::SKATEPARK_OMEGA · node//07
          </div>
        </div>

        {/* center: timer + counts */}
        <div className="flex items-center gap-6 pointer-events-auto">
          <div className="kron-panel px-5 py-3 text-center min-w-[120px]" data-testid="hud-timer">
            <div className="text-[10px] font-mono-ui text-[#6b6f85] tracking-widest">TIMER</div>
            <div
              className={`text-3xl font-display ${remaining < 15 ? "neon-text-red kron-pulse" : "neon-text-green"}`}
              data-testid="hud-timer-value"
            >
              {fmtTime(remaining)}
            </div>
          </div>

          <div className="kron-panel px-4 py-3 flex gap-5">
            <div className="text-center" data-testid="hud-survivors">
              <div className="flex items-center gap-1 text-[10px] font-mono-ui text-[#6b6f85] tracking-widest">
                <Shield size={10} className="text-[#22ff88]" /> SURVIVORS
              </div>
              <div className="text-2xl font-display neon-text-green">{survivors.length}</div>
            </div>
            <div className="text-center" data-testid="hud-infected">
              <div className="flex items-center gap-1 text-[10px] font-mono-ui text-[#6b6f85] tracking-widest">
                <Skull size={10} className="text-[#ff3355]" /> INFECTED
              </div>
              <div className="text-2xl font-display neon-text-red">{infected.length}</div>
            </div>
          </div>
        </div>

        {/* right: controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            data-testid="mute-toggle-btn"
            onClick={onToggleMute}
            className="kron-panel p-2 hover:bg-[#a855f7]/10 transition-colors"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted
              ? <VolumeX size={18} className="text-[#9fa3bd]" />
              : <Volume2 size={18} className="text-[#22ff88]" />}
          </button>
          <button
            data-testid="exit-btn"
            onClick={onExit}
            className="kron-panel p-2 hover:bg-[#ff3355]/10 transition-colors"
            title="Exit to lobby"
          >
            <LogOut size={18} className="text-[#ff6680]" />
          </button>
        </div>
      </div>

      {/* OBJECTIVE BANNER */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div
          className="kron-panel px-5 py-2 text-sm font-mono-ui tracking-widest"
          data-testid="hud-objective"
        >
          {you?.infected ? (
            <span className="neon-text-red">&gt; OBJECTIVE: INFECT ALL SURVIVORS</span>
          ) : (
            <span className="neon-text-green">&gt; OBJECTIVE: SURVIVE THE INFECTION</span>
          )}
        </div>
      </div>

      {/* LEFT LEGEND */}
      <div className="absolute top-1/2 left-6 -translate-y-1/2 z-10 pointer-events-none">
        <div className="kron-panel p-3 space-y-2">
          <div className="text-[10px] font-mono-ui text-[#6b6f85] tracking-widest mb-1">[ LEGEND ]</div>
          <div className="flex items-center gap-2 text-xs font-mono-ui">
            <span className="w-3 h-3 rounded-full bg-[#22ff88] shadow-[0_0_10px_#22ff88]" />
            <span className="neon-text-green">SURVIVOR</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono-ui">
            <span className="w-3 h-3 rounded-full bg-[#ff3355] shadow-[0_0_10px_#ff3355]" />
            <span className="neon-text-red">INFECTED</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono-ui">
            <span className="w-3 h-3 rounded-full bg-[#ffd24a] shadow-[0_0_10px_#ffd24a]" />
            <span style={{ color: "#ffd24a" }}>YOU</span>
          </div>
        </div>
      </div>

      {/* CONTROLS HINT */}
      <div className="absolute bottom-6 left-6 z-10 pointer-events-none">
        <div className="kron-panel px-4 py-3 font-mono-ui text-xs">
          <div className="text-[10px] text-[#6b6f85] tracking-widest mb-2">[ CONTROLS ]</div>
          <div className="grid grid-cols-3 gap-1 w-[110px]">
            <div></div>
            <div className="border border-[#a855f7]/60 text-center py-1 neon-text-purple">W</div>
            <div></div>
            <div className="border border-[#a855f7]/60 text-center py-1 neon-text-purple">A</div>
            <div className="border border-[#a855f7]/60 text-center py-1 neon-text-purple">S</div>
            <div className="border border-[#a855f7]/60 text-center py-1 neon-text-purple">D</div>
          </div>
        </div>
      </div>

      {/* MINIMAP */}
      <Minimap game={game} arenaW={arenaW} arenaH={arenaH} />
    </>
  );
}

function Minimap({ game, arenaW, arenaH }) {
  const W = 180;
  const H = Math.round(W * (arenaH / arenaW));
  return (
    <div className="absolute bottom-6 right-6 z-10 pointer-events-none" data-testid="hud-minimap">
      <div className="kron-panel p-2">
        <div className="text-[10px] font-mono-ui text-[#6b6f85] tracking-widest mb-1 px-1">[ MAP ]</div>
        <div
          className="relative bg-[#070810] overflow-hidden"
          style={{ width: W, height: H, border: "1px solid rgba(168,85,247,0.4)" }}
        >
          {/* grid lines */}
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
            const color = isYou
              ? "#ffd24a"
              : (p.infected ? "#ff3355" : "#22ff88");
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
