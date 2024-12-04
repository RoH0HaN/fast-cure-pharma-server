import { Router } from "express";
import {
  createHoliday,
  deleteHoliday,
  getHolidays,
  getHolidaysById,
  updateHoliday,
  getHolidaysByYear,
} from "../controllers/holiday.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/create").post(verifyJWT, createHoliday);
router.route("/update").put(verifyJWT, updateHoliday);
router.route("/delete/:_id").delete(verifyJWT, deleteHoliday);
router.route("/get-holidays").get(verifyJWT, getHolidays);
router.route("/get-holidays-by-year/:year").get(verifyJWT, getHolidaysByYear);
router.route("/get-holidays-by-id/:_id").get(verifyJWT, getHolidaysById);

export default router;
