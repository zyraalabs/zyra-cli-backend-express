const BASE = "https://api.netlify.com/api/v1";

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${process.env.NETLIFY_API_TOKEN}` };
}

async function netlifyFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Netlify API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function createSite(name: string): Promise<{ id: string; ssl_url: string }> {
  const body: Record<string, string> = { name };
  if (process.env.NETLIFY_TEAM_ID) body.account_id = process.env.NETLIFY_TEAM_ID;
  return netlifyFetch("/sites", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deployZip(siteId: string, zip: Buffer): Promise<{ id: string; ssl_url: string }> {
  return netlifyFetch(`/sites/${siteId}/deploys`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/zip" },
    body: zip,
  });
}

export async function waitForDeploy(deployId: string, maxAttempts = 40): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const data = await netlifyFetch<{ state: string; ssl_url: string; error_message?: string }>(
      `/deploys/${deployId}`,
      { headers: authHeaders() },
    );
    if (data.state === "ready") return data.ssl_url;
    if (data.state === "error") throw new Error(data.error_message ?? "Netlify deploy failed");
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Deploy timed out after 2 minutes");
}
