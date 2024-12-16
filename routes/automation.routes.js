import { Router } from "express";
import {
  automateEmployeeLeaveAttendanceAndReport,
  automateResetLeaves,
} from "../controllers/automation.controller.js";

const router = Router();

router
  .route("/automate/leave-attendance-report")
  .get(automateEmployeeLeaveAttendanceAndReport);
router.route("/automate/reset-leaves").get(automateResetLeaves);

export default router;
