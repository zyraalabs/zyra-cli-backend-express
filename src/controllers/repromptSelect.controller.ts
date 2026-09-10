import { Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "../utils/anthropic.util";
import { REPROMPT_SELECT_MODEL } from "../config/generation.constants";
import { getRepromptSelectPrompt } from "../prompts/reprompt.prompt";
import { ErrorResponse } from "../utils/apiResponse";
import { logger } from "../utils/logger";

export async function repromptSelect(req: Request, res: Response) {
  const { generationId, prompt, indexContent } = req.body;

  if (!prompt || !indexContent) {
    return ErrorResponse(res, "prompt and indexContent are required", 400);
  }

  try {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: REPROMPT_SELECT_MODEL,
      max_tokens: 1024,
      system: getRepromptSelectPrompt(),
      messages: [
        {
          role: "user",
          content: `Project files:\n${indexContent}\n\nModification request: ${prompt}`,
        },
      ],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!text) {
      logger.warn("repromptSelect", "No text block in model response");
      return ErrorResponse(res, "Invalid response from model", 500);
    }

    let filePaths: string[];
    try {
      // Extract JSON array even if model wraps it in markdown
      const match = text.match(/\[[\s\S]*\]/);
      filePaths = JSON.parse(match ? match[0] : text);
      if (!Array.isArray(filePaths)) throw new Error("Not an array");
    } catch {
      logger.warn("repromptSelect", `Failed to parse file list: ${text}`);
      return ErrorResponse(res, "Could not parse file selection", 500);
    }

    logger.info(
      "repromptSelect",
      `Selected ${filePaths.length} files | generationId: ${generationId ?? "none"}`,
    );
    return res.json({ success: true, data: { filePaths } });
  } catch (error) {
    logger.error("repromptSelect", "Select failed", error);
    return ErrorResponse(res, "File selection failed", 500);
  }
}
