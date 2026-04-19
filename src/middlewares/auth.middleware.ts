import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ErrorResponse } from "../utils/apiResponse";
import { logger } from "../utils/logger";
import UserModel from "../models/user.model";

interface JWTPayload {
  userId: string;
  email: string;
  exp: number;
  [key: string]: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export function verifyWebAppToken(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return ErrorResponse(res, "Not authenticated", 401);

    const secret = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET;
    if (!secret) return ErrorResponse(res, "Server configuration error", 500);

    try {
      jwt.verify(token, secret);
    } catch (err: unknown) {
      const isExpired = err instanceof Error && err.name === "TokenExpiredError";
      return ErrorResponse(res, isExpired ? "Session expired" : "Invalid token", 401);
    }

    next();
  } catch (error) {
    logger.error("auth", "verifyWebAppToken error", error);
    return ErrorResponse(res, "Authentication failed", 401);
  }
}

export async function verifyJWT(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return ErrorResponse(res, "Not authenticated. Run: zyraa login", 401);
    }

    const secret = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET;
    if (!secret) {
      logger.error("auth", "JWT_SECRET not configured");
      return ErrorResponse(res, "Server configuration error", 500);
    }

    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, secret) as JWTPayload;
    } catch (err: unknown) {
      const isExpired =
        err instanceof Error && err.name === "TokenExpiredError";
      const message = isExpired
        ? "Session expired. Run: zyraa login"
        : "Invalid token. Run: zyraa login";
      return ErrorResponse(res, message, 401);
    }

    const user = await UserModel.findById(decoded.userId)
      .select("usage isPremium plan")
      .lean();

    if (!user)
      return ErrorResponse(res, "User not found. Run: zyraa login", 401);

    if (user.usage.remainingTrial <= 0)
      return ErrorResponse(res, "Build limit reached. Upgrade your plan at zyraa.dev", 403);

    req.user = decoded;
    next();
  } catch (error) {
    logger.error("auth", "Auth middleware error", error);
    return ErrorResponse(res, "Authentication failed. Run: zyraa login", 401);
  }
}
