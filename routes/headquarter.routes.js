import { Router } from "express";
import {
  createHeadquarter,
  createPlaces,
  getAllHeadquartersByRole,
} from "../controllers/headquarter.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/create-headquarter").post(verifyJWT, createHeadquarter);
router.route("/create-places").post(verifyJWT, createPlaces);
router
  .route("/get-headquarters-by-role")
  .get(verifyJWT, getAllHeadquartersByRole);

export default router;
