import { redis } from "./redis";

const PREFIX = "cli:login:";
const TTL_SECONDS = 300;

interface CliLoginState {
  status: "pending" | "approved";
  token?: string;
}

export async function createLoginRequest(requestId: string): Promise<void> {
  await redis.set(PREFIX + requestId, { status: "pending" }, { ex: TTL_SECONDS });
}

export async function getLoginRequest(requestId: string): Promise<CliLoginState | null> {
  const state = await redis.get<CliLoginState>(PREFIX + requestId);
  return state ?? null;
}

export async function approveLoginRequest(
  requestId: string,
  token: string,
): Promise<boolean> {
  const existing = await redis.get<CliLoginState>(PREFIX + requestId);
  if (!existing || existing.status === "approved") return false;

  await redis.set(
    PREFIX + requestId,
    { status: "approved", token },
    { keepTtl: true },
  );

  return true;
}
