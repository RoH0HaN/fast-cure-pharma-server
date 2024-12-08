import { Router } from "express";
import {
  applyLeave,
  addLeave,
  approveLeave,
  getRemainingLeavesCount,
} from "../controllers/leave.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/apply-leave").post(verifyJWT, applyLeave);
router.route("/add-leave").post(verifyJWT, addLeave);
router.route("/approve-leave").post(verifyJWT, approveLeave);
router
  .route("/get-remaining-leaves-count")
  .get(verifyJWT, getRemainingLeavesCount);

export default router;
