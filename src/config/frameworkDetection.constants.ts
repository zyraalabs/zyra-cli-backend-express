export const FRAMEWORK_DETECTION_MODEL = "claude-sonnet-4-20250514";
export const FRAMEWORK_DETECTION_MAX_TOKENS = 200;

export const SUPPORTED_FRAMEWORKS = ["nextjs", "vite-react", "express"] as const;

export type SupportedFramework = typeof SUPPORTED_FRAMEWORKS[number];
