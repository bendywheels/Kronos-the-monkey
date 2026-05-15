import React from "react";

export default function EndOverlay({ result, onPlayAgain }) {
  const won = result.youWon;
  const youInfected = !result.youSurvived;

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-[#08060c]/85 backdrop-blur-sm"
      data-testid="end-overlay"
    >
      <div className="ink-panel px-12 py-10 relative max-w-md w-full mx-6 text-center grain">
        <div className="text-xs font-terminal text-[#6b5d7a] tracking-widest mb-2">
          [ ROUND :: COMPLETE ]
        </div>

        <h2
          className={`font-splat ${won ? "ink-title-toxic" : "ink-title-purple"} ink-glitch leading-none`}
          style={{ fontSize: "72px" }}
          data-testid="end-result-title"
        >
          {won ? "ESCAPED" : "INFECTED"}
        </h2>

        <div className="mt-3 text-sm font-terminal text-[#b4a8c5]">
          {result.winner === "survivors"
            ? <>&gt; los skaters huyeron al amanecer.</>
            : <>&gt; la tinta consumió a todos.</>}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 text-left">
          <div className="ink-panel py-3 px-4">
            <div className="text-[10px] font-terminal text-[#6b5d7a] tracking-widest">YOUR FATE</div>
            <div className={`text-lg font-marker ${youInfected ? "ink-text-purple" : "ink-text-gold"}`}>
              {youInfected ? "INFECTED" : "SURVIVED"}
            </div>
          </div>
          <div className="ink-panel py-3 px-4">
            <div className="text-[10px] font-terminal text-[#6b5d7a] tracking-widest">TIME ALIVE</div>
            <div className="text-lg font-marker ink-text-purple">
              {result.survivedSeconds.toFixed(1)}s
            </div>
          </div>
          <div className="ink-panel py-3 px-4">
            <div className="text-[10px] font-terminal text-[#6b5d7a] tracking-widest">SKATERS LEFT</div>
            <div className="text-lg font-marker ink-text-gold">
              {result.survivorsLeft}
            </div>
          </div>
          <div className="ink-panel py-3 px-4">
            <div className="text-[10px] font-terminal text-[#6b5d7a] tracking-widest">START ROLE</div>
            <div className={`text-lg font-marker ${result.role === "infected" ? "ink-text-purple" : "ink-text-gold"}`}>
              {result.role.toUpperCase()}
            </div>
          </div>
        </div>

        <button
          data-testid="play-again-btn"
          onClick={onPlayAgain}
          className="ink-btn toxic w-full mt-8"
        >
          <span>↺ RETURN TO LOBBY</span>
        </button>
      </div>
    </div>
  );
}
