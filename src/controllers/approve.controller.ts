import { Request, Response, NextFunction } from "express";
import { CliLoginRequest } from "../models/cliLoginRequest.model";
import { connectToDatabase } from "../db/db";
import { SuccessResponse, ErrorResponse } from "../utils/apiResponse";
import { logger } from "../utils/logger";

export async function approveLogin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  await connectToDatabase();

  const { requestId, userId, token } = req.body;

  if (!requestId || !userId || !token) {
    return ErrorResponse(res, "Missing required fields", 400);
  }

  const loginRequest = await CliLoginRequest.findOne({ requestId });

  if (!loginRequest) {
    return ErrorResponse(res, "Login request not found", 404);
  }

  if (new Date() > loginRequest.expiresAt) {
    logger.warn("approve", `Login request expired: ${requestId}`);
    return ErrorResponse(res, "Login request expired", 400);
  }

  if (loginRequest.status === "approved") {
    logger.warn("approve", `Login request already used: ${requestId}`);
    return ErrorResponse(res, "Login request already used", 400);
  }

  loginRequest.status = "approved";
  loginRequest.userId = userId;
  loginRequest.token = token;
  await loginRequest.save();

  logger.info("approve", `Login request approved for user: ${userId}`);

  return SuccessResponse(res, { message: "Login request approved" });
}