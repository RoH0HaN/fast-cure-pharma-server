import { Router } from "express";
import {
  createHeadquarter,
  createPlaces,
  getAllHeadquartersByRole,
  deleteHeadquarter,
  getPlacesByHeadquarter,
  deletePlace,
  editPlace,
  getHeadquarterNames,
} from "../controllers/headquarter.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/create-places").post(verifyJWT, createPlaces);
router.route("/edit-place").put(verifyJWT, editPlace);
router.route("/delete-place/:_id").delete(verifyJWT, deletePlace);
router
  .route("/get-places-by-headquarter/:_id")
  .get(verifyJWT, getPlacesByHeadquarter);

router.route("/create-headquarter").post(verifyJWT, createHeadquarter);
router.route("/delete-headquarter/:_id").delete(verifyJWT, deleteHeadquarter);
router.route("/get-headquarter-names").get(verifyJWT, getHeadquarterNames);
router
  .route("/get-headquarters-by-role")
  .get(verifyJWT, getAllHeadquartersByRole);

export default router;
