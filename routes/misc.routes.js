import { Router } from "express";
import { create, getMiscellaneous } from "../controllers/misc.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/create").post(verifyJWT, create);
router.route("/get-miscellaneous").get(verifyJWT, getMiscellaneous);

export default router;
