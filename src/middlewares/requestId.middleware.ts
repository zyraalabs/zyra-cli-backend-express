import { Request, Response, NextFunction } from "express";
import { requestContext } from "../utils/logger";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = crypto.randomUUID();
  res.setHeader("X-Request-ID", id);
  requestContext.run({ requestId: id }, next);
}
