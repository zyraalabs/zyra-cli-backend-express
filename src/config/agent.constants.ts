export const AGENT_MODEL = process.env.AGENT_MODEL ?? "claude-opus-5";
export const AGENT_MAX_TOKENS = Number(process.env.AGENT_MAX_TOKENS ?? 32000);
export const AGENT_EFFORT = (process.env.AGENT_EFFORT ?? "xhigh") as
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";
