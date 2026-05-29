export const GENERATION_MODEL = process.env.GENERATION_MODEL ?? "claude-haiku-4-5-20251001";
export const GENERATION_MAX_TOKENS = Number(process.env.GENERATION_MAX_TOKENS ?? 16000);
export const GENERATION_MAX_PROMPT_LENGTH = 5000;
export const REPROMPT_SELECT_MODEL = process.env.REPROMPT_SELECT_MODEL ?? "claude-haiku-4-5-20251001";
export const CLARIFY_MODEL = process.env.CLARIFY_MODEL ?? "claude-sonnet-4-6";
export const CLARIFY_MAX_TOKENS = 4000;
export const CLARIFY_THINKING_BUDGET = 2000;
