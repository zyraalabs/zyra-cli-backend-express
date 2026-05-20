import { Request, Response, NextFunction } from "express";
import { SuccessResponse, ErrorResponse } from "../utils/apiResponse";
import { logger } from "../utils/logger";
import { approveLoginRequest } from "../lib/cli-login";

export async function approveLogin(req: Request, res: Response, _next: NextFunction) {
  const { requestId, userId, token } = req.body;

  if (!requestId || !userId || !token) {
    return ErrorResponse(res, "Missing required fields", 400);
  }

  const approved = await approveLoginRequest(requestId, token);

  if (!approved) {
    logger.warn("approve", `Login request invalid or already used: ${requestId}`);
    return ErrorResponse(res, "Login request not found, expired, or already used", 400);
  }

  logger.info("approve", `Login request approved for user: ${userId}`);
  return SuccessResponse(res, { message: "Login request approved" });
}
