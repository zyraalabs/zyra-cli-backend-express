import { Router } from "express";
import express from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { deploy } from "../controllers/deploy.controller";
import { verifyJWT } from "../middlewares/auth.middleware";

const router = Router();

router.post(
  "/",
  verifyJWT,
  express.raw({ type: "application/zip", limit: "20mb" }),
  asyncHandler(deploy),
);

export default router;
