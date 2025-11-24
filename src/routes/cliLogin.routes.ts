import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { initLogin, checkStatus } from "../controllers/cliLogin.controller";

const router = Router();

router.post("/init", asyncHandler(initLogin));
router.get("/status", asyncHandler(checkStatus));

export default router;
