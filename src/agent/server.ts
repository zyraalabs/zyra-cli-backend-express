import { Server } from "http";
import { WebSocketServer } from "ws";
import { logger } from "../utils/logger";
import { runSession } from "./session";
import { wsAgentSocket } from "./transport/ws";

const AGENT_PATH = "/api/agent";

export function attachAgentServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: AGENT_PATH });

  wss.on("connection", (ws, request) => {
    const url = new URL(request.url ?? AGENT_PATH, "http://localhost");
    const header = request.headers.authorization?.replace("Bearer ", "");
    const token = header ?? url.searchParams.get("token") ?? undefined;

    logger.info("agent", "Session connected");

    void runSession(wsAgentSocket(ws), token).catch((error) => {
      logger.error("agent", "Unhandled session error", error);
      ws.close();
    });
  });

  logger.info("agent", `WebSocket listening on ${AGENT_PATH}`);
  return wss;
}
