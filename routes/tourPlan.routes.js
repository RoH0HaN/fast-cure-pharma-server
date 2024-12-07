import { Router } from "express";
import {
  create,
  update,
  allowExtraDay,
  approveTourPlanDates,
  getTourPlan,
  getTourPlanForEdit,
} from "../controllers/tourPlan.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/create").post(verifyJWT, create);
router.route("/update").post(verifyJWT, update);
router.route("/allow-extra-day/:_id").put(verifyJWT, allowExtraDay);
router
  .route("/approve-tour-plan-dates/:_id")
  .put(verifyJWT, approveTourPlanDates);
router.route("/get-tour-plan").get(verifyJWT, getTourPlan);
router.route("/get-tour-plan-for-edit").get(verifyJWT, getTourPlanForEdit);

export default router;
