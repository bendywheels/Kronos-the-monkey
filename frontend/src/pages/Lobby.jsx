import React, { useState, useEffect } from "react";
import axios from "axios";
import { sfxClick, initAudio } from "../game/audio";
import { getSocket } from "../multiplayer/socket";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Lobby({ onStartSingle, onJoinedRoom, initial }) {
  const [nickname, setNickname] = useState(initial?.nickname || "");
  const [botCount, setBotCount] = useState(initial?.botCount ?? 5);
  const [leaderboard, setLeaderboard] = useState([]);
  const [audioReady, setAudioReady] = useState(false);
  const [mode, setMode] = useState("menu"); // menu | single | join
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    axios.get(`${API}/leaderboard`).then(r => setLeaderboard(r.data || [])).catch(() => {});
  }, []);

  const nm = () => (nickname.trim() || "KRONOS").slice(0, 14).toUpperCase();

  const handleStartSingle = () => {
    sfxClick();
    onStartSingle({ nickname: nm(), botCount });
  };

  const handleCreate = () => {
    sfxClick();
    setBusy(true);
    setJoinError("");
    const s = getSocket();
    s.emit("create_room", {
      nickname: nm(),
      config: { infectedAtStart: 1, duration: 90, targetPlayers: 6, fillWithBots: true },
    }, (resp) => {
      setBusy(false);
      if (resp?.ok) {
        onJoinedRoom({ nickname: nm(), roomId: resp.roomId, selfId: s.id });
      } else {
        setJoinError(resp?.error || "Could not create room. Server offline?");
      }
    });
  };

  const handleJoin = () => {
    sfxClick();
    if (!joinCode.trim()) { setJoinError("Enter a room code"); return; }
    setBusy(true);
    setJoinError("");
    const s = getSocket();
    s.emit("join_room", { roomId: joinCode.trim().toUpperCase(), nickname: nm() }, (resp) => {
      setBusy(false);
      if (resp?.ok) {
        onJoinedRoom({ nickname: nm(), roomId: resp.roomId, selfId: s.id });
      } else {
        setJoinError(resp?.error === "room_not_found" ? "Room not found" :
          resp?.error === "in_progress" ? "Match already in progress" :
          resp?.error === "room_full" ? "Room is full" : "Could not join");
      }
    });
  };

  const enableAudio = () => { initAudio(); setAudioReady(true); sfxClick(); };

  return (
    <div className="relative w-full min-h-screen overflow-y-auto" data-testid="lobby-screen" style={{ touchAction: "manipulation" }}>
      <div className="ink-spray inset-0" style={{ position: "absolute" }} />
      <div className="absolute inset-0 grain pointer-events-none" />
      <div className="absolute inset-0 scan-lines pointer-events-none" />
      <div className="hazard-tape h-2 w-full absolute top-0 left-0 z-20 opacity-80" />

      {/* top bar */}
      <div className="absolute top-3 left-0 right-0 flex items-center justify-between px-3 sm:px-8 py-3 sm:py-5 z-10 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-base sm:text-2xl ink-text-toxic font-terminal whitespace-nowrap">[ NIGHT_SHIFT ]</span>
          <span className="text-[10px] sm:text-sm font-terminal text-[#6b5d7a] truncate">// outbreak//07</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <span className="hidden sm:inline text-sm font-terminal text-[#6b5d7a]">v2.0 // multiplayer</span>
          {!audioReady && (
            <button data-testid="enable-audio-btn" onClick={enableAudio}
              className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-terminal ink-text-toxic border border-[#84cc16]/50 hover:bg-[#84cc16]/10">
              ENABLE AUDIO
            </button>
          )}
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col lg:flex-row pt-16 sm:pt-20 lg:pt-0 pb-32 sm:pb-36 lg:pb-24 overflow-y-auto">
        {/* BRANDING */}
        <div className="lg:flex-1 flex flex-col justify-center px-5 sm:px-10 lg:pl-16 lg:pr-8 relative">
          <div className="text-[#6b5d7a] font-terminal text-sm sm:text-lg mb-1 ink-cursor">// patient_zero.exe</div>
          <h1 className="font-marker ink-title-gold leading-none" style={{ fontSize: "clamp(54px, 12vw, 150px)" }} data-testid="title-kronos">KRONOS</h1>
          <h2 className="font-splat ink-title-purple ink-glitch leading-none mt-1" style={{ fontSize: "clamp(36px, 8vw, 96px)" }} data-testid="title-arena">INK PARK</h2>
          <div className="mt-3 flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="font-splat ink-title-toxic text-base sm:text-xl tracking-wider">NIGHT SHIFT INFECTION</span>
            <span className="text-xl sm:text-2xl">☣</span>
          </div>
          <p className="mt-5 text-sm sm:text-lg text-[#b4a8c5] max-w-lg font-terminal leading-relaxed">
            &gt; juega solo contra bots, o crea una sala para jugar con amigos.<br />
            &gt; comparte el código de sala. los infectados son configurables.<br />
            &gt; el último vivo se queda con la corona.
          </p>
          <div className="mt-5 flex items-center gap-4 sm:gap-6 text-sm sm:text-base">
            <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-[#fbbf24] shadow-[0_0_12px_#fbbf24]" /><span className="ink-text-gold font-marker">SKATER</span></div>
            <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-[#a855f7] shadow-[0_0_12px_#a855f7]" /><span className="ink-text-purple font-marker">INFECTED</span></div>
          </div>
        </div>

        {/* CONTROL PANEL */}
        <div className="w-full lg:w-[460px] flex items-start lg:items-center justify-center px-5 sm:px-10 lg:pr-12 lg:pl-0 mt-6 lg:mt-0">
          <div className="ink-panel p-5 sm:p-7 w-full max-w-md relative">
            <div className="absolute -top-3 left-5 px-2 bg-[#0c0a12] text-[10px] sm:text-xs font-terminal ink-text-purple">[ LOBBY :: ENTRY ]</div>

            <label className="block text-xs sm:text-sm font-terminal text-[#b4a8c5] mt-2 mb-2 tracking-widest">CALLSIGN</label>
            <input
              data-testid="nickname-input" type="text" className="ink-input w-full"
              placeholder="ENTER CALLSIGN" value={nickname} maxLength={14}
              onChange={(e) => setNickname(e.target.value)}
            />

            {mode === "menu" && (
              <div className="mt-5 grid gap-3">
                <button data-testid="mode-single-btn" onClick={() => { sfxClick(); setMode("single"); }} className="ink-btn w-full">
                  <span>🎯 SINGLE PLAYER (BOTS)</span>
                </button>
                <button data-testid="mode-create-btn" onClick={handleCreate} disabled={busy} className="ink-btn toxic w-full">
                  <span>{busy ? "..." : "👑 CREATE MULTIPLAYER ROOM"}</span>
                </button>
                <button data-testid="mode-join-btn" onClick={() => { sfxClick(); setMode("join"); }} className="ink-btn w-full" style={{ borderColor: "#ec4899", boxShadow: "0 0 22px rgba(236,72,153,0.45), inset 0 0 14px rgba(236,72,153,0.18)" }}>
                  <span>🔑 JOIN BY CODE</span>
                </button>
                {joinError && <div className="text-xs font-terminal ink-text-blood text-center mt-1">{joinError}</div>}
              </div>
            )}

            {mode === "single" && (
              <>
                <label className="block text-xs sm:text-sm font-terminal text-[#b4a8c5] mt-5 mb-2 tracking-widest">
                  SKATERS BOT // <span className="ink-text-toxic">{botCount}</span>
                </label>
                <input data-testid="bots-slider" type="range" min="1" max="9" step="1" value={botCount}
                  onChange={(e) => setBotCount(parseInt(e.target.value, 10))} className="w-full accent-[#a855f7] h-6" />
                <div className="flex justify-between text-[10px] sm:text-xs font-terminal text-[#6b5d7a] mt-1"><span>1</span><span>9</span></div>

                <div className="mt-4 text-[11px] sm:text-xs font-terminal text-[#b4a8c5] leading-relaxed">
                  &gt; total players: <span className="ink-text-purple">{1 + botCount}</span> / 10<br />
                  &gt; map: <span className="ink-text-toxic">INK_PARK :: ALPHA</span><br />
                  &gt; round duration: <span className="ink-text-toxic">90s</span>
                </div>

                <button data-testid="start-game-btn" onClick={handleStartSingle} className="ink-btn toxic w-full mt-5">
                  <span>▶ ENTER INK PARK</span>
                </button>
                <button onClick={() => { sfxClick(); setMode("menu"); }} className="w-full mt-3 text-xs font-terminal text-[#6b5d7a] hover:ink-text-purple">← BACK</button>
              </>
            )}

            {mode === "join" && (
              <>
                <label className="block text-xs sm:text-sm font-terminal text-[#b4a8c5] mt-5 mb-2 tracking-widest">ROOM CODE</label>
                <input
                  data-testid="join-code-input" type="text" className="ink-input w-full uppercase tracking-[0.3em] text-center"
                  placeholder="XXXX" value={joinCode} maxLength={4}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
                />
                {joinError && <div className="text-xs font-terminal ink-text-blood mt-2">{joinError}</div>}
                <button data-testid="confirm-join-btn" onClick={handleJoin} disabled={busy} className="ink-btn toxic w-full mt-5">
                  <span>{busy ? "..." : "→ ENTER ROOM"}</span>
                </button>
                <button onClick={() => { sfxClick(); setMode("menu"); setJoinError(""); }} className="w-full mt-3 text-xs font-terminal text-[#6b5d7a] hover:ink-text-purple">← BACK</button>
              </>
            )}

            <div className="mt-4 text-[9px] sm:text-[10px] font-terminal text-[#6b5d7a] text-center tracking-widest leading-relaxed">
              DESKTOP: WASD / HOLD MOUSE<br />
              MOBILE: TAP &amp; DRAG (bottom-left)
            </div>
          </div>
        </div>
      </div>

      {/* leaderboard ribbon */}
      <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 py-3 sm:py-4 border-t border-[#a855f7]/20 bg-[#0c0a12]/85 backdrop-blur-md z-10">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="text-[10px] sm:text-xs font-terminal ink-text-purple tracking-widest">[ TOP_SURVIVORS ]</span>
          <div className="h-px flex-1 bg-gradient-to-r from-[#a855f7]/50 to-transparent min-w-[20px]" />
          <a data-testid="download-node-btn" href="/kronos-arena-node-full.zip" download
             className="text-[10px] sm:text-xs font-terminal px-2 sm:px-3 py-1 border border-[#84cc16]/60 ink-text-toxic hover:bg-[#84cc16]/10">⬇ NODE.JS BUILD</a>
        </div>
        <div className="flex gap-3 sm:gap-6 overflow-x-auto" data-testid="leaderboard-row">
          {leaderboard.length === 0 ? (
            <span className="text-xs sm:text-sm font-terminal text-[#6b5d7a]">// no entries yet. be the first.</span>
          ) : leaderboard.slice(0, 8).map((row, i) => (
            <div key={row.nickname} className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="text-[10px] sm:text-xs font-terminal text-[#6b5d7a]">#{i + 1}</span>
              <span className="text-xs sm:text-sm font-marker ink-text-toxic">{row.nickname}</span>
              <span className="text-[10px] sm:text-xs font-terminal text-[#b4a8c5]">{row.wins}W / {row.games}G · {row.best_time.toFixed(1)}s</span>
            </div>
          ))}
        </div>
      </div>
      <div className="hazard-tape h-1.5 sm:h-2 w-full absolute bottom-0 left-0 z-0 opacity-50" />
    </div>
  );
}
