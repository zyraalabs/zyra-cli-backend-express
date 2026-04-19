import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { approveLogin } from "../controllers/approve.controller";
import { verifyWebAppToken } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", verifyWebAppToken, asyncHandler(approveLogin));

export default router;
