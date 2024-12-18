import { Router } from "express";
import {
  automateResetLeaves,
  automateResetTourPlanCreateAndApprove,
  automateEmployeeLeaveAttendanceAndReport,
} from "../controllers/automation.controller.js";

const router = Router();

router
  .route("/automate/leave-attendance-report")
  .get(automateEmployeeLeaveAttendanceAndReport);
router.route("/automate/reset-leaves").get(automateResetLeaves);
router
  .route("/automate/reset-tour-plan-create-and-approve")
  .get(automateResetTourPlanCreateAndApprove);

export default router;
