import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { repromptSelect } from "../controllers/repromptSelect.controller";
import { reprompt } from "../controllers/reprompt.controller";
import { verifyJWT } from "../middlewares/auth.middleware";

const router = Router();

router.post("/select", verifyJWT, asyncHandler(repromptSelect));
router.post("/", verifyJWT, asyncHandler(reprompt));

export default router;
