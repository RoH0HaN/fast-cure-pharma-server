import { Router } from "express";
import { create, getAttendance } from "../controllers/attendance.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/create").post(verifyJWT, create);
router.route("/get-attendance").get(verifyJWT, getAttendance);

export default router;
