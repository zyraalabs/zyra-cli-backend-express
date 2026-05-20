import { Request, Response, NextFunction } from "express";
import { nanoid } from "nanoid";
import { SuccessResponse, ErrorResponse } from "../utils/apiResponse";
import { logger } from "../utils/logger";
import { createLoginRequest, getLoginRequest } from "../lib/cli-login";

export async function initLogin(_req: Request, res: Response, _next: NextFunction) {
  const requestId = nanoid(16);

  await createLoginRequest(requestId);

  const appUrl = process.env.MY_APP_URL || "http://localhost:3002";

  logger.info("cli-login", `Login request initialized: ${requestId}`);

  return SuccessResponse(res, {
    requestId,
    url: `${appUrl}/cli-auth?req=${requestId}`,
    expiresIn: 300,
  });
}

export async function checkStatus(req: Request, res: Response, _next: NextFunction) {
  const { req: requestId } = req.query;

  if (!requestId || typeof requestId !== "string") {
    return ErrorResponse(res, "Request ID is required", 400);
  }

  const state = await getLoginRequest(requestId);

  if (!state) {
    return ErrorResponse(res, "Login request expired", 400);
  }

  if (state.status === "approved") {
    logger.info("cli-login", `Login request approved: ${requestId}`);
    return SuccessResponse(res, { status: "approved", token: state.token });
  }

  return SuccessResponse(res, { status: "pending" });
}
