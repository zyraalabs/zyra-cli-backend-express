import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { getAnthropicClient } from "../utils/anthropic.util";
import { GENERATION_MODEL, GENERATION_MAX_TOKENS } from "../config/generation.constants";
import { getNextJsPrompt } from "../prompts/generation/nextjs.prompt";
import { getViteReactPrompt } from "../prompts/generation/vite-react.prompt";
import { getExpressPrompt } from "../prompts/generation/express.prompt";
import { validateGenerationRequest } from "../utils/generation.util";
import UserModel from "../models/user.model";
import { Generation } from "../models/generation.model";
import { parseProjectName } from "../utils/parseProjectName";

const getSystemPrompt = (framework: string, wasScaffolded: boolean): string => {
  const prompts: Record<string, (scaffolded: boolean) => string> = {
    nextjs: getNextJsPrompt,
    "vite-react": getViteReactPrompt,
    express: getExpressPrompt,
  };
  return (prompts[framework] ?? prompts.nextjs)(wasScaffolded);
};

export async function generate(req: Request, res: Response, _next: NextFunction) {
  const { prompt, framework = "nextjs", wasScaffolded = false } = req.body;

  const validation = validateGenerationRequest(prompt, res);
  if (!validation.isValid) return validation.error;

  const userId = req.user?.userId;
  logger.info("generate", `User: ${userId} | Framework: ${framework}`);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const startedAt = Date.now();

  try {
    const client = getAnthropicClient();
    const systemPrompt = getSystemPrompt(framework, wasScaffolded);

    const stream = client.messages.stream({
      model: GENERATION_MODEL,
      max_tokens: GENERATION_MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    let fullOutput = "";
    stream.on("text", (text) => { fullOutput += text; send({ type: "text", text }); });

    const final = await stream.finalMessage();
    const durationMs = Date.now() - startedAt;
    const { input_tokens, output_tokens } = final.usage;

    const derivedName = userId ? parseProjectName(fullOutput) : "";
    const gen = userId ? new Generation({
      userId,
      prompt,
      framework,
      filesGenerated: 0,
      inputTokens: input_tokens,
      outputTokens: output_tokens,
      durationMs,
      projectName: derivedName,
    }) : null;

    send({ type: "done", usage: { inputTokens: input_tokens, outputTokens: output_tokens }, generationId: gen?._id?.toString() ?? "" });

    if (userId && gen) {
      await Promise.all([
        UserModel.findByIdAndUpdate(userId, {
          $inc: { "usage.totalBuilds": 1, "usage.remainingTrial": -1 },
        }),
        gen.save(),
      ]);
    }

    logger.info("generate", `Done. Tokens: ${input_tokens + output_tokens} | Duration: ${durationMs}ms`);
  } catch (error) {
    const err = error as { status?: number };
    const message =
      err.status === 429 ? "Rate limit exceeded. Please try again shortly." :
      err.status === 401 ? "Server configuration error" :
      "Generation failed. Please try again.";

    logger.error("generate", "Stream failed", error);
    send({ type: "error", message });
  }

  res.end();
}
