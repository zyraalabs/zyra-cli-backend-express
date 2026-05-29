import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { clarify } from "../controllers/clarify.controller";
import { verifyJWT } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", verifyJWT, asyncHandler(clarify));

export default router;
