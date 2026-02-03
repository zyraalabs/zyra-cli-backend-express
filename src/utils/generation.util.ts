import { Response } from "express";
import { ErrorResponse } from "./apiResponse";
import { logger } from "./logger";
import { GENERATION_MAX_PROMPT_LENGTH } from "../config/generation.constants";

interface ValidationError {
  isValid: false;
  error: Response;
}

interface ValidationSuccess {
  isValid: true;
}

type ValidationResult = ValidationError | ValidationSuccess;

export function validateGenerationRequest(
  prompt: unknown,
  res: Response
): ValidationResult {
  if (!prompt || typeof prompt !== "string") {
    return {
      isValid: false,
      error: ErrorResponse(res, "Prompt is required", 400),
    };
  }

  if (prompt.trim().length === 0) {
    return {
      isValid: false,
      error: ErrorResponse(res, "Prompt cannot be empty", 400),
    };
  }

  if (prompt.length > GENERATION_MAX_PROMPT_LENGTH) {
    return {
      isValid: false,
      error: ErrorResponse(
        res,
        `Prompt exceeds maximum length of ${GENERATION_MAX_PROMPT_LENGTH} characters`,
        400
      ),
    };
  }

  return { isValid: true };
}

interface AnthropicError {
  status?: number;
  message?: string;
}

export function handleAnthropicError(
  error: AnthropicError,
  res: Response
): Response {
  logger.error("generate", "Anthropic API call failed", error);

  if (error?.status === 429) {
    return ErrorResponse(
      res,
      "Rate limit exceeded. Please try again shortly.",
      429
    );
  }

  if (error?.status === 401) {
    return ErrorResponse(res, "Server configuration error", 500);
  }

  return ErrorResponse(res, "Failed to generate code. Please try again.", 500);
}

export async function saveGenerationResponse(
  content: string
): Promise<void> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const logsDir = path.join(process.cwd(), "logs");
    await fs.mkdir(logsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/:/g, "-");
    const filename = `response-${timestamp}.txt`;
    const filepath = path.join(logsDir, filename);

    await fs.writeFile(filepath, content, "utf-8");
    logger.info("generate", `Response saved to ${filepath}`);
  } catch (err) {
    logger.error("generate", "Failed to save response to file", err);
  }
}
