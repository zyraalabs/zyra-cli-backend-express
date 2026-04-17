import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { getAnthropicClient } from "../utils/anthropic.util";
import {
  GENERATION_MODEL,
  GENERATION_MAX_TOKENS,
} from "../config/generation.constants";
import { getNextJsPrompt } from "../prompts/generation/nextjs.prompt";
import { getViteReactPrompt } from "../prompts/generation/vite-react.prompt";
import { getExpressPrompt } from "../prompts/generation/express.prompt";
import { validateGenerationRequest } from "../utils/generation.util";

const getSystemPrompt = (framework: string, wasScaffolded: boolean): string => {
  const prompts: Record<string, (scaffolded: boolean) => string> = {
    nextjs: getNextJsPrompt,
    "vite-react": getViteReactPrompt,
    express: getExpressPrompt,
  };
  const promptFn = prompts[framework] || prompts.nextjs;
  return promptFn(wasScaffolded);
};

export async function generate(
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const { prompt, framework = "nextjs", wasScaffolded = false } = req.body;

  const validation = validateGenerationRequest(prompt, res);
  if (!validation.isValid) return validation.error;

  logger.info(
    "generate",
    `Generation requested by user: ${req.user?.id || "unknown"} | Framework: ${framework} | Scaffolded: ${wasScaffolded}`,
  );

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const client = getAnthropicClient();
    const systemPrompt = getSystemPrompt(framework, wasScaffolded);

    const stream = client.messages.stream({
      model: GENERATION_MODEL,
      max_tokens: GENERATION_MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    stream.on("text", (text) => send({ type: "text", text }));

    const final = await stream.finalMessage();

    send({
      type: "done",
      usage: {
        inputTokens: final.usage.input_tokens,
        outputTokens: final.usage.output_tokens,
      },
    });

    logger.info(
      "generate",
      `Completed. Tokens: ${final.usage.input_tokens + final.usage.output_tokens}`,
    );
  } catch (error) {
    const err = error as { status?: number };
    const message =
      err.status === 429
        ? "Rate limit exceeded. Please try again shortly."
        : err.status === 401
          ? "Server configuration error"
          : "Generation failed. Please try again.";

    logger.error("generate", "Anthropic stream failed", error);
    send({ type: "error", message });
  }

  res.end();
}
