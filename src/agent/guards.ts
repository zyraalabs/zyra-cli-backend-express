import Anthropic from "@anthropic-ai/sdk";

export const MAX_CONSECUTIVE_FAILURES = Number(
  process.env.AGENT_MAX_CONSECUTIVE_FAILURES ?? 4,
);
export const MAX_TOOL_CALLS = Number(process.env.AGENT_MAX_TOOL_CALLS ?? 150);
export const MAX_WALL_CLOCK_MS = Number(
  process.env.AGENT_MAX_WALL_CLOCK_MS ?? 15 * 60_000,
);

const CANCELLED_RESULT = "Tool call was cancelled before it completed.";

type Param = Anthropic.MessageParam;
type Block = Anthropic.ContentBlockParam;

function blocksOf(message: Param): Block[] {
  return Array.isArray(message.content) ? (message.content as Block[]) : [];
}

export function pairToolBlocks(messages: Param[]): Param[] {
  const repaired: Param[] = [];
  let changed = false;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    if (message.role !== "assistant") {
      if (message.role === "user") {
        const blocks = blocksOf(message);
        const results = blocks.filter((b) => b.type === "tool_result");
        if (results.length && results.length === blocks.length) {
          changed = true;
          continue;
        }
      }
      repaired.push(message);
      continue;
    }

    const calls = blocksOf(message).filter(
      (b): b is Anthropic.ToolUseBlockParam => b.type === "tool_use",
    );
    repaired.push(message);
    if (!calls.length) continue;

    const next = messages[i + 1];
    const provided = new Map<string, Block>();
    if (next?.role === "user") {
      for (const block of blocksOf(next)) {
        if (block.type !== "tool_result") continue;
        if (!provided.has(block.tool_use_id)) provided.set(block.tool_use_id, block);
      }
    }

    const ordered: Block[] = [];
    for (const call of calls) {
      const existing = provided.get(call.id);
      if (existing) {
        ordered.push(existing);
        provided.delete(call.id);
      } else {
        ordered.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: CANCELLED_RESULT,
          is_error: true,
        });
        changed = true;
      }
    }

    if (provided.size) changed = true;

    if (next?.role === "user") {
      const extra = blocksOf(next).filter((b) => b.type !== "tool_result");
      if (extra.length) {
        repaired.push({ role: "user", content: [...ordered, ...extra] });
      } else {
        repaired.push({ role: "user", content: ordered });
      }
      i++;
    } else {
      repaired.push({ role: "user", content: ordered });
      changed = true;
    }
  }

  return changed ? repaired : messages;
}

export function consecutiveToolFailures(messages: Param[]): number {
  let count = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const blocks = blocksOf(message);

    if (message.role === "user") {
      const results = blocks.filter(
        (b): b is Anthropic.ToolResultBlockParam => b.type === "tool_result",
      );
      if (!results.length) break;
      if (results.some((r) => r.is_error !== true)) break;
      count += results.length;
      continue;
    }

    const hasText = blocks.some((b) => b.type === "text" && b.text.trim().length > 0);
    if (hasText) break;
  }

  return count;
}
