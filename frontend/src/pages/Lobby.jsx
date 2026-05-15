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
    <div className="relative w-full h-screen overflow-hidden" data-testid="lobby-screen">
      <div className="ink-spray inset-0" style={{ position: "absolute" }} />
      <div className="absolute inset-0 grain pointer-events-none" />
      <div className="absolute inset-0 scan-lines pointer-events-none" />

      {/* hazard tape on top */}
      <div className="hazard-tape h-2 w-full absolute top-0 left-0 z-20 opacity-80" />

      {/* top bar */}
      <div className="absolute top-3 left-0 right-0 flex items-center justify-between px-8 py-5 z-10">
        <div className="flex items-center gap-3">
          <span className="text-2xl ink-text-toxic font-terminal">[ NIGHT_SHIFT ]</span>
          <span className="text-sm font-terminal text-[#6b5d7a]">// outbreak//07</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-terminal text-[#6b5d7a]">v1.1 // ink_park</span>
          {!audioReady && (
            <button
              data-testid="enable-audio-btn"
              onClick={enableAudio}
              className="px-3 py-1 text-xs font-terminal ink-text-toxic border border-[#84cc16]/50 hover:bg-[#84cc16]/10"
            >
              ENABLE AUDIO
            </button>
          )}
        </div>
      </div>

      <div className="absolute inset-0 flex">
        {/* LEFT — branding */}
        <div className="flex-1 flex flex-col justify-center pl-16 pr-8 relative">
          <div className="text-[#6b5d7a] font-terminal text-lg mb-1 ink-cursor">
            // patient_zero.exe
          </div>

          <h1
            className="font-marker ink-title-gold leading-none"
            style={{ fontSize: "clamp(56px, 9vw, 150px)" }}
            data-testid="title-kronos"
          >
            KRONOS
          </h1>

          <h2
            className="font-splat ink-title-purple ink-glitch leading-none -mt-1"
            style={{ fontSize: "clamp(40px, 6vw, 96px)" }}
            data-testid="title-arena"
          >
            INK PARK
          </h2>

          <div className="mt-3 flex items-center gap-3">
            <span className="font-splat ink-title-toxic text-xl tracking-wider">NIGHT SHIFT INFECTION</span>
            <span className="text-2xl">☣</span>
          </div>

          <p className="mt-6 text-lg text-[#b4a8c5] max-w-lg font-terminal leading-relaxed">
            &gt; escapa, sobrevive, no te infectes.<br />
            &gt; los skaters huyen. los infectados convierten.<br />
            &gt; el último vivo se queda con la corona.
          </p>

          <div className="mt-6 flex items-center gap-6 text-base">
            <div className="flex items-center gap-2" data-testid="legend-survivor">
              <span className="inline-block w-3 h-3 rounded-full bg-[#fbbf24] shadow-[0_0_12px_#fbbf24]" />
              <span className="ink-text-gold font-marker">SKATER</span>
            </div>
            <div className="flex items-center gap-2" data-testid="legend-infected">
              <span className="inline-block w-3 h-3 rounded-full bg-[#a855f7] shadow-[0_0_12px_#a855f7]" />
              <span className="ink-text-purple font-marker">INFECTED</span>
            </div>
          </div>
        </div>

        {/* RIGHT — control panel */}
        <div className="w-[440px] flex items-center justify-center pr-12">
          <div className="ink-panel p-7 w-full relative">
            <div className="absolute -top-3 left-5 px-2 bg-[#0c0a12] text-xs font-terminal ink-text-purple">
              [ LOBBY :: ENTRY ]
            </div>

            <label className="block text-sm font-terminal text-[#b4a8c5] mt-2 mb-2 tracking-widest">
              CALLSIGN
            </label>
            <input
              data-testid="nickname-input"
              type="text"
              className="ink-input w-full"
              placeholder="ENTER CALLSIGN"
              value={nickname}
              maxLength={14}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleStart(); }}
            />

            <label className="block text-sm font-terminal text-[#b4a8c5] mt-6 mb-2 tracking-widest">
              SKATERS BOT // <span className="ink-text-toxic">{botCount}</span>
            </label>
            <input
              data-testid="bots-slider"
              type="range"
              min="1" max="9" step="1"
              value={botCount}
              onChange={(e) => setBotCount(parseInt(e.target.value, 10))}
              className="w-full accent-[#a855f7]"
            />
            <div className="flex justify-between text-xs font-terminal text-[#6b5d7a] mt-1">
              <span>1</span><span>9</span>
            </div>

            <div className="mt-6 text-xs font-terminal text-[#b4a8c5] leading-relaxed">
              &gt; total players: <span className="ink-text-purple">{1 + botCount}</span> / 10<br />
              &gt; map: <span className="ink-text-toxic">INK_PARK :: ALPHA</span><br />
              &gt; mode: <span className="ink-text-blood">NIGHT_SHIFT_INFECTION</span><br />
              &gt; round duration: <span className="ink-text-toxic">90s</span>
            </div>

            <button
              data-testid="start-game-btn"
              onClick={handleStart}
              className="ink-btn toxic w-full mt-7"
            >
              <span>▶ ENTER INK PARK</span>
            </button>

            <div className="mt-4 text-[10px] font-terminal text-[#6b5d7a] text-center tracking-widest">
              WASD // MOVE — AVOID THE INFECTED
            </div>
          </div>
        </div>
      </div>

      {/* leaderboard ribbon */}
      <div className="absolute bottom-0 left-0 right-0 px-8 py-4 border-t border-[#a855f7]/20 bg-[#0c0a12]/80 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-terminal ink-text-purple tracking-widest">[ TOP_SURVIVORS ]</span>
          <div className="h-px flex-1 bg-gradient-to-r from-[#a855f7]/50 to-transparent" />
          <a
            data-testid="download-node-btn"
            href="/kronos-arena-node-full.zip"
            download
            className="text-xs font-terminal px-3 py-1 border border-[#84cc16]/60 ink-text-toxic hover:bg-[#84cc16]/10"
          >
            ⬇ DOWNLOAD NODE.JS BUILD
          </a>
        </div>
        <div className="flex gap-6 overflow-x-auto" data-testid="leaderboard-row">
          {leaderboard.length === 0 ? (
            <span className="text-sm font-terminal text-[#6b5d7a]">// no entries yet. be the first.</span>
          ) : leaderboard.slice(0, 8).map((row, i) => (
            <div key={row.nickname} className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="text-xs font-terminal text-[#6b5d7a]">#{i + 1}</span>
              <span className="text-sm font-marker ink-text-toxic">{row.nickname}</span>
              <span className="text-xs font-terminal text-[#b4a8c5]">
                {row.wins}W / {row.games}G · {row.best_time.toFixed(1)}s
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="hazard-tape h-2 w-full absolute bottom-0 left-0 z-0 opacity-50" />
    </div>
  );
}
