import crypto from "crypto";

const BASE = "https://api.vercel.com";

export interface VercelFile {
  path: string;
  content: Buffer;
}

interface DeploymentFileRef {
  file: string;
  sha: string;
  size: number;
}

function token(): string {
  const t = process.env.VERCEL_TOKEN;
  if (!t) throw new Error("VERCEL_TOKEN is not configured");
  return t;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return { Authorization: `Bearer ${token()}`, ...extra };
}

function teamParam(prefix: "?" | "&" = "?"): string {
  return process.env.VERCEL_TEAM_ID
    ? `${prefix}teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}`
    : "";
}

async function vFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Vercel API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export async function createProject(name: string): Promise<{ id: string }> {
  return vFetch(`/v11/projects${teamParam()}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      name,
      framework: "nextjs",
      installCommand: "pnpm install",
      buildCommand: "pnpm build",
    }),
  });
}

export async function setProjectEnvVars(
  projectId: string,
  envVars: Record<string, string>,
): Promise<void> {
  const entries = Object.entries(envVars).filter(([, v]) => v.trim() !== "");
  if (entries.length === 0) return;

  const payload = entries.map(([key, value]) => ({
    key,
    value,
    type: "encrypted",
    target: ["production", "preview", "development"],
  }));

  await vFetch(`/v10/projects/${projectId}/env${teamParam()}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

async function uploadFile(file: VercelFile): Promise<DeploymentFileRef> {
  const sha = crypto.createHash("sha1").update(file.content).digest("hex");
  const size = file.content.length;

  const res = await fetch(`${BASE}/v2/files${teamParam()}`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "x-vercel-digest": sha,
      "content-length": String(size),
    },
    body: file.content,
  });

  if (!res.ok && res.status !== 200) {
    const text = await res.text().catch(() => "");
    throw new Error(`Vercel file upload ${res.status}: ${text.slice(0, 200)}`);
  }

  return { file: file.path, sha, size };
}

export async function deployFiles(
  projectId: string,
  projectName: string,
  files: VercelFile[]
): Promise<{ id: string; url: string }> {
  const fileRefs = await Promise.all(files.map(uploadFile));

  return vFetch(`/v13/deployments?forceNew=1${teamParam("&")}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      name: projectName,
      project: projectId,
      files: fileRefs,
      projectSettings: {
        framework: "nextjs",
        installCommand: "pnpm install",
        buildCommand: "pnpm build",
        nodeVersion: "20.x",
      },
      target: "production",
    }),
  });
}

export async function waitForDeployment(
  deployId: string,
  maxAttempts = 80
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const data = await vFetch<{
      readyState: string;
      url: string;
      errorMessage?: string | null;
    }>(`/v13/deployments/${deployId}${teamParam()}`, {
      headers: authHeaders(),
    });

    if (data.readyState === "READY") return `https://${data.url}`;
    if (data.readyState === "ERROR")
      throw new Error(data.errorMessage ?? "Vercel deployment failed");
    if (data.readyState === "CANCELED")
      throw new Error("Deployment was canceled");

    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error("Deployment timed out after 4 minutes");
}
