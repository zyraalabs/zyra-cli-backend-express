import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { generate } from "../controllers/generate.controller";
import { verifyJWT, checkAndDeductCredit } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", verifyJWT, checkAndDeductCredit, asyncHandler(generate));

export default router;
