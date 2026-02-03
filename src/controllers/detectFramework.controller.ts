import { Request, Response, NextFunction } from "express";
import { SuccessResponse, ErrorResponse } from "../utils/apiResponse";
import { logger } from "../utils/logger";
import { getAnthropicClient } from "../utils/anthropic.util";
import { FRAMEWORK_DETECTION_PROMPT } from "../prompts/frameworkDetection.prompt";
import {
  FRAMEWORK_DETECTION_MODEL,
  FRAMEWORK_DETECTION_MAX_TOKENS,
  SupportedFramework,
} from "../config/frameworkDetection.constants";
import { SCAFFOLD_COMMANDS } from "../config/scaffoldCommands.constants";

interface FrameworkDetection {
  framework: string;
  reasoning: string;
}

export async function detectFramework(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return ErrorResponse(res, "Prompt is required", 400);
  }

  logger.info("detect-framework", `Detecting framework for: ${prompt}`);

  try {
    const client = getAnthropicClient();

    const message = await client.messages.create({
      model: FRAMEWORK_DETECTION_MODEL,
      max_tokens: FRAMEWORK_DETECTION_MAX_TOKENS,
      system: FRAMEWORK_DETECTION_PROMPT,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === "text");

    if (!textContent || textContent.type !== "text") {
      logger.error("detect-framework", "No text content in response");
      return ErrorResponse(res, "Failed to detect framework", 500);
    }

    let detection: FrameworkDetection;
    try {
      detection = JSON.parse(textContent.text.trim());
    } catch (parseError) {
      logger.error(
        "detect-framework",
        "Failed to parse JSON response",
        parseError,
      );
      detection = {
        framework: "nextjs",
        reasoning: "Failed to parse LLM response, defaulting to Next.js",
      };
    }

    const scaffoldCommand =
      SCAFFOLD_COMMANDS[detection.framework as SupportedFramework] || "";
    const needsScaffold = scaffoldCommand.length > 0;

    logger.info(
      "detect-framework",
      `Detected: ${detection.framework} (scaffold: ${needsScaffold})`,
    );

    return SuccessResponse(res, {
      framework: detection.framework,
      reasoning: detection.reasoning,
      scaffoldCommand,
      needsScaffold,
    });
  } catch (error) {
    logger.error("detect-framework", "Detection failed", error);
    return ErrorResponse(res, "Failed to detect framework", 500);
  }
}
