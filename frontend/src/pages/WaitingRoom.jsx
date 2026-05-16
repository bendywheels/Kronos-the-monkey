import React, { useEffect, useState } from "react";
import { getSocket } from "../multiplayer/socket";
import { sfxClick } from "../game/audio";
import { Copy, Crown, Users, X } from "lucide-react";

export default function WaitingRoom({ session, onLeave, onGameStart }) {
  const [lobby, setLobby] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = getSocket();
    const onLobbyUpdate = (payload) => setLobby(payload);
    const onRoundStarting = () => onGameStart();
    s.on("lobby_update", onLobbyUpdate);
    s.on("round_starting", onRoundStarting);
    // Request current lobby state on mount (in case we missed the broadcast)
    s.emit("get_lobby");
    return () => {
      s.off("lobby_update", onLobbyUpdate);
      s.off("round_starting", onRoundStarting);
    };
  }, [onGameStart]);

  if (!lobby) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#0c0a12]">
        <div className="font-terminal ink-text-purple text-lg">// loading room...</div>
      </div>
    );
  }

  const isHost = lobby.hostId === session.selfId;
  const updateConfig = (patch) => {
    if (!isHost) return;
    sfxClick();
    getSocket().emit("update_config", { config: { ...lobby.config, ...patch } });
  };

  const handleStart = () => {
    sfxClick();
    getSocket().emit("start_game");
  };

  const handleLeave = () => {
    sfxClick();
    getSocket().emit("leave_room");
    onLeave();
  };

  const handleCopy = () => {
    sfxClick();
    if (navigator.clipboard) navigator.clipboard.writeText(lobby.roomId);
  };

  return (
    <div className="relative w-full min-h-screen overflow-y-auto" data-testid="waiting-room">
      <div className="ink-spray inset-0" style={{ position: "absolute" }} />
      <div className="absolute inset-0 grain pointer-events-none" />
      <div className="hazard-tape h-2 w-full absolute top-0 left-0 z-20 opacity-80" />

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-14 relative z-10">
        {/* header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <button
            data-testid="leave-room-btn"
            onClick={handleLeave}
            className="ink-panel px-3 py-2 hover:bg-[#ec4899]/10 flex items-center gap-2 text-sm font-terminal"
          >
            <X size={16} /> LEAVE
          </button>
          <h1 className="font-splat ink-title-purple text-3xl sm:text-5xl ink-glitch leading-none">WAITING ROOM</h1>
          <div className="w-[60px]" />
        </div>

        {/* room code */}
        <div className="ink-panel p-5 sm:p-6 text-center mb-6 relative">
          <div className="text-[10px] sm:text-xs font-terminal text-[#6b5d7a] tracking-widest mb-1">[ ROOM CODE ]</div>
          <div
            className="font-marker text-5xl sm:text-7xl ink-text-toxic tracking-[0.2em] cursor-pointer"
            data-testid="room-code"
            onClick={handleCopy}
            title="Click to copy"
          >
            {lobby.roomId}
          </div>
          <button
            data-testid="copy-code-btn"
            onClick={handleCopy}
            className="mt-2 text-xs font-terminal text-[#b4a8c5] hover:ink-text-toxic flex items-center gap-1 mx-auto"
          >
            <Copy size={12} /> COPY · share with friends
          </button>
        </div>

        {/* players list */}
        <div className="ink-panel p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-terminal ink-text-purple tracking-widest">[ PLAYERS ]</div>
            <div className="text-xs font-terminal text-[#b4a8c5] flex items-center gap-1">
              <Users size={12} /> {lobby.players.length} / 10
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="players-list">
            {lobby.players.map(p => (
              <div
                key={p.id}
                className={`flex items-center gap-2 px-3 py-2 border ${p.id === session.selfId ? "border-[#fbbf24]/70 bg-[#fbbf24]/5" : "border-[#a855f7]/40"} text-sm font-marker`}
              >
                {p.isHost && <Crown size={14} className="text-[#fbbf24]" />}
                <span className={p.id === session.selfId ? "ink-text-gold" : "ink-text-purple"}>
                  {p.name}
                </span>
                {p.id === session.selfId && <span className="ml-auto text-[10px] font-terminal text-[#fbbf24]">YOU</span>}
              </div>
            ))}
            {Array.from({ length: Math.max(0, lobby.config.targetPlayers - lobby.players.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#6b5d7a]/40 text-xs font-terminal text-[#6b5d7a]">
                empty slot...
              </div>
            ))}
          </div>
        </div>

        {/* config (host only) */}
        <div className="ink-panel p-5 mb-6 relative">
          <div className="absolute -top-3 left-5 px-2 bg-[#0c0a12] text-xs font-terminal ink-text-purple">
            [ MATCH SETTINGS {isHost ? "" : "// host only"} ]
          </div>

          <label className="block text-xs font-terminal text-[#b4a8c5] mt-2 mb-1 tracking-widest">
            INFECTED AT START · <span className="ink-text-blood">{lobby.config.infectedAtStart}</span>
          </label>
          <input
            data-testid="cfg-infected"
            type="range" min="1" max="3" step="1"
            value={lobby.config.infectedAtStart}
            disabled={!isHost}
            onChange={(e) => updateConfig({ infectedAtStart: parseInt(e.target.value, 10) })}
            className="w-full accent-[#ec4899]"
          />

          <label className="block text-xs font-terminal text-[#b4a8c5] mt-4 mb-1 tracking-widest">
            ROUND DURATION · <span className="ink-text-toxic">{lobby.config.duration}s</span>
          </label>
          <input
            data-testid="cfg-duration"
            type="range" min="30" max="180" step="15"
            value={lobby.config.duration}
            disabled={!isHost}
            onChange={(e) => updateConfig({ duration: parseInt(e.target.value, 10) })}
            className="w-full accent-[#84cc16]"
          />

          <label className="block text-xs font-terminal text-[#b4a8c5] mt-4 mb-1 tracking-widest">
            TOTAL PLAYERS · <span className="ink-text-purple">{lobby.config.targetPlayers}</span> (bots fill in)
          </label>
          <input
            data-testid="cfg-target-players"
            type="range" min="2" max="10" step="1"
            value={lobby.config.targetPlayers}
            disabled={!isHost}
            onChange={(e) => updateConfig({ targetPlayers: parseInt(e.target.value, 10) })}
            className="w-full accent-[#a855f7]"
          />

          <label className="flex items-center gap-2 mt-4 text-xs font-terminal text-[#b4a8c5]">
            <input
              type="checkbox"
              data-testid="cfg-fill-bots"
              checked={lobby.config.fillWithBots}
              disabled={!isHost}
              onChange={(e) => updateConfig({ fillWithBots: e.target.checked })}
              className="accent-[#84cc16] w-4 h-4"
            />
            FILL EMPTY SLOTS WITH AI BOTS
          </label>
        </div>

        {error && <div className="text-sm font-terminal ink-text-blood mb-4">{error}</div>}

        {isHost ? (
          <button
            data-testid="start-match-btn"
            onClick={handleStart}
            className="ink-btn toxic w-full"
          >
            <span>▶ START THE MATCH</span>
          </button>
        ) : (
          <div className="text-center text-sm font-terminal ink-text-purple py-3">
            // waiting for host to start the match...
          </div>
        )}
      </div>
    </div>
  );
}
