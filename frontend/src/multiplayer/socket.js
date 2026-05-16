// Socket.IO client singleton + game session helpers
import { io } from "socket.io-client";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(BACKEND_URL || undefined, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
