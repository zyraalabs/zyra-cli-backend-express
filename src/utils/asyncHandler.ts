import { Request, Response, NextFunction } from "express";
import { ErrorResponse } from "./apiResponse";

interface CustomError extends Error {
  statusCode?: number;
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      return await fn(req, res, next);
    } catch (err) {
      const error = err as CustomError;
      const statusCode = error.statusCode || 500;
      const message = error.message || "An unexpected error occurred";
      return ErrorResponse(res, message, statusCode);
    }
  };
}
