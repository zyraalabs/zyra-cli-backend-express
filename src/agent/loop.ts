import Anthropic from "@anthropic-ai/sdk";
import { Toolchain } from "./allowlist";
import {
  MAX_CONSECUTIVE_FAILURES,
  MAX_TOOL_CALLS,
  MAX_WALL_CLOCK_MS,
  consecutiveToolFailures,
  pairToolBlocks,
} from "./guards";
import { ActionKind, AgentSocket } from "./protocol";
import { ToolBridge, SessionClosedError } from "./rpc";
import { TOOL_DEFINITIONS, executeTool } from "./tools";
import {
  AGENT_EFFORT,
  AGENT_MAX_TOKENS,
  AGENT_MODEL,
} from "../config/agent.constants";

export type StopReason =
  | "completed"
  | "failure_spin"
  | "tool_call_limit"
  | "time_limit"
  | "disconnected";

export interface LoopResult {
  stopReason: StopReason;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
}

export interface LoopOptions {
  client: Anthropic;
  socket: AgentSocket;
  bridge: ToolBridge;
  systemPrompt: string;
  userPrompt: string;
  toolchain: Toolchain;
  onTrace?: (event: Record<string, unknown>) => void;
}

export async function runAgentLoop(options: LoopOptions): Promise<LoopResult> {
  const { client, socket, bridge, systemPrompt, userPrompt, toolchain, onTrace } =
    options;

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: userPrompt },
  ];

  const startedAt = Date.now();
  const touched = new Set<string>();
  let waitingOnUserMs = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let toolCalls = 0;

  const finish = (stopReason: StopReason): LoopResult => {
    onTrace?.({ type: "stop", stopReason, toolCalls, inputTokens, outputTokens });
    return { stopReason, inputTokens, outputTokens, toolCalls };
  };

  while (true) {
    if (bridge.closed) return finish("disconnected");
    if (Date.now() - startedAt - waitingOnUserMs > MAX_WALL_CLOCK_MS) {
      return finish("time_limit");
    }
    if (toolCalls >= MAX_TOOL_CALLS) return finish("tool_call_limit");
    if (consecutiveToolFailures(messages) >= MAX_CONSECUTIVE_FAILURES) {
      return finish("failure_spin");
    }

    const paired = pairToolBlocks(messages);
    if (paired !== messages) {
      messages.length = 0;
      messages.push(...paired);
      onTrace?.({ type: "repaired_tool_pairing" });
    }

    const stream = client.beta.messages.stream({
      model: AGENT_MODEL,
      max_tokens: AGENT_MAX_TOKENS,
      betas: ["context-management-2025-06-27"],
      context_management: { edits: [{ type: "clear_tool_uses_20250919" }] },
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: AGENT_EFFORT },
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral", ttl: "1h" },
        },
      ],
      tools: TOOL_DEFINITIONS,
      messages,
    });

    stream.on("text", (text) => {
      socket.send({ type: "progress", event: "text", detail: text });
    });

    stream.on("thinking", (delta) => {
      socket.send({ type: "progress", event: "thinking", detail: delta });
    });

    const response = await stream.finalMessage();
    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") return finish("completed");

    const requests = response.content.filter(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use",
    );

    const results = await Promise.all(
      requests.map(async (request) => {
        toolCalls++;
        const action = describe(request, touched);
        socket.send({
          type: "progress",
          event: "tool_start",
          detail: action.detail,
          kind: action.kind,
          target: action.target,
          note: action.note,
        });
        onTrace?.({ type: "tool_call", tool: request.name, input: request.input });

        const askedAt = request.name === "ask_user" ? Date.now() : 0;

        try {
          const outcome = await executeTool(
            request.name,
            request.input as Record<string, unknown>,
            bridge,
            toolchain,
          );
          if (askedAt) waitingOnUserMs += Date.now() - askedAt;
          socket.send({
            type: "progress",
            event: "tool_end",
            detail: outcome.isError ? firstRealError(outcome.content) : action.detail,
            kind: action.kind,
            target: action.target,
            note: action.note,
            ok: !outcome.isError,
          });
          onTrace?.({ type: "tool_result", tool: request.name, ok: !outcome.isError });
          return {
            type: "tool_result" as const,
            tool_use_id: request.id,
            content: outcome.content,
            is_error: outcome.isError,
          };
        } catch (error) {
          if (error instanceof SessionClosedError) throw error;
          const message = error instanceof Error ? error.message : "tool failed";
          socket.send({
            type: "progress",
            event: "tool_end",
            detail: message.slice(0, 200),
            kind: action.kind,
            target: action.target,
            ok: false,
          });
          onTrace?.({ type: "tool_result", tool: request.name, ok: false });
          return {
            type: "tool_result" as const,
            tool_use_id: request.id,
            content: message,
            is_error: true,
          };
        }
      }),
    ).catch((error) => {
      if (error instanceof SessionClosedError) return null;
      throw error;
    });

    if (results === null) return finish("disconnected");

    messages.push({ role: "user", content: results });
  }
}

interface Action {
  kind: ActionKind;
  target: string;
  detail: string;
  note?: string;
}

const ERROR_PATTERNS = [
  /^.*error TS\d+:.*$/m,
  /^Type error:.*$/m,
  /^.*Module not found:.*$/m,
  /^.*Cannot find (?:module|name).*$/m,
  /^.*SyntaxError:.*$/m,
  /^.*ERR_[A-Z_]+.*$/m,
  /^\s*✕.*$/m,
  /^.*[Ee]rror:.*$/m,
];

export function firstRealError(output: string): string {
  for (const pattern of ERROR_PATTERNS) {
    const match = output.match(pattern);
    if (match) return match[0].trim().slice(0, 240);
  }
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return (lines[lines.length - 1] ?? "failed").slice(0, 240);
}

function lineCount(value: unknown): number {
  return typeof value === "string" ? value.split("\n").length : 0;
}

function describe(request: Anthropic.Beta.BetaToolUseBlock, seen: Set<string>): Action {
  const input = request.input as Record<string, unknown>;
  const path = typeof input.path === "string" ? input.path : "";

  switch (request.name) {
    case "write_file": {
      const known = seen.has(path);
      seen.add(path);
      const lines = lineCount(input.content);
      return {
        kind: known ? "editing" : "creating",
        target: path,
        detail: `${known ? "rewriting" : "creating"} ${path}`,
        note: lines ? `${lines} lines` : undefined,
      };
    }
    case "edit_file": {
      seen.add(path);
      const removed = lineCount(input.old_string);
      const added = lineCount(input.new_string);
      return {
        kind: "editing",
        target: path,
        detail: `editing ${path}`,
        note: `+${added} -${removed}`,
      };
    }
    case "read_file":
      seen.add(path);
      return { kind: "reading", target: path, detail: `reading ${path}` };
    case "list_dir":
      return {
        kind: "exploring",
        target: path || ".",
        detail: `exploring ${path || "."}`,
      };
    case "run_command": {
      const cmd = typeof input.cmd === "string" ? input.cmd : "";
      return { kind: "running", target: cmd, detail: `running ${cmd}` };
    }
    case "ask_user":
      return {
        kind: "asking",
        target: typeof input.question === "string" ? input.question : "",
        detail: "waiting for your answer",
      };
    default:
      return { kind: "running", target: "", detail: request.name };
  }
}
