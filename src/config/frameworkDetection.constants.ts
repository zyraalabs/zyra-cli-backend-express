export const FRAMEWORK_DETECTION_MODEL =
  process.env.FRAMEWORK_DETECTION_MODEL ?? "claude-haiku-4-5-20251001";
export const FRAMEWORK_DETECTION_MAX_TOKENS = 200;

export const SUPPORTED_FRAMEWORKS = [
  "nextjs",
  "vite-react",
  "express",
] as const;

export type SupportedFramework = (typeof SUPPORTED_FRAMEWORKS)[number];
