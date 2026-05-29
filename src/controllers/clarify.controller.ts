import { Request, Response } from "express";
import { getAnthropicClient } from "../utils/anthropic.util";
import { CLARIFY_MODEL, CLARIFY_MAX_TOKENS, CLARIFY_THINKING_BUDGET } from "../config/generation.constants";
import { getClarificationPrompt } from "../prompts/clarification.prompt";
import { SuccessResponse, ErrorResponse } from "../utils/apiResponse";
import { logger } from "../utils/logger";

interface ClarifyOption {
  label: string;
  description?: string;
}

interface ClarifyQuestion {
  id: string;
  question: string;
  category: "theme" | "features" | "env" | "style" | "technical";
  options: ClarifyOption[];
}

interface ClarifyResult {
  needsClarification: boolean;
  questions: ClarifyQuestion[];
}

const FALLBACK: ClarifyResult = { needsClarification: false, questions: [] };

export async function clarify(req: Request, res: Response) {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return ErrorResponse(res, "prompt is required", 400);
  }

  try {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: CLARIFY_MODEL,
      max_tokens: CLARIFY_MAX_TOKENS,
      thinking: {
        type: "enabled",
        budget_tokens: CLARIFY_THINKING_BUDGET,
      },
      system: getClarificationPrompt(),
      messages: [{ role: "user", content: `User's prompt: ${prompt.trim()}` }],
    });

    // Extended thinking produces [thinking_block, text_block] — find the text block
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      logger.warn("clarify", "No text response from model — falling back");
      return SuccessResponse(res, FALLBACK);
    }

    let parsed: ClarifyResult;
    try {
      const text = textBlock.text.trim();
      const match = text.match(/\{[\s\S]*\}/);
      const json = JSON.parse(match ? match[0] : text);

      if (typeof json.needsClarification !== "boolean") throw new Error("missing needsClarification");
      if (!Array.isArray(json.questions)) throw new Error("missing questions array");

      parsed = {
        needsClarification: json.needsClarification,
        questions: json.questions,
      };
    } catch {
      logger.warn("clarify", `JSON parse failed: ${textBlock.text.slice(0, 200)}`);
      return SuccessResponse(res, FALLBACK);
    }

    logger.info(
      "clarify",
      `needsClarification=${parsed.needsClarification} questions=${parsed.questions.length}`,
    );
    return SuccessResponse(res, parsed);
  } catch (error) {
    logger.error("clarify", "Clarify endpoint failed", error);
    return SuccessResponse(res, FALLBACK);
  }
}
