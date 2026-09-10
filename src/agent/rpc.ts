import { randomUUID } from "crypto";
import { AgentSocket, ToolName, ToolResultMessage } from "./protocol";

export const TOOL_TIMEOUT_MS = Number(process.env.AGENT_TOOL_TIMEOUT_MS ?? 180_000);

export class SessionClosedError extends Error {}

interface Pending {
  resolve: (result: ToolResultMessage) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class ToolBridge {
  private readonly pending = new Map<string, Pending>();
  private closedReason: string | null = null;

  constructor(private readonly socket: AgentSocket) {
    socket.onMessage((msg) => {
      if (msg.type !== "tool_result") return;
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      this.pending.delete(msg.id);
      entry.resolve(msg);
    });

    socket.onClose((reason) => {
      this.closedReason = reason;
      for (const [, entry] of this.pending) {
        clearTimeout(entry.timer);
        entry.reject(new SessionClosedError(reason));
      }
      this.pending.clear();
    });
  }

  get closed(): boolean {
    return this.closedReason !== null;
  }

  call(tool: ToolName, input: Record<string, unknown>): Promise<ToolResultMessage> {
    if (this.closedReason) {
      return Promise.reject(new SessionClosedError(this.closedReason));
    }

    const id = randomUUID();

    return new Promise<ToolResultMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({
          type: "tool_result",
          id,
          ok: false,
          result: `Tool "${tool}" timed out after ${TOOL_TIMEOUT_MS}ms.`,
        });
      }, TOOL_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timer });
      this.socket.send({ type: "tool_call", id, tool, input });
    });
  }
}
