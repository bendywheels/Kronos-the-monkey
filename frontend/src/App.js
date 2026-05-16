import React, { useState, useCallback } from "react";
import "@/App.css";
import Lobby from "./pages/Lobby";
import GameScreen from "./pages/GameScreen";
import WaitingRoom from "./pages/WaitingRoom";

export default function App() {
  const [screen, setScreen] = useState("lobby");
  const [config, setConfig] = useState({ nickname: "KRONOS", botCount: 5 });
  const [session, setSession] = useState(null); // { nickname, roomId, selfId }

  const startSingle = useCallback((cfg) => {
    setConfig(cfg);
    setSession(null);
    setScreen("game-single");
  }, []);

  const joinedRoom = useCallback((s) => {
    setSession(s);
    setScreen("waiting");
  }, []);

  const startOnlineGame = useCallback(() => {
    setScreen("game-online");
  }, []);

  const backToLobby = useCallback(() => {
    setSession(null);
    setScreen("lobby");
  }, []);

  return (
    <div className="App" data-testid="kronos-app">
      {screen === "lobby" && (
        <Lobby onStartSingle={startSingle} onJoinedRoom={joinedRoom} initial={config} />
      )}
      {screen === "game-single" && (
        <GameScreen mode="single" config={config} onExit={backToLobby} />
      )}
      {screen === "waiting" && session && (
        <WaitingRoom session={session} onLeave={backToLobby} onGameStart={startOnlineGame} />
      )}
      {screen === "game-online" && session && (
        <GameScreen mode="online" session={session} onExit={backToLobby} />
      )}
    </div>
  );
}
