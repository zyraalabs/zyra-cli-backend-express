import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { approveLogin } from "../controllers/approve.controller";
import { verifyJWT } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", verifyJWT, asyncHandler(approveLogin));

export default router;
