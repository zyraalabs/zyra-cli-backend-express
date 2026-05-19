import { Request, Response } from "express";
import { logger } from "../utils/logger";
import { getAnthropicClient } from "../utils/anthropic.util";
import { GENERATION_MODEL, GENERATION_MAX_TOKENS } from "../config/generation.constants";
import { getRepromptPrompt } from "../prompts/reprompt.prompt";
import { GenerationModel as Generation } from "@zyraalabs/zyraa-db";

export async function reprompt(req: Request, res: Response) {
  const { generationId, prompt, files, framework = "nextjs" } = req.body as {
    generationId?: string;
    prompt: string;
    files: Array<{ path: string; content: string }>;
    framework?: string;
  };

  const userId = req.user?.userId;

  if (!prompt || !files?.length) {
    res.status(400).json({ success: false, error: "prompt and files are required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const startedAt = Date.now();

  const fileContents = files
    .map((f) => `<file path="${f.path}">\n${f.content}\n</file>`)
    .join("\n\n");

  const userMessage = `Current files:\n\n${fileContents}\n\nChange request: ${prompt}`;

  console.log("\n─────────────────── REPROMPT ───────────────────");
  console.log(`User prompt   : ${prompt}`);
  console.log(`Framework     : ${framework}`);
  console.log(`Files sent    : ${files.map((f) => f.path).join(", ")}`);
  console.log(`Message chars : ${userMessage.length.toLocaleString()}`);
  console.log("────────────────────────────────────────────────\n");

  try {
    const client = getAnthropicClient();

    const stream = client.messages.stream({
      model: GENERATION_MODEL,
      max_tokens: GENERATION_MAX_TOKENS,
      system: [{ type: "text", text: getRepromptPrompt(framework), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
    });

    let fullOutput = "";
    stream.on("text", (text) => { fullOutput += text; send({ type: "text", text }); });

    const final = await stream.finalMessage();
    const durationMs = Date.now() - startedAt;
    const { input_tokens, output_tokens } = final.usage;

    const changedFilesCount = (fullOutput.match(/<file path="/g) ?? []).length;

    send({ type: "done", usage: { inputTokens: input_tokens, outputTokens: output_tokens } });

    if (userId) {
      await Promise.all([
        generationId
          ? Generation.findByIdAndUpdate(generationId, {
              $push: {
                reprompts: {
                  prompt,
                  inputTokens: input_tokens,
                  outputTokens: output_tokens,
                  durationMs,
                  filesChanged: changedFilesCount,
                },
              },
            })
          : Promise.resolve(),
      ]);
    }

    logger.info("reprompt", `Done. Tokens: ${input_tokens + output_tokens} | Duration: ${durationMs}ms`);
  } catch (error) {
    const err = error as { status?: number };
    const message =
      err.status === 429 ? "Rate limit exceeded. Please try again shortly." :
      err.status === 401 ? "Server configuration error" :
      "Reprompt failed. Please try again.";

    logger.error("reprompt", "Stream failed", error);
    send({ type: "error", message });
  }

  res.end();
}
