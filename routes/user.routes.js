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
  //--- NOTICES SECTION API's --->
  createNotice,
  getNotices,
  deleteNotice,
  //--- NOTICES SECTION API's --->
  getEmployeesDataForTable,
  getUserDashboardCounts,
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

//--- NOTICES SECTION API's --->
router.route("/admin/create-notice").post(verifyJWT, createNotice);
router.route("/get-notices").get(verifyJWT, getNotices);
router.route("/admin/delete-notice/:_id").delete(verifyJWT, deleteNotice);
//--- NOTICES SECTION API's --->

//--- USER DASHBOARD API's --->
router
  .route("/get-user-dashboard-counts")
  .get(verifyJWT, getUserDashboardCounts);

// API's specific for Web App --->
router
  .route("/get-employees-data-for-table")
  .get(verifyJWT, getEmployeesDataForTable);
router
  .route("/get-employees-id-and-name-based-on-role/:role")
  .get(verifyJWT, getEmployeesIdAndNameBasedOnRole);
// API's specific for Web App --->

export default router;
