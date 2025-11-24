import { Request, Response, NextFunction } from "express";
import { nanoid } from "nanoid";
import { CliLoginRequest } from "../models/cliLoginRequest.model";
import { connectToDatabase } from "../db/db";
import { SuccessResponse, ErrorResponse } from "../utils/apiResponse";
import { logger } from "../utils/logger";

export async function initLogin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  await connectToDatabase();

  const requestId = nanoid(16);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const loginRequest = await CliLoginRequest.create({
    requestId,
    status: "pending",
    expiresAt,
  });

  const appUrl = process.env.MY_APP_URL || "http://localhost:3001";
  const url = `${appUrl}/cli-auth?req=${requestId}`;

  logger.info("cli-login", `Login request initialized: ${requestId}`);

  return SuccessResponse(res, {
    requestId,
    url,
    expiresIn: 300,
  });
}

export async function checkStatus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  await connectToDatabase();

  const { req: requestId } = req.query;

  if (!requestId || typeof requestId !== "string") {
    return ErrorResponse(res, "Request ID is required", 400);
  }

  const loginRequest = await CliLoginRequest.findOne({ requestId });

  if (!loginRequest) {
    return ErrorResponse(res, "Login request not found", 404);
  }

  if (new Date() > loginRequest.expiresAt) {
    loginRequest.status = "expired";
    await loginRequest.save();
    logger.warn("cli-login", `Login request expired: ${requestId}`);
    return ErrorResponse(res, "Login request expired", 400);
  }

  if (loginRequest.status === "approved") {
    logger.info("cli-login", `Login request approved: ${requestId}`);
    return SuccessResponse(res, {
      status: "approved",
      token: loginRequest.token,
    });
  }

  return SuccessResponse(res, {
    status: loginRequest.status,
  });
}
