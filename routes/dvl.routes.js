import { Router } from "express";
import {
  create,
  requestDelete,
  requestUpdate,
  approve,
  reject,
  archive,
  getPendingDVLs,
  getApprovedDVLs,
} from "../controllers/dvl.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/create").post(verifyJWT, create);
router.route("/request-update").put(verifyJWT, requestUpdate);
router.route("/request-delete/:_id").put(verifyJWT, requestDelete);
router.route("/approve/:_id").put(verifyJWT, approve);
router.route("/reject/:_id").put(verifyJWT, reject);
router.route("/archive/:_id").put(verifyJWT, archive);
router.route("/get-pending-dvls").get(verifyJWT, getPendingDVLs);
router.route("/get-approved-dvls/:_id").get(verifyJWT, getApprovedDVLs);

export default router;
