import { Request, Response, NextFunction } from "express";
import { ErrorResponse, SuccessResponse } from "../utils/apiResponse";
import { logger } from "../utils/logger";
import { getAnthropicClient } from "../utils/anthropic.util";
import {
  GENERATION_MODEL,
  GENERATION_MAX_TOKENS,
} from "../config/generation.constants";
import { getNextJsPrompt } from "../prompts/generation/nextjs.prompt";
import { getViteReactPrompt } from "../prompts/generation/vite-react.prompt";
import { getExpressPrompt } from "../prompts/generation/express.prompt";
import {
  validateGenerationRequest,
  handleAnthropicError,
  saveGenerationResponse,
} from "../utils/generation.util";

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
  next: NextFunction,
) {
  const { prompt, framework = "nextjs", wasScaffolded = false } = req.body;

  const validation = validateGenerationRequest(prompt, res);
  if (!validation.isValid) {
    return validation.error;
  }

  logger.info(
    "generate",
    `Generation requested by user: ${req.user?.id || "unknown"} | Framework: ${framework} | Scaffolded: ${wasScaffolded}`,
  );
  logger.info("generate", `Prompt: ${prompt.substring(0, 100)}...`);

  try {
    const client = getAnthropicClient();

    const systemPrompt = getSystemPrompt(framework, wasScaffolded);

    const message = await client.messages.create({
      model: GENERATION_MODEL,
      max_tokens: GENERATION_MAX_TOKENS,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === "text");

    if (!textContent || textContent.type !== "text") {
      logger.error("generate", "No text content in Anthropic response");
      return ErrorResponse(res, "Failed to generate code", 500);
    }

    logger.info(
      "generate",
      `Generation completed. Tokens used: ${message.usage.input_tokens + message.usage.output_tokens}`,
    );

    await saveGenerationResponse(textContent.text);

    return SuccessResponse(res, {
      output: textContent.text,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    });
  } catch (error) {
    return handleAnthropicError(error as { status?: number }, res);
  }
}
