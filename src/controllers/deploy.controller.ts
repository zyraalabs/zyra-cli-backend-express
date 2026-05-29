import crypto from "crypto";
import { Request, Response } from "express";
import AdmZip from "adm-zip";
import { GenerationModel } from "@zyraalabs/zyraa-db";
import { logger } from "../utils/logger";
import { createProject, setProjectEnvVars, deployFiles, waitForDeployment, type VercelFile } from "../lib/vercel";

function buildProjectName(_userId: string, projectName: string): string {
  const slug = (projectName || "app")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  const random = crypto.randomBytes(4).toString("hex");
  return `zyraa-${slug}-${random}`;
}

function extractSourceFiles(zip: Buffer): VercelFile[] {
  const adm = new AdmZip(zip);
  const files: VercelFile[] = [];

  for (const entry of adm.getEntries()) {
    if (entry.isDirectory) continue;
    const path = entry.entryName.replace(/^\.?\//, "");
    if (!path) continue;
    files.push({ path, content: entry.getData() });
  }

  return files;
}

function parseEnvHeader(header: string | undefined): Record<string, string> {
  if (!header) return {};
  try {
    const parsed: unknown = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // malformed header — proceed without env vars
  }
  return {};
}

export async function deploy(req: Request, res: Response) {
  const generationId = req.query.generationId as string | undefined;
  const existingProjectId = req.query.vercelProjectId as string | undefined;
  const userId = req.user?.userId ?? "anon";
  const zip = req.body as Buffer;
  const envVars = parseEnvHeader(req.headers["x-env-vars"] as string | undefined);

  if (!Buffer.isBuffer(zip) || zip.length === 0) {
    res.status(400).json({ error: "No zip payload received" });
    return;
  }

  const files = extractSourceFiles(zip);
  if (files.length === 0) {
    res.status(400).json({ error: "Zip contains no files" });
    return;
  }

  let projectId: string;
  let projectName: string;

  if (existingProjectId) {
    projectId = existingProjectId;
    const gen = generationId
      ? await GenerationModel.findById(generationId).select("projectName").lean()
      : null;
    projectName = gen?.projectName ?? buildProjectName(userId, "");
    logger.info("deploy", `Redeploying to existing project: ${projectId}`);
    if (Object.keys(envVars).length > 0) {
      await setProjectEnvVars(projectId, envVars);
      logger.info("deploy", `Updated ${Object.keys(envVars).length} env vars`);
    }
  } else {
    const gen = generationId
      ? await GenerationModel.findById(generationId).select("projectName").lean()
      : null;
    projectName = buildProjectName(userId, gen?.projectName ?? "");
    logger.info("deploy", `Creating Vercel project: ${projectName}`);
    const project = await createProject(projectName);
    projectId = project.id;
    logger.info("deploy", `Project created: ${projectId}`);
    if (Object.keys(envVars).length > 0) {
      await setProjectEnvVars(projectId, envVars);
      logger.info("deploy", `Set ${Object.keys(envVars).length} env vars`);
    }
  }

  logger.info("deploy", `Uploading ${files.length} files and deploying`);
  const deployment = await deployFiles(projectId, projectName, files);
  logger.info("deploy", `Deployment started: ${deployment.id}`);

  const url = await waitForDeployment(deployment.id);
  logger.info("deploy", `Live: ${url}`);

  if (generationId) {
    await GenerationModel.findByIdAndUpdate(
      generationId,
      { $set: { deploymentUrl: url, vercelProjectId: projectId } },
      { strict: false },
    );
  }

  res.json({ url, vercelProjectId: projectId });
}
