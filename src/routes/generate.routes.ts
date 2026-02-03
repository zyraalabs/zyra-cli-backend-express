import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { generate } from "../controllers/generate.controller";
import { verifyJWT } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", verifyJWT, asyncHandler(generate));

export default router;
