import { jwtVerify } from "jose";
import { Request, Response, NextFunction } from "express";
import { ErrorResponse } from "../utils/apiResponse";
import { logger } from "../utils/logger";
import { UserModel } from "@zyraalabs/zyraa-db";

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

export async function checkAndDeductCredit(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userId = req.user?.userId;
  if (!userId) return ErrorResponse(res, "Not authenticated", 401);

  try {
    const user = await UserModel.findOneAndUpdate(
      { _id: userId, "usage.remainingTrial": { $gt: 0 } },
      { $inc: { "usage.remainingTrial": -1, "usage.totalBuilds": 1 } },
    );

    if (!user)
      return ErrorResponse(
        res,
        "Build limit reached. Upgrade your plan at zyraa.live",
        403,
      );

    next();
  } catch (error) {
    logger.error("auth", "Credit deduction error", error);
    return ErrorResponse(res, "Authentication failed", 500);
  }
}

export async function verifyWebAppToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return ErrorResponse(res, "Not authenticated", 401);

    const jwtSecret = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET;
    if (!jwtSecret) return ErrorResponse(res, "Server configuration error", 500);

    try {
      await jwtVerify(token, new TextEncoder().encode(jwtSecret));
    } catch (err: unknown) {
      const isExpired =
        err instanceof Error && err.message.includes("exp");
      return ErrorResponse(
        res,
        isExpired ? "Session expired" : "Invalid token",
        401,
      );
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

    const jwtSecret = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET;
    if (!jwtSecret) {
      logger.error("auth", "JWT_SECRET not configured");
      return ErrorResponse(res, "Server configuration error", 500);
    }

    let decoded: JWTPayload;
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(jwtSecret),
      );
      decoded = payload as unknown as JWTPayload;
    } catch (err: unknown) {
      const isExpired =
        err instanceof Error && err.message.includes("exp");
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

    req.user = decoded;
    next();
  } catch (error) {
    logger.error("auth", "Auth middleware error", error);
    return ErrorResponse(res, "Authentication failed. Run: zyraa login", 401);
  }
}
