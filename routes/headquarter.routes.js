import { Router } from "express";
import {
  createHeadquarter,
  createPlaces,
  getAllHeadquartersByRole,
  deleteHeadquarter,
  getPlacesByHeadquarter,
  deletePlace,
  editPlace,
} from "../controllers/headquarter.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/create-headquarter").post(verifyJWT, createHeadquarter);
router.route("/create-places").post(verifyJWT, createPlaces);
router
  .route("/get-places-by-headquarter/:_id")
  .post(verifyJWT, getPlacesByHeadquarter);
router.route("/edit-place/:_id").post(verifyJWT, editPlace);
router.route("/delete-place/:_id").delete(verifyJWT, deletePlace);
router.route("/delete-headquarter/:_id").delete(verifyJWT, deleteHeadquarter);
router
  .route("/get-headquarters-by-role")
  .get(verifyJWT, getAllHeadquartersByRole);

export default router;
