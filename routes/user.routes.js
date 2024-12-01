import { Router } from "express";
import {
  create,
  createAdmin,
  login,
  changePassword,
  update,
  view,
  archive,
  getEmployeesIdAndNameBasedOnRole,
  getDownlineEmployees,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/create").post(verifyJWT, create);
router.route("/update").put(verifyJWT, update);
router.route("/view/:_id").get(verifyJWT, view);
router.route("/create-admin").post(createAdmin);
router.route("/login").post(login);
router.route("/change-password").put(verifyJWT, changePassword);
router.route("/archive/:_id").put(verifyJWT, archive);
router.route("/get-downline-employees").get(verifyJWT, getDownlineEmployees);

// API's specific for Web App --->
router
  .route("/get-employees-id-and-name-based-on-role/:role")
  .get(verifyJWT, getEmployeesIdAndNameBasedOnRole);
// API's specific for Web App --->

export default router;
