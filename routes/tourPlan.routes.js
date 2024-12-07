import { Router } from "express";
import { create } from "../controllers/tourPlan.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/create").post(create);

export default router;
