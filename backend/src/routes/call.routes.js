import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { saveCall, getCallHistory } from "../controllers/call.controllers.js";

const router = express.Router();

router.post("/save", saveCall);
router.get("/history", protectRoute, getCallHistory);

export default router;
