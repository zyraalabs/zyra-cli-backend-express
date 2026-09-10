import { SupportedFramework } from "../config/frameworkDetection.constants";

const BASE: string[][] = [
  ["ls"],
  ["cat"],
  ["head"],
  ["tail"],
  ["wc"],
  ["find"],
  ["grep"],
  ["rg"],
  ["git", "status"],
  ["git", "diff"],
  ["git", "log"],
];

const TOOLCHAINS = {
  node: [
    ["pnpm", "install"],
    ["pnpm", "add"],
    ["pnpm", "build"],
    ["pnpm", "lint"],
    ["pnpm", "test"],
    ["pnpm", "exec"],
    ["node", "-v"],
    ["pnpm", "-v"],
  ],
  python: [
    ["uv", "add"],
    ["uv", "sync"],
    ["uv", "run"],
    ["python", "-m"],
    ["python", "--version"],
    ["ruff", "check"],
    ["pytest"],
  ],
} satisfies Record<string, string[][]>;

export type Toolchain = keyof typeof TOOLCHAINS;

const TOOLCHAIN_OF: Record<SupportedFramework, Toolchain> = {
  nextjs: "node",
  "vite-react": "node",
  express: "node",
};

export function toolchainFor(framework: SupportedFramework): Toolchain {
  return TOOLCHAIN_OF[framework];
}

export function allowlistFor(toolchain: Toolchain): string[][] {
  return [...BASE, ...TOOLCHAINS[toolchain]];
}

const SHELL_METACHARACTERS = /[;&|`$()<>\n\r*?[\]{}~!#]/;

export type ValidationResult =
  | { ok: true; argv: string[] }
  | { ok: false; reason: string };

function tokenize(cmd: string): string[] {
  return cmd.trim().split(/\s+/).filter(Boolean);
}

function matches(argv: string[], entry: string[]): boolean {
  if (argv.length < entry.length) return false;
  return entry.every((part, i) => argv[i] === part);
}

export function validate(cmd: string, toolchain: Toolchain): ValidationResult {
  if (typeof cmd !== "string" || !cmd.trim()) {
    return { ok: false, reason: "empty command" };
  }

  if (cmd.includes("\0")) {
    return { ok: false, reason: "command contains a null byte" };
  }

  const meta = cmd.match(SHELL_METACHARACTERS);
  if (meta) {
    return {
      ok: false,
      reason: `shell metacharacter ${JSON.stringify(meta[0])} is not allowed; run one plain command with no shell syntax`,
    };
  }

  const argv = tokenize(cmd);

  if (argv.some((part) => part === ".." || part.startsWith("../") || part.includes("/../"))) {
    return { ok: false, reason: "paths may not escape the project directory" };
  }

  const allowed = allowlistFor(toolchain);
  if (!allowed.some((entry) => matches(argv, entry))) {
    return {
      ok: false,
      reason: `command "${argv.slice(0, 2).join(" ")}" is not allowed for the ${toolchain} toolchain`,
    };
  }

  return { ok: true, argv };
}
