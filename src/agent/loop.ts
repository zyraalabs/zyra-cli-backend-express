import Anthropic from "@anthropic-ai/sdk";
import { Toolchain } from "./allowlist";
import {
  MAX_CONSECUTIVE_FAILURES,
  MAX_TOOL_CALLS,
  MAX_WALL_CLOCK_MS,
  consecutiveToolFailures,
  pairToolBlocks,
} from "./guards";
import { AgentSocket } from "./protocol";
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

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userPrompt },
  ];

  const startedAt = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  let toolCalls = 0;

  const finish = (stopReason: StopReason): LoopResult => {
    onTrace?.({ type: "stop", stopReason, toolCalls, inputTokens, outputTokens });
    return { stopReason, inputTokens, outputTokens, toolCalls };
  };

  while (true) {
    if (bridge.closed) return finish("disconnected");
    if (Date.now() - startedAt > MAX_WALL_CLOCK_MS) return finish("time_limit");
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

    const stream = client.messages.stream({
      model: AGENT_MODEL,
      max_tokens: AGENT_MAX_TOKENS,
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: AGENT_EFFORT },
      system: [
        { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
      ],
      tools: TOOL_DEFINITIONS,
      messages,
    });

    stream.on("text", (text) => {
      socket.send({ type: "progress", event: "text", detail: text });
    });

    const response = await stream.finalMessage();
    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") return finish("completed");

    const requests = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    const results = await Promise.all(
      requests.map(async (request) => {
        toolCalls++;
        socket.send({
          type: "progress",
          event: "tool_start",
          detail: describe(request),
        });
        onTrace?.({ type: "tool_call", tool: request.name, input: request.input });

        try {
          const outcome = await executeTool(
            request.name,
            request.input as Record<string, unknown>,
            bridge,
            toolchain,
          );
          socket.send({
            type: "progress",
            event: "tool_end",
            detail: outcome.isError ? `failed: ${request.name}` : `ok: ${request.name}`,
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

function describe(request: Anthropic.ToolUseBlock): string {
  const input = request.input as Record<string, unknown>;
  if (request.name === "run_command" && typeof input.cmd === "string") {
    return `running ${input.cmd}`;
  }
  if (typeof input.path === "string") {
    return `${request.name.replace("_", " ")} ${input.path}`;
  }
  return request.name;
}
