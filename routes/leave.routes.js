import { Router } from "express";
import {
  applyLeave,
  addLeave,
  approveLeave,
  getRemainingLeavesCount,
  deleteLeave,
  rejectLeave,
  getApprovedLeavesByEmployeeAndRange,
  getEmployeeLeaveMetrics,
  getPendingLeaves,
} from "../controllers/leave.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/apply-leave").post(verifyJWT, applyLeave);
router.route("/add-leave").post(verifyJWT, addLeave);
router.route("/approve-leave").put(verifyJWT, approveLeave);
router.route("/reject-leave").put(verifyJWT, rejectLeave);
router.route("/delete-leave").delete(verifyJWT, deleteLeave);
router.route("/get-pending-leaves").get(verifyJWT, getPendingLeaves);
router
  .route("/get-approved-leaves-by-employee-and-range")
  .get(verifyJWT, getApprovedLeavesByEmployeeAndRange);
router
  .route("/get-employee-leave-metrics/:_id")
  .get(verifyJWT, getEmployeeLeaveMetrics);
router
  .route("/get-remaining-leaves-count")
  .get(verifyJWT, getRemainingLeavesCount);

export default router;
