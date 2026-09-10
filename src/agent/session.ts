import { appendFile, mkdir } from "fs/promises";
import { join } from "path";
import { jwtVerify } from "jose";
import { UserModel, GenerationModel as Generation } from "@zyraalabs/zyraa-db";
import { getAnthropicClient } from "../utils/anthropic.util";
import { logger } from "../utils/logger";
import {
  SupportedFramework,
  SUPPORTED_FRAMEWORKS,
} from "../config/frameworkDetection.constants";
import { toolchainFor } from "./allowlist";
import { runAgentLoop, StopReason } from "./loop";
import { AgentSocket, StartMessage } from "./protocol";
import { ToolBridge } from "./rpc";
import { getAgentPrompt } from "../prompts/agent.prompt";

const TRACE_DIR = join(process.cwd(), "logs", "agent");

const HALT_MESSAGE: Record<StopReason, string> = {
  completed: "",
  failure_spin:
    "The same error kept repeating, so the build was stopped before it looped.",
  tool_call_limit: "This build hit its step limit and was stopped.",
  time_limit: "This build hit its time limit and was stopped.",
  disconnected: "Connection lost.",
};

export async function verifyToken(
  token: string | undefined,
): Promise<{ userId: string } | null> {
  if (!token) return null;
  const secret = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    logger.error("agent", "JWT_SECRET not configured");
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const userId = (payload as { userId?: string }).userId;
    return userId ? { userId } : null;
  } catch {
    return null;
  }
}

const CREDIT_TIMEOUT_MS = 10_000;

async function takeCredit(userId: string): Promise<boolean> {
  const user = await UserModel.findOneAndUpdate(
    { _id: userId, "usage.remainingTrial": { $gt: 0 } },
    { $inc: { "usage.remainingTrial": -1, "usage.totalBuilds": 1 } },
  ).maxTimeMS(CREDIT_TIMEOUT_MS);
  return Boolean(user);
}

async function refundCredit(userId: string): Promise<void> {
  await UserModel.findByIdAndUpdate(userId, {
    $inc: { "usage.remainingTrial": 1, "usage.totalBuilds": -1 },
  }).catch((error) => logger.error("agent", "Refund failed", error));
}

function isFramework(value: string): value is SupportedFramework {
  return (SUPPORTED_FRAMEWORKS as readonly string[]).includes(value);
}

export async function runSession(
  socket: AgentSocket,
  token: string | undefined,
): Promise<void> {
  const auth = await verifyToken(token);
  if (!auth) {
    socket.send({ type: "error", message: "Not authenticated. Run: zyraa login" });
    socket.close();
    return;
  }

  const start = await waitForStart(socket);
  if (!start) {
    socket.close();
    return;
  }

  const framework = isFramework(start.framework) ? start.framework : "nextjs";

  let hasCredit: boolean;
  try {
    hasCredit = await takeCredit(auth.userId);
  } catch (error) {
    logger.error("agent", "Credit check failed", error);
    socket.send({ type: "error", message: "Service unavailable. Please try again." });
    socket.close();
    return;
  }

  if (!hasCredit) {
    socket.send({
      type: "error",
      message: "Build limit reached. Upgrade your plan at zyraa.live",
    });
    socket.close();
    return;
  }

  const bridge = new ToolBridge(socket);
  const startedAt = Date.now();
  const traceFile = join(TRACE_DIR, `${Date.now()}-${auth.userId}.jsonl`);
  await mkdir(TRACE_DIR, { recursive: true }).catch(() => {});

  const onTrace = (event: Record<string, unknown>) => {
    void appendFile(
      traceFile,
      JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n",
    ).catch(() => {});
  };

  try {
    const result = await runAgentLoop({
      client: getAnthropicClient(),
      socket,
      bridge,
      systemPrompt: getAgentPrompt(framework, start.wasScaffolded),
      userPrompt: start.prompt,
      toolchain: toolchainFor(framework),
      onTrace,
    });

    if (result.stopReason === "disconnected") {
      await refundCredit(auth.userId);
      return;
    }

    if (result.stopReason !== "completed") {
      socket.send({ type: "error", message: HALT_MESSAGE[result.stopReason] });
    }

    await Generation.create({
      userId: auth.userId,
      prompt: start.prompt,
      framework,
      filesGenerated: 0,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      durationMs: Date.now() - startedAt,
      projectName: "",
    }).catch((error) => logger.error("agent", "Generation record failed", error));

    socket.send({
      type: "done",
      filesChanged: 0,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });

    logger.info(
      "agent",
      `${result.stopReason} | tools: ${result.toolCalls} | tokens: ${result.inputTokens + result.outputTokens}`,
    );
  } catch (error) {
    await refundCredit(auth.userId);
    logger.error("agent", "Session failed", error);
    socket.send({ type: "error", message: "Build failed. Please try again." });
  } finally {
    socket.close();
  }
}

function waitForStart(socket: AgentSocket): Promise<StartMessage | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 30_000);
    socket.onMessage((msg) => {
      if (msg.type !== "start") return;
      clearTimeout(timer);
      resolve(msg);
    });
    socket.onClose(() => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}
