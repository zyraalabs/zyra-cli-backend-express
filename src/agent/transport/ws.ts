import { WebSocket } from "ws";
import { AgentSocket, ClientToServer, ServerToClient } from "../protocol";

export function wsAgentSocket(ws: WebSocket): AgentSocket {
  const messageHandlers: ((msg: ClientToServer) => void)[] = [];
  const closeHandlers: ((reason: string) => void)[] = [];
  let closed = false;

  const fireClose = (reason: string) => {
    if (closed) return;
    closed = true;
    for (const handler of closeHandlers) handler(reason);
  };

  ws.on("message", (raw) => {
    let parsed: ClientToServer;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      return;
    }
    for (const handler of messageHandlers) handler(parsed);
  });

  ws.on("close", () => fireClose("client disconnected"));
  ws.on("error", (error) => fireClose(error.message));

  return {
    send(msg: ServerToClient) {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify(msg));
    },
    onMessage(handler) {
      messageHandlers.push(handler);
    },
    onClose(handler) {
      closeHandlers.push(handler);
      if (closed) handler("client disconnected");
    },
    close() {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    },
  };
}
