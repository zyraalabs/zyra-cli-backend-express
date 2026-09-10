import { WebSocket } from "ws";
import { AgentSocket, ClientToServer, ServerToClient } from "../protocol";

export function wsAgentSocket(ws: WebSocket): AgentSocket {
  const messageHandlers: ((msg: ClientToServer) => void)[] = [];
  const closeHandlers: ((reason: string) => void)[] = [];
  const buffered: ClientToServer[] = [];
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
    if (!messageHandlers.length) {
      buffered.push(parsed);
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
      const first = messageHandlers.length === 0;
      messageHandlers.push(handler);
      if (!first || !buffered.length) return;
      const pending = buffered.splice(0, buffered.length);
      for (const msg of pending) handler(msg);
    },
    onClose(handler) {
      closeHandlers.push(handler);
      if (closed) handler("client disconnected");
    },
    close() {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (ws.bufferedAmount === 0) {
        ws.close();
        return;
      }
      const stop = () => {
        clearInterval(drain);
        clearTimeout(giveUp);
        if (ws.readyState === WebSocket.OPEN) ws.close();
      };
      const drain = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN || ws.bufferedAmount === 0) stop();
      }, 50).unref();
      const giveUp = setTimeout(stop, 5_000).unref();
    },
  };
}
