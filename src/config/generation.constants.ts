export const GENERATION_MODEL =
  process.env.GENERATION_MODEL ?? "claude-sonnet-5";
export const GENERATION_MAX_TOKENS = Number(
  process.env.GENERATION_MAX_TOKENS ?? 64000,
);
// Off by default: adaptive thinking can consume the entire output budget
// before any file is emitted. Set GENERATION_THINKING=true to enable.
export const GENERATION_THINKING = process.env.GENERATION_THINKING === "true";
export const GENERATION_EFFORT = (process.env.GENERATION_EFFORT ??
  "low") as "low" | "medium" | "high" | "xhigh" | "max";
export const GENERATION_MAX_PROMPT_LENGTH = 5000;
export const REPROMPT_SELECT_MODEL =
  process.env.REPROMPT_SELECT_MODEL ?? "claude-sonnet-5";
export const CLARIFY_MODEL = process.env.CLARIFY_MODEL ?? "claude-sonnet-5";
export const CLARIFY_MAX_TOKENS = 4000;
