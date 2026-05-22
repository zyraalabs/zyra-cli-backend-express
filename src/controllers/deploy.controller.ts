import { Request, Response } from "express";
import { GenerationModel } from "@zyraalabs/zyraa-db";
import { logger } from "../utils/logger";
import { createSite, deployZip, waitForDeploy } from "../lib/netlify";

function buildSiteName(userId: string, projectName: string): string {
  const slug = (projectName || "app")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  const suffix = userId.slice(-6);
  const ts = Date.now().toString(36);
  return `zyraa-${suffix}-${slug}-${ts}`;
}

export async function deploy(req: Request, res: Response) {
  const generationId = req.query.generationId as string | undefined;
  const existingNetlifyId = req.query.netlifyId as string | undefined;
  const userId = req.user?.userId ?? "anon";
  const zip = req.body as Buffer;

  if (!Buffer.isBuffer(zip) || zip.length === 0) {
    res.status(400).json({ error: "No zip payload received" });
    return;
  }

  let siteId: string;
  let url: string;

  if (existingNetlifyId) {
    logger.info("deploy", `Redeploying to existing site: ${existingNetlifyId}`);
    siteId = existingNetlifyId;
    const deployment = await deployZip(siteId, zip);
    url = await waitForDeploy(deployment.id);
  } else {
    const gen = generationId
      ? await GenerationModel.findById(generationId).select("projectName").lean()
      : null;

    const name = buildSiteName(userId, gen?.projectName ?? "");
    logger.info("deploy", `Creating site: ${name} for user: ${userId}`);

    const site = await createSite(name);
    siteId = site.id;
    logger.info("deploy", `Site created: ${siteId}`);

    const deployment = await deployZip(siteId, zip);
    logger.info("deploy", `Deploy started: ${deployment.id}`);
    url = await waitForDeploy(deployment.id);
  }

  logger.info("deploy", `Live: ${url}`);

  if (generationId) {
    await GenerationModel.findByIdAndUpdate(
      generationId,
      { $set: { deploymentUrl: url, netlifyId: siteId } },
      { strict: false },
    );
  }

  res.json({ url, netlifyId: siteId });
}
