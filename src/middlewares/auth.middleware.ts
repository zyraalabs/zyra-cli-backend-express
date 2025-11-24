import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ErrorResponse } from "../utils/apiResponse";
import { logger } from "../utils/logger";

interface DecodedToken {
  id: string;
  email: string;
  [key: string]: any;
}

declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
    }
  }
}

export function verifyJWT(req: Request, res: Response, next: NextFunction) {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      logger.warn("auth", "No token provided");
      return ErrorResponse(
        res,
        "Access denied. Please login to access this resource.",
        401
      );
    }

    const secret = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET;

    if (!secret) {
      logger.error("auth", "JWT_SECRET not configured");
      return ErrorResponse(res, "Server configuration error", 500);
    }

    const decodedToken = jwt.verify(token, secret) as DecodedToken;

    req.user = decodedToken;
    next();
  } catch (error) {
    logger.error("auth", "Invalid token", error);
    return ErrorResponse(res, "Invalid access token", 401);
  }
}
