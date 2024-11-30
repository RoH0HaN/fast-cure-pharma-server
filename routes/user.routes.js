import { Router } from "express";
import {
  create,
  createAdmin,
  login,
  changePassword,
  update,
  view,
  archive,
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

export default router;
