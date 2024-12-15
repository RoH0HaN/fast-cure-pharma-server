import { Router } from "express";
import {
  createDailyReport,
  createDailyReportFromTourPlan,
  createMeetingReport,
  createTrainingReport,
  createAdminDayReport,
  addDoctorReport,
  addCSReport,
  deleteDoctorReport,
  deleteCSReport,
  completeDoctorReportCall,
  completeCSReportCall,
  incompleteDoctorReportCall,
  incompleteCSReportCall,
  completeAnyDCRReport,
  deleteAnyDCRReport,
  updateStartLocationOfAnyDCRReport,
  getAvailableWeekOffDays,
  takeWeekOff,
  getDoctorAndCSReportsBetweenDates,
  getDCRAttendantReportsOfAnyYearsMonth,
  getMonthlyDCRReportStats,
  getFullDCRReport,
  getCurrentDCRReportStatuses,
  uploadCompleteCallPhoto,
} from "../controllers/dcr.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

//--- This API is for 'WORKING DAY', 'JOINING DAY', 'CAMP DAY' reports. --->
router.route("/create-daily-report").post(verifyJWT, createDailyReport);
//--- This API is for 'WORKING DAY' reports from 'TOUR PLAN'. --->
router
  .route("/create-daily-report-from-tour-plan")
  .post(verifyJWT, createDailyReportFromTourPlan);
//--- This API is for 'MEETING DAY' reports. --->
router.route("/create-meeting-report").post(verifyJWT, createMeetingReport);
//--- This API is for creating 'TRAINING DAY' reports. --->
router.route("/create-training-report").post(verifyJWT, createTrainingReport);
//--- This API is for creating 'ADMIN DAY' reports. --->
router.route("/create-admin-day-report").post(verifyJWT, createAdminDayReport);

//--- This API is for adding 'DOCTOR' and 'CS' reports. --->
router.route("/add-doctor-report").put(verifyJWT, addDoctorReport);
router.route("/add-cs-report").put(verifyJWT, addCSReport);
//--- This API is for adding 'DOCTOR' and 'CS' reports. --->

//--- This API is for deleting 'DOCTOR' and 'CS' reports. --->
router
  .route("/delete-doctor-report/:reportId")
  .delete(verifyJWT, deleteDoctorReport);
router.route("/delete-cs-report/:reportId").delete(verifyJWT, deleteCSReport);
//--- This API is for deleting 'DOCTOR' and 'CS' reports. --->

//--- This API is for completing 'DOCTOR' and 'CS' reports call. --->
router
  .route("/complete-doctor-report-call")
  .put(verifyJWT, completeDoctorReportCall);
router.route("/complete-cs-report-call").put(verifyJWT, completeCSReportCall);
//--- This API is for completing 'DOCTOR' and 'CS' reports call. --->

//--- This API is for in-completing 'DOCTOR' and 'CS' reports call. --->
router
  .route("/incomplete-doctor-report-call")
  .put(verifyJWT, incompleteDoctorReportCall);
router
  .route("/incomplete-cs-report-call")
  .put(verifyJWT, incompleteCSReportCall);
//--- This API is for in-completing 'DOCTOR' and 'CS' reports call. --->

//--- This API is for ENDING a report. --->
router.route("/complete-dcr-report").put(verifyJWT, completeAnyDCRReport); //END DAY

//--- This API is for deleting a report. --->
router
  .route("/delete-dcr-report/:reportId")
  .delete(verifyJWT, deleteAnyDCRReport);

//--- This API is for updating start location of any report. --->
router
  .route("/update-start-location")
  .put(verifyJWT, updateStartLocationOfAnyDCRReport);

//--- WEEK OFF API's --->
router.route("/take-week-off").post(verifyJWT, takeWeekOff);
router
  .route("/get-available-week-off-days")
  .get(verifyJWT, getAvailableWeekOffDays);
//--- WEEK OFF API's --->

//--- DCR ANALYSIS API's --->
router
  .route("/get-doctor-and-cs-reports-between-dates")
  .get(verifyJWT, getDoctorAndCSReportsBetweenDates);
router
  .route("/get-daily-dcr-attendant-reports")
  .get(verifyJWT, getDCRAttendantReportsOfAnyYearsMonth);
router
  .route("/get-monthly-dcr-report-stats")
  .get(verifyJWT, getMonthlyDCRReportStats);
//--- DCR ANALYSIS API's --->

//---CURRENT DCR REPORT API'S --->
router.route("/get-full-dcr-report/:reportId").get(verifyJWT, getFullDCRReport);
router
  .route("/get-current-dcr-report-statuses")
  .get(verifyJWT, getCurrentDCRReportStatuses);
//---CURRENT DCR REPORT API'S --->

//--- IMAGE UPLOAD API ONLY FOR ANDROID --->
router
  .route("/image/upload")
  .post(
    verifyJWT,
    upload.fields([{ name: "image", maxCount: 1 }]),
    uploadCompleteCallPhoto
  );

export default router;
