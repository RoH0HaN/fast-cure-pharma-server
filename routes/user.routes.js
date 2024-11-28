import { Router } from "express";
import {
  create,
  createAdmin,
  login,
  changePassword,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/create").post(verifyJWT, create);
router.route("/create-admin").post(createAdmin);
router.route("/login").post(login);
router.route("/change-password").put(verifyJWT, changePassword);

export default router;
