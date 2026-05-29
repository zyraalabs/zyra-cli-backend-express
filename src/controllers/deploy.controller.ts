import crypto from "crypto";
import { Request, Response } from "express";
import AdmZip from "adm-zip";
import { GenerationModel } from "@zyraalabs/zyraa-db";
import { logger } from "../utils/logger";
import { createProject, deployFiles, waitForDeployment, type VercelFile } from "../lib/vercel";

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

export async function deploy(req: Request, res: Response) {
  const generationId = req.query.generationId as string | undefined;
  const existingProjectId = req.query.vercelProjectId as string | undefined;
  const userId = req.user?.userId ?? "anon";
  const zip = req.body as Buffer;

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
  } else {
    const gen = generationId
      ? await GenerationModel.findById(generationId).select("projectName").lean()
      : null;
    projectName = buildProjectName(userId, gen?.projectName ?? "");
    logger.info("deploy", `Creating Vercel project: ${projectName}`);
    const project = await createProject(projectName);
    projectId = project.id;
    logger.info("deploy", `Project created: ${projectId}`);
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
