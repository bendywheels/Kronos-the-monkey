import React, { useState, useCallback } from "react";
import "@/App.css";
import Lobby from "./pages/Lobby";
import GameScreen from "./pages/GameScreen";

export default function App() {
  const [screen, setScreen] = useState("lobby");
  const [config, setConfig] = useState({ nickname: "KRONOS", botCount: 5 });

  const startGame = useCallback((cfg) => {
    setConfig(cfg);
    setScreen("game");
  }, []);

  const backToLobby = useCallback(() => {
    setScreen("lobby");
  }, []);

  return (
    <div className="App" data-testid="kronos-app">
      {screen === "lobby" && <Lobby onStart={startGame} initial={config} />}
      {screen === "game" && <GameScreen config={config} onExit={backToLobby} />}
    </div>
  );
}
