import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { approveLogin } from "../controllers/approve.controller";

const router = Router();

router.post("/", asyncHandler(approveLogin));

export default router;
