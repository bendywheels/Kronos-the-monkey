import React from "react";

export default function EndOverlay({ result, onPlayAgain }) {
  const won = result.youWon;
  const youInfected = !result.youSurvived;

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-[#04050a]/85 backdrop-blur-sm"
      data-testid="end-overlay"
    >
      <div className="kron-panel px-12 py-10 relative max-w-md w-full mx-6 text-center">
        <div className="text-xs font-mono-ui text-[#6b6f85] tracking-widest mb-2">
          [ ROUND::COMPLETE ]
        </div>

        <h2
          className={`font-display ${won ? "neon-text-green" : "neon-text-red"} kron-glitch leading-none`}
          style={{ fontSize: "72px" }}
          data-testid="end-result-title"
        >
          {won ? "VICTORY" : "DEFEAT"}
        </h2>

        <div className="mt-3 text-sm font-mono-ui text-[#9fa3bd]">
          {result.winner === "survivors"
            ? <>&gt; survivors held the line.</>
            : <>&gt; the infection consumed all.</>}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 text-left">
          <div className="kron-panel py-3 px-4">
            <div className="text-[10px] font-mono-ui text-[#6b6f85] tracking-widest">YOUR FATE</div>
            <div className={`text-lg font-display ${youInfected ? "neon-text-red" : "neon-text-green"}`}>
              {youInfected ? "INFECTED" : "SURVIVED"}
            </div>
          </div>
          <div className="kron-panel py-3 px-4">
            <div className="text-[10px] font-mono-ui text-[#6b6f85] tracking-widest">TIME ALIVE</div>
            <div className="text-lg font-display neon-text-purple">
              {result.survivedSeconds.toFixed(1)}s
            </div>
          </div>
          <div className="kron-panel py-3 px-4">
            <div className="text-[10px] font-mono-ui text-[#6b6f85] tracking-widest">SURVIVORS LEFT</div>
            <div className="text-lg font-display neon-text-green">
              {result.survivorsLeft}
            </div>
          </div>
          <div className="kron-panel py-3 px-4">
            <div className="text-[10px] font-mono-ui text-[#6b6f85] tracking-widest">START ROLE</div>
            <div className={`text-lg font-display ${result.role === "infected" ? "neon-text-red" : "neon-text-green"}`}>
              {result.role.toUpperCase()}
            </div>
          </div>
        </div>

        <button
          data-testid="play-again-btn"
          onClick={onPlayAgain}
          className="kron-btn green w-full mt-8"
        >
          ↺ RETURN TO LOBBY
        </button>
      </div>
    </div>
  );
}
