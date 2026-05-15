import React, { useState, useEffect } from "react";
import axios from "axios";
import { sfxClick, initAudio } from "../game/audio";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Lobby({ onStart, initial }) {
  const [nickname, setNickname] = useState(initial?.nickname || "");
  const [botCount, setBotCount] = useState(initial?.botCount ?? 5);
  const [leaderboard, setLeaderboard] = useState([]);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    axios.get(`${API}/leaderboard`).then(r => setLeaderboard(r.data || [])).catch(() => {});
  }, []);

  const handleStart = () => {
    sfxClick();
    const nm = (nickname.trim() || "KRONOS").slice(0, 14).toUpperCase();
    onStart({ nickname: nm, botCount });
  };

  const enableAudio = () => {
    initAudio();
    setAudioReady(true);
    sfxClick();
  };

  return (
    <div className="relative w-full h-screen overflow-hidden biohazard-bg" data-testid="lobby-screen">
      <div className="absolute inset-0 grain pointer-events-none" />
      <div className="absolute inset-0 scan-lines pointer-events-none" />

      {/* top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-5 z-10">
        <div className="flex items-center gap-3">
          <span className="text-2xl neon-text-green font-mono-ui">[ SYS::OK ]</span>
          <span className="text-sm font-mono-ui text-[#6b6f85]">node//arena-07</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-mono-ui text-[#6b6f85]">v1.0 // prototype</span>
          {!audioReady && (
            <button
              data-testid="enable-audio-btn"
              onClick={enableAudio}
              className="px-3 py-1 text-xs font-mono-ui text-[#22ff88] border border-[#22ff88]/50 rounded-sm hover:bg-[#22ff88]/10"
            >
              ENABLE AUDIO
            </button>
          )}
        </div>
      </div>

      <div className="absolute inset-0 flex">
        {/* LEFT — branding */}
        <div className="flex-1 flex flex-col justify-center pl-16 pr-8 relative">
          <div className="text-[#6b6f85] font-mono-ui text-lg mb-2 kron-blink-cursor">
            // initializing arena
          </div>
          <h1
            className="font-display neon-text-purple kron-glitch leading-none"
            style={{ fontSize: "clamp(48px, 8vw, 128px)" }}
            data-testid="title-kronos"
          >
            KRONOS
          </h1>
          <h1
            className="font-display neon-text-green leading-none -mt-2"
            style={{ fontSize: "clamp(48px, 8vw, 128px)" }}
            data-testid="title-arena"
          >
            ARENA
          </h1>
          <p className="mt-6 text-lg text-[#9fa3bd] max-w-lg font-mono-ui">
            &gt; survive the infection inside a neon skatepark arena.<br />
            &gt; one of you is patient zero. last skater alive wins.
          </p>

          <div className="mt-8 flex items-center gap-6 text-base">
            <div className="flex items-center gap-2" data-testid="legend-survivor">
              <span className="inline-block w-3 h-3 rounded-full bg-[#22ff88] shadow-[0_0_12px_#22ff88]" />
              <span className="neon-text-green font-mono-ui">SURVIVOR</span>
            </div>
            <div className="flex items-center gap-2" data-testid="legend-infected">
              <span className="inline-block w-3 h-3 rounded-full bg-[#ff3355] shadow-[0_0_12px_#ff3355]" />
              <span className="neon-text-red font-mono-ui">INFECTED</span>
            </div>
          </div>
        </div>

        {/* RIGHT — control panel */}
        <div className="w-[440px] flex items-center justify-center pr-12">
          <div className="kron-panel p-7 w-full relative">
            <div className="absolute -top-3 left-5 px-2 bg-[#07080d] text-xs font-mono-ui neon-text-purple">
              [ LOBBY::ENTRY ]
            </div>

            <label className="block text-sm font-mono-ui text-[#9fa3bd] mt-2 mb-2 tracking-widest">
              CALLSIGN
            </label>
            <input
              data-testid="nickname-input"
              type="text"
              className="kron-input w-full"
              placeholder="ENTER CALLSIGN"
              value={nickname}
              maxLength={14}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleStart(); }}
            />

            <label className="block text-sm font-mono-ui text-[#9fa3bd] mt-6 mb-2 tracking-widest">
              BOT SKATERS // <span className="neon-text-green">{botCount}</span>
            </label>
            <input
              data-testid="bots-slider"
              type="range"
              min="1" max="9" step="1"
              value={botCount}
              onChange={(e) => setBotCount(parseInt(e.target.value, 10))}
              className="w-full accent-[#a855f7]"
            />
            <div className="flex justify-between text-xs font-mono-ui text-[#6b6f85] mt-1">
              <span>1</span><span>9</span>
            </div>

            <div className="mt-6 text-xs font-mono-ui text-[#9fa3bd] leading-relaxed">
              &gt; total players: <span className="neon-text-purple">{1 + botCount}</span> / 10<br />
              &gt; map: <span className="neon-text-green">SKATEPARK::OMEGA</span><br />
              &gt; mode: <span className="neon-text-red">LAST::SURVIVOR</span><br />
              &gt; round duration: <span className="neon-text-green">90s</span>
            </div>

            <button
              data-testid="start-game-btn"
              onClick={handleStart}
              className="kron-btn green w-full mt-7"
            >
              ▶ ENTER ARENA
            </button>

            <div className="mt-5 text-[10px] font-mono-ui text-[#6b6f85] text-center tracking-widest">
              WASD // MOVE — AVOID THE INFECTED
            </div>
          </div>
        </div>
      </div>

      {/* leaderboard ribbon */}
      <div className="absolute bottom-0 left-0 right-0 px-8 py-4 border-t border-[#a855f7]/20 bg-[#07080d]/70 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-mono-ui neon-text-purple tracking-widest">[ TOP_SURVIVORS ]</span>
          <div className="h-px flex-1 bg-gradient-to-r from-[#a855f7]/50 to-transparent" />
        </div>
        <div className="flex gap-6 overflow-x-auto" data-testid="leaderboard-row">
          {leaderboard.length === 0 ? (
            <span className="text-sm font-mono-ui text-[#6b6f85]">// no entries yet. be the first.</span>
          ) : leaderboard.slice(0, 8).map((row, i) => (
            <div key={row.nickname} className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="text-xs font-mono-ui text-[#6b6f85]">#{i + 1}</span>
              <span className="text-sm font-mono-ui neon-text-green">{row.nickname}</span>
              <span className="text-xs font-mono-ui text-[#9fa3bd]">
                {row.wins}W / {row.games}G · {row.best_time.toFixed(1)}s
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
