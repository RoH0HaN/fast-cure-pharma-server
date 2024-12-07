import { Router } from "express";
import { create, update } from "../controllers/tourPlan.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/create").post(verifyJWT, create);
router.route("/update").post(verifyJWT, update);

export default router;
