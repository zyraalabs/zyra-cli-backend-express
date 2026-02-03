import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { detectFramework } from "../controllers/detectFramework.controller";
import { verifyJWT } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", verifyJWT, asyncHandler(detectFramework));

export default router;
