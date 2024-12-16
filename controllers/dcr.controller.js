import {
  getPlaceNameFromLocation,
  getWorkWithEmployeeId,
  checkForHoliday,
  updateDvlDoctorLocation,
  getTotalTravelingDistanceFromDCRReport,
  markAttendance,
  checkForWeekOffAndLeave,
  getAllLocationsOfSingleDCRReport,
  checkAndUpdatePrivilegedLeave,
} from "../util/helpers/dcr.helpers.js";
import { uploadImageToFirebase } from "../util/upload.images.firebase.js";
import { getDatesBetween } from "../util/helpers/leave.helpers.js";
import { ApiRes, validateFields } from "../util/api.response.js";
import { DCR } from "../models/dcr.models.js";
import { asyncHandler } from "../util/async.handler.js";
import { Logger } from "../util/logger.js";
import { User } from "../models/user.models.js";
import dayjs from "dayjs";
import { Attendance } from "../models/attendance.models.js";
import { DVL } from "../models/dvl.models.js";
import mongoose from "mongoose";

//--- This API is for 'WORKING DAY', 'JOINING DAY', 'CAMP DAY' reports. --->
const createDailyReport = asyncHandler(async (req, res) => {
  const { _id, name } = req.user;
  const { workStatus, startLocation, area } = req.body;

  if (!validateFields(req.body, ["workStatus", "startLocation", "area"], res))
    return;

  try {
    const reportDate = dayjs().format("YYYY-MM-DD");
    const existingReport = await DCR.findOne({
      createdBy: _id,
      reportDate,
    });

    if (existingReport) {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `${name}, A report already exists for ${reportDate}.`
          )
        );
    }

    startLocation.area = await getPlaceNameFromLocation(startLocation);
    const isHoliday = await checkForHoliday(reportDate);
    const newReport = new DCR({
      createdBy: _id,
      workStatus,
      startLocation,
      reportDate,
      isHoliday: isHoliday,
      area,
    });

    await newReport.save();

    Logger(
      `${name}'s ${workStatus} report for ${reportDate} has been created from near ${startLocation.area}.`
    );

    return res
      .status(201)
      .json(
        new ApiRes(
          201,
          newReport._id,
          `${name}, Your ${workStatus} report for ${reportDate} has been created with start location near ${startLocation.area}.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//--- This API is for 'WORKING DAY' reports from 'TOUR PLAN'. --->
const createDailyReportFromTourPlan = asyncHandler(async (req, res) => {
  const { _id, name } = req.user;
  const { reportDate, area } = req.body;

  if (!validateFields(req.body, ["reportDate", "area"], res)) return;

  try {
    const existingReport = await DCR.findOne({
      createdBy: _id,
      reportDate,
    });

    if (existingReport) {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `${name}, A report already exists for ${reportDate}.`
          )
        );
    }

    const isHoliday = await checkForHoliday(reportDate);
    const newReport = new DCR({
      createdBy: _id,
      workStatus: "WORKING DAY",
      reportDate,
      isHoliday: isHoliday,
      area,
    });

    await newReport.save();

    Logger(
      `${name}'s WORKING DAY report for ${reportDate} has been created from tour plan.`
    );

    return res
      .status(201)
      .json(
        new ApiRes(
          201,
          newReport._id,
          `${name}, Your WORKING DAY report for ${reportDate} has been created from tour plan.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//--- This API is for 'MEETING DAY' reports. --->
const createMeetingReport = asyncHandler(async (req, res) => {
  const { _id, name } = req.user;
  const { title, description, startDate, endDate } = req.body;

  // Validate required fields
  if (
    !validateFields(
      req.body,
      ["title", "description", "startDate", "endDate"],
      res
    )
  )
    return;

  try {
    // Validate and get all dates between start and end
    const meetingDayDates = getDatesBetween(startDate, endDate);

    if (meetingDayDates.error) {
      return res
        .status(400)
        .json(new ApiRes(400, null, meetingDayDates.message));
    }

    // Prepare an array of reports for batch insertion
    const reports = await Promise.all(
      meetingDayDates.dates.map(async (date) => ({
        createdBy: _id,
        workStatus: "MEETING DAY",
        reportDate: date,
        isMeeting: true,
        isHoliday: await checkForHoliday(date),
        meetingDetails: {
          title,
          description,
          startDate,
          endDate,
        },
      }))
    );

    // Use bulk insert for better performance
    await DCR.insertMany(reports);

    Logger(
      `${name}'s meeting report from ${startDate} to ${endDate} has been created.`
    );

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, your meeting report from ${startDate} to ${endDate} has been created.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//--- This API is for creating 'TRAINING DAY' reports. --->
const createTrainingReport = asyncHandler(async (req, res) => {
  const { _id, name, role } = req.user;
  const { area, workWithEmployee, startLocation } = req.body;

  const reportDate = dayjs().format("YYYY-MM-DD");

  // Validate required fields
  if (
    !validateFields(
      req.body,
      ["area", "workWithEmployee", "startLocation"],
      res
    )
  )
    return;

  try {
    // Check if a report already exists for the user
    const existingReport = await DCR.findOne({
      createdBy: _id,
      reportDate,
    }).lean();

    if (existingReport) {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `${name}, A report already exists for ${reportDate}.`
          )
        );
    }

    // Fetch the name of the start location area
    startLocation.area = await getPlaceNameFromLocation(startLocation);

    // Fetch details of the employee being worked with
    const workWithDetails = await getWorkWithEmployeeId(_id, workWithEmployee);

    if (
      workWithDetails.parentRole === "ADMIN" ||
      workWithEmployee !== workWithDetails.parentRole
    ) {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `Your requested work with employee is not found in your up line.`
          )
        );
    }

    let parentReportExists = false;

    if (workWithDetails.parentRole !== "ADMIN") {
      // Check if the parent's report already exists for the same date
      parentReportExists = await DCR.exists({
        createdBy: workWithDetails.parentId,
        reportDate,
      });

      if (parentReportExists) {
        return res
          .status(300)
          .json(
            new ApiRes(
              300,
              null,
              `Sorry ${name}, Your parent's report for ${reportDate} already exists.`
            )
          );
      }
    }

    const isHoliday = await checkForHoliday(reportDate);

    const weekOffAndLeaveStatus = await checkForWeekOffAndLeave(
      workWithDetails.parentId
    );

    if (weekOffAndLeaveStatus.isOnLeave || weekOffAndLeaveStatus.isWeekOff) {
      return res
        .status(401)
        .json(
          new ApiRes(
            401,
            null,
            `${workWithDetails.parentName} is on leave or week off. Cannot add training report with him.`
          )
        );
    }

    // Create parent report if required
    if (!parentReportExists && workWithDetails.parentRole !== "ADMIN") {
      const parentNewReport = new DCR({
        createdBy: workWithDetails.parentId,
        workStatus: "TRAINING DAY",
        reportDate,
        isHoliday,
        area,
        trainingReport: {
          area,
          workWithEmployeeRole: role,
          workWithEmployeeId: _id,
        },
      });

      await parentNewReport.save();
    }

    // Create the new report for the user
    const newDCRReport = new DCR({
      createdBy: _id,
      workStatus: "TRAINING DAY",
      reportDate,
      isHoliday,
      area,
      startLocation,
      trainingReport: {
        area,
        workWithEmployeeRole: workWithDetails.parentRole,
        workWithEmployeeId: workWithDetails.parentId,
      },
    });

    await newDCRReport.save();

    Logger(
      `${name}'s training report has been created with ${workWithEmployee} ${workWithDetails.parentName} at ${area}, starting from ${startLocation.area}.`
    );

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, your training report has been created with ${workWithEmployee} ${workWithDetails.parentName}.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//--- This API is for creating 'ADMIN DAY' reports. --->
const createAdminDayReport = asyncHandler(async (req, res) => {
  const { _id, name } = req.user;
  const { startLocation } = req.body;

  // Validate required fields
  if (!validateFields(req.body, ["startLocation"], res)) return;

  try {
    const reportDate = dayjs().format("YYYY-MM-DD");
    const existingReport = await DCR.findOne({
      createdBy: _id,
      reportDate,
    });

    if (existingReport) {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `${name}, A report already exists for ${reportDate}.`
          )
        );
    }

    startLocation.area = await getPlaceNameFromLocation(startLocation);

    const isHoliday = await checkForHoliday(reportDate);

    const newReport = new DCR({
      createdBy: _id,
      workStatus: "ADMIN DAY",
      startLocation,
      endLocation: startLocation,
      reportDate,
      isHoliday: isHoliday,
      reportStatus: "COMPLETE",
    });

    const attendanceStatus = await markAttendance(_id, name, "ADMIN DAY");

    if (!attendanceStatus) {
      return res
        .status(300)
        .json(
          new ApiRes(
            300,
            null,
            `Sorry, ${name}, Your attendance is already exists for 'ADMIN DAY' for ${reportDate}.`
          )
        );
    }

    await newReport.save();

    Logger(
      `${name}'s ADMIN DAY report for ${reportDate} has been created from near ${startLocation.area}.`
    );

    return res
      .status(200)
      .json(
        new ApiRes(200, null, `${name}, Today is marked as ADMIN DAY for you.`)
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//--- This API is for 'DOCTOR's' reports creation for up lines too if work with existed in the up line [for up line it's auto-create]. --->
const addDoctorReport = asyncHandler(async (req, res) => {
  const { _id, name, role } = req.user;
  const {
    reportId,
    doctor,
    area,
    prodOne,
    prodTwo,
    prodThree,
    prodFour,
    workWithEmployee,
  } = req.body;

  // Validate required fields
  if (
    !validateFields(
      req.body,
      [
        "reportId",
        "doctor",
        "area",
        "prodOne",
        "prodTwo",
        "prodThree",
        "prodFour",
        "workWithEmployee",
      ],
      res
    )
  )
    return;

  try {
    // Fetch the existing report
    const existingReport = await DCR.findById(reportId).lean();
    if (!existingReport) {
      return res.status(404).json(new ApiRes(404, null, `Report not found.`));
    }

    // Generate a unique ID for the doctor report
    const doctorReportId = new mongoose.Types.ObjectId();

    // Prepare the doctor report object
    const doctorReport = {
      _id: doctorReportId,
      doctor,
      area,
      prodOne: prodOne !== "" ? prodOne : "N/A",
      prodTwo: prodTwo !== "" ? prodTwo : "N/A",
      prodThree: prodThree !== "" ? prodThree : "N/A",
      prodFour: prodFour !== "" ? prodFour : "N/A",
    };

    // If workWithEmployee is "SELF", add doctor only to the current user's report
    if (workWithEmployee === "SELF") {
      await DCR.findByIdAndUpdate(
        reportId,
        {
          $push: {
            doctorReports: {
              ...doctorReport,
              workWithEmployeeRole: role,
              workWithEmployeeId: _id,
            },
          },
        },
        { new: true }
      );

      Logger(
        `${name}'s doctor report added to the report for ${existingReport.reportDate}.`
      );
      return res
        .status(200)
        .json(
          new ApiRes(
            200,
            null,
            `A doctor report added to your report for ${existingReport.reportDate}.`
          )
        );
    }

    // If workWithEmployee is not "SELF", find parent details
    const workWithDetails = await getWorkWithEmployeeId(_id, workWithEmployee);

    if (
      workWithDetails.parentRole === "ADMIN" ||
      workWithEmployee !== workWithDetails.parentRole
    ) {
      return res
        .status(401)
        .json(
          new ApiRes(
            401,
            null,
            `Your requested work with employee is not found in your up line.`
          )
        );
    }

    const weekOffAndLeaveStatus = await checkForWeekOffAndLeave(
      workWithDetails.parentId
    );

    if (weekOffAndLeaveStatus.isOnLeave || weekOffAndLeaveStatus.isWeekOff) {
      return res
        .status(401)
        .json(
          new ApiRes(
            401,
            null,
            `${workWithDetails.parentName} is on leave or week off. Cannot add doctor report with him.`
          )
        );
    }

    // Add doctor to the user's report with parent role and ID
    await DCR.findByIdAndUpdate(
      reportId,
      {
        $push: {
          doctorReports: {
            ...doctorReport,
            workWithEmployeeRole: workWithDetails.parentRole,
            workWithEmployeeId: workWithDetails.parentId,
          },
        },
      },
      { new: true }
    );

    // If the parent is not "ADMIN", handle the parent's report
    if (workWithDetails.parentRole !== "ADMIN") {
      // Check if the parent's report already exists for the same date
      const parentReport = await DCR.findOne({
        createdBy: workWithDetails.parentId,
        reportDate: existingReport.reportDate,
      }).lean();

      if (parentReport) {
        // Parent's report exists, so add the doctor to their report
        await DCR.findByIdAndUpdate(
          parentReport._id,
          {
            $push: {
              doctorReports: {
                ...doctorReport,
                workWithEmployeeRole: role,
                workWithEmployeeId: _id,
              },
            },
          },
          { new: true }
        );
      } else {
        const isHoliday = await checkForHoliday(existingReport.reportDate);
        // Parent's report doesn't exist, so create a new one
        const parentNewReport = new DCR({
          createdBy: workWithDetails.parentId,
          workStatus: existingReport.workStatus,
          reportDate: existingReport.reportDate,
          isHoliday: isHoliday,
          area: existingReport.area,
          isMeeting: existingReport.isMeeting || false,
          meetingDetails: existingReport.meetingDetails || null,
          doctorReports: [
            {
              ...doctorReport,
              workWithEmployeeRole: role,
              workWithEmployeeId: _id,
            },
          ],
        });

        await parentNewReport.save();
      }
    }

    Logger(
      `${name}'s doctor report added to the report for ${existingReport.reportDate} with parent ${workWithDetails.parentName}.`
    );
    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `A doctor report added to your report and your parent's report for ${existingReport.reportDate}.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//--- This API is for 'CHEMIST/STOCKIST's [CS]' reports creation for up lines too if work with existed in the up line [for up line it's auto-create]. --->
const addCSReport = asyncHandler(async (req, res) => {
  const { _id, name, role } = req.user;
  const { reportId, visitType, csName, area, workWithEmployee } = req.body;

  // Validate required fields
  if (
    !validateFields(
      req.body,
      ["reportId", "area", "visitType", "csName", "workWithEmployee"],
      res
    )
  )
    return;

  try {
    // Fetch the existing report
    const existingReport = await DCR.findById(reportId).lean();
    if (!existingReport) {
      return res.status(404).json(new ApiRes(404, null, `Report not found.`));
    }

    // Generate a unique ID for the doctor report
    const doctorReportId = new mongoose.Types.ObjectId();

    // Prepare the doctor report object
    const csReport = {
      _id: doctorReportId,
      visitType,
      area,
      name: csName,
    };

    // If workWithEmployee is "SELF", add doctor only to the current user's report
    if (workWithEmployee === "SELF") {
      await DCR.findByIdAndUpdate(
        reportId,
        {
          $push: {
            csReports: {
              ...csReport,
              workWithEmployeeRole: role,
              workWithEmployeeId: _id,
            },
          },
        },
        { new: true }
      );

      Logger(
        `${name}'s ${visitType} report added to the report for ${existingReport.reportDate}.`
      );
      return res
        .status(200)
        .json(
          new ApiRes(
            200,
            null,
            `A ${visitType} report added to your report for ${existingReport.reportDate}.`
          )
        );
    }

    // If workWithEmployee is not "SELF", find parent details
    const workWithDetails = await getWorkWithEmployeeId(_id, workWithEmployee);

    if (
      workWithDetails.parentRole === "ADMIN" ||
      workWithEmployee !== workWithDetails.parentRole
    ) {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `Your requested work with employee is not found in your up line.`
          )
        );
    }

    const weekOffAndLeaveStatus = await checkForWeekOffAndLeave(
      workWithDetails.parentId
    );

    if (weekOffAndLeaveStatus.isOnLeave || weekOffAndLeaveStatus.isWeekOff) {
      return res
        .status(401)
        .json(
          new ApiRes(
            401,
            null,
            `${workWithDetails.parentName} is on leave or week off. Cannot add CS report with him.`
          )
        );
    }

    // Add doctor to the user's report with parent role and ID
    await DCR.findByIdAndUpdate(
      reportId,
      {
        $push: {
          csReports: {
            ...csReport,
            workWithEmployeeRole: workWithDetails.parentRole,
            workWithEmployeeId: workWithDetails.parentId,
          },
        },
      },
      { new: true }
    );

    // If the parent is not "ADMIN", handle the parent's report
    if (workWithDetails.parentRole !== "ADMIN") {
      // Check if the parent's report already exists for the same date
      const parentReport = await DCR.findOne({
        createdBy: workWithDetails.parentId,
        reportDate: existingReport.reportDate,
      }).lean();

      if (parentReport) {
        // Parent's report exists, so add the doctor to their report
        await DCR.findByIdAndUpdate(
          parentReport._id,
          {
            $push: {
              csReports: {
                ...csReport,
                workWithEmployeeRole: role,
                workWithEmployeeId: _id,
              },
            },
          },
          { new: true }
        );
      } else {
        const isHoliday = await checkForHoliday(existingReport.reportDate);
        // Parent's report doesn't exist, so create a new one
        const parentNewReport = await Promise.all(
          new DCR({
            createdBy: workWithDetails.parentId,
            workStatus: existingReport.workStatus,
            reportDate: existingReport.reportDate,
            isHoliday: isHoliday,
            isMeeting: existingReport.isMeeting || false,
            meetingDetails: existingReport.meetingDetails || null,
            csReports: [
              {
                ...csReport,
                workWithEmployeeRole: role,
                workWithEmployeeId: _id,
              },
            ],
          })
        );

        await parentNewReport.save();
      }
    }

    Logger(
      `${name}'s ${visitType} report added to the report for ${existingReport.reportDate} with parent ${workWithDetails.parentName}.`
    );
    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `A ${visitType} report added to your report and your parent's report for ${existingReport.reportDate}.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//--- This API is for 'DOCTOR's' reports deletion for up lines too if work with existed in the up line [for up line it's auto-delete]. --->
const deleteDoctorReport = asyncHandler(async (req, res) => {
  const { _id: userId, name } = req.user;
  const reportId = req.params.reportId;

  if (!reportId) {
    return res
      .status(400)
      .json(new ApiRes(400, null, "Report ID is required."));
  }

  try {
    // Fetch the report and relevant doctor report in a single query
    const existingReport = await DCR.findOne({
      createdBy: userId,
      "doctorReports._id": reportId,
    }).lean();

    if (!existingReport) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `No doctor report found with Report ID: ${reportId}.`
          )
        );
    }

    const doctorReport = existingReport.doctorReports.find(
      (r) => r._id.toString() === reportId
    );

    if (!doctorReport) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `No doctor report found with Report ID: ${reportId}.`
          )
        );
    }

    // Check if the current user is associated with the doctor report
    if (doctorReport.workWithEmployeeId.toString() !== userId.toString()) {
      // Check if the parent has the report with the same doctor report ID
      const parentReport = await DCR.findOne({
        createdBy: doctorReport.workWithEmployeeId,
        "doctorReports._id": reportId,
      });

      if (!parentReport) {
        return res
          .status(400)
          .json(
            new ApiRes(
              400,
              null,
              `No doctor report not found in your up line as you are working with ${doctorReport.workWithEmployeeRole}.`
            )
          );
      }

      // Remove the doctor report from the parent's report
      await DCR.updateOne(
        {
          createdBy: doctorReport.workWithEmployeeId,
          "doctorReports._id": reportId,
        },
        { $pull: { doctorReports: { _id: reportId } } }
      );
    }

    // Remove the doctor report from the user's report
    await DCR.updateOne(
      { createdBy: userId, "doctorReports._id": reportId },
      { $pull: { doctorReports: { _id: reportId } } }
    );

    Logger(`${name} removed a doctor report with ID ${reportId}.`, "info");
    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, Doctor report with ID ${reportId} deleted.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//--- This API is for 'CHEMIST/STOCKIST's [CS]' reports deletion for up lines too if work with existed in the up line [for up line it's auto-delete]. --->
const deleteCSReport = asyncHandler(async (req, res) => {
  const { _id: userId, name } = req.user;
  const reportId = req.params.reportId;

  if (!reportId) {
    return res
      .status(400)
      .json(new ApiRes(400, null, "Report ID is required."));
  }

  try {
    // Fetch the report and relevant CS report in a single query
    const existingReport = await DCR.findOne({
      createdBy: userId,
      "csReports._id": reportId,
    }).lean();

    if (!existingReport) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `No Chemist/Stockist report found with Report ID: ${reportId}.`
          )
        );
    }

    const csReport = existingReport.csReports.find(
      (r) => r._id.toString() === reportId
    );

    if (!csReport) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `No Chemist/Stockist report found with Report ID: ${reportId}.`
          )
        );
    }

    // Check if the current user is associated with the doctor report
    if (csReport.workWithEmployeeId.toString() !== userId.toString()) {
      // Check if the parent has the report with the same doctor report ID
      const parentReport = await DCR.findOne({
        createdBy: csReport.workWithEmployeeId,
        "csReports._id": reportId,
      });

      if (!parentReport) {
        return res
          .status(400)
          .json(
            new ApiRes(
              400,
              null,
              `No Chemist/Stockist report not found in your up line as you are working with ${csReport.workWithEmployeeRole}.`
            )
          );
      }

      // Remove the doctor report from the parent's report
      await DCR.updateOne(
        {
          createdBy: csReport.workWithEmployeeId,
          "csReports._id": reportId,
        },
        { $pull: { csReports: { _id: reportId } } }
      );
    }

    // Remove the doctor report from the user's report
    await DCR.updateOne(
      { createdBy: userId, "csReports._id": reportId },
      { $pull: { csReports: { _id: reportId } } }
    );

    Logger(
      `${name} removed a Chemist/Stockist report with ID ${reportId}.`,
      "info"
    );
    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, Chemist/Stockist report with ID ${reportId} deleted.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//--- This API is for 'DOCTOR's [DR]' reports completion for a particular User. --->
const completeDoctorReportCall = asyncHandler(async (req, res) => {
  const { _id: userId, name, role } = req.user;
  const { reportId, imageUrl, location } = req.body;

  if (imageUrl == undefined || imageUrl == null) imageUrl = "";

  if (!validateFields(req.body, ["reportId", "location"], res)) return;

  try {
    // Fetch the report and relevant doctor report in a single query
    const existingReport = await DCR.findOne({
      createdBy: userId,
      "doctorReports._id": reportId,
    }).lean();

    if (!existingReport) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `No doctor report found with Report ID: ${reportId}.`
          )
        );
    }

    const doctorReport = existingReport.doctorReports.find(
      (r) => r._id.toString() === reportId.toString()
    );

    if (!doctorReport) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `No doctor report found with Report ID: ${reportId}.`
          )
        );
    }

    if (
      doctorReport.workWithEmployeeId.toString() !== userId.toString() &&
      role !== "TBM"
    ) {
      // Check if the parent has the report with the same doctor report ID
      const parentReport = await DCR.findOne({
        createdBy: doctorReport.workWithEmployeeId,
        "doctorReports._id": reportId,
      });

      if (!parentReport) {
        return res
          .status(400)
          .json(
            new ApiRes(
              400,
              null,
              `No doctor report not found in your up line as you are working with ${doctorReport.workWithEmployeeRole}.`
            )
          );
      }

      const parentDoctorReport = parentReport.doctorReports.find(
        (r) => r._id.toString() === reportId.toString()
      );

      if (
        ["INCOMPLETE CALL", "PENDING"].includes(parentDoctorReport.reportStatus)
      ) {
        return res
          .status(400)
          .json(
            new ApiRes(
              400,
              null,
              `You can't complete this report as the person working with you has his report status : ${parentDoctorReport.reportStatus}.`
            )
          );
      }
    }

    await updateDvlDoctorLocation(doctorReport.doctor, location);

    await DCR.updateOne(
      { createdBy: userId, "doctorReports._id": reportId },
      {
        $set: {
          "doctorReports.$.reportStatus": "COMPLETE CALL",
          "doctorReports.$.image": imageUrl,
          "doctorReports.$.location": location,
          "doctorReports.$.completedAt": Date.now(),
        },
      }
    );

    Logger(`${name} completed a doctor report with ID ${reportId}.`, "info");
    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, Doctor report with ID ${reportId} mark as completed.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//--- This API is for 'CHEMIST/STOCKIST's [CS]' reports completion for a particular User. --->
const completeCSReportCall = asyncHandler(async (req, res) => {
  const { _id: userId, name, role } = req.user;
  const { reportId, imageUrl, location } = req.body;

  if (imageUrl == undefined || imageUrl == null) imageUrl = "";

  if (!validateFields(req.body, ["reportId", "location"], res)) return;

  try {
    // Fetch the report and relevant doctor report in a single query
    const existingReport = await DCR.findOne({
      createdBy: userId,
      "csReports._id": reportId,
    }).lean();

    if (!existingReport) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `No doctor report found with Report ID: ${reportId}.`
          )
        );
    }

    const csReport = existingReport.csReports.find(
      (r) => r._id.toString() === reportId.toString()
    );

    if (!csReport) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `No Chemist/Stockist report found with Report ID: ${reportId}.`
          )
        );
    }

    if (
      csReport.workWithEmployeeId.toString() !== userId.toString() &&
      role !== "TBM"
    ) {
      // Check if the parent has the report with the same doctor report ID
      const parentReport = await DCR.findOne({
        createdBy: csReport.workWithEmployeeId,
        "csReports._id": reportId,
      });

      if (!parentReport) {
        return res
          .status(400)
          .json(
            new ApiRes(
              400,
              null,
              `No Chemist/Stockist report not found in your up line as you are working with ${csReport.workWithEmployeeRole}.`
            )
          );
      }

      const parentCsReport = parentReport.csReports.find(
        (r) => r._id.toString() === reportId.toString()
      );

      if (
        ["INCOMPLETE CALL", "PENDING"].includes(parentCsReport.reportStatus)
      ) {
        return res
          .status(400)
          .json(
            new ApiRes(
              400,
              null,
              `You can't complete this report as the person working with you has his report status : ${parentCsReport.reportStatus}.`
            )
          );
      }
    }

    await DCR.updateOne(
      { createdBy: userId, "csReports._id": reportId },
      {
        $set: {
          "csReports.$.reportStatus": "COMPLETE CALL",
          "csReports.$.image": imageUrl,
          "csReports.$.location": location,
          "csReports.$.completedAt": Date.now(),
        },
      }
    );

    Logger(
      `${name} completed a Chemist/Stockist report with ID ${reportId}.`,
      "info"
    );
    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, Chemist/Stockist report with ID ${reportId} mark as completed.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//--- This API is for 'DOCTOR's [DR]' reports incompletion for a particular User. --->
const incompleteDoctorReportCall = asyncHandler(async (req, res) => {
  const { _id: userId, name, role } = req.user;
  const { reportId, remarks } = req.body;

  if (!validateFields(req.body, ["reportId", "remarks"], res)) return;

  try {
    // Fetch the report and relevant doctor report in a single query
    const existingReport = await DCR.findOne({
      createdBy: userId,
      "doctorReports._id": reportId,
    }).lean();

    if (!existingReport) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `No doctor report found with Report ID: ${reportId}.`
          )
        );
    }

    const doctorReport = existingReport.doctorReports.find(
      (r) => r._id.toString() === reportId.toString()
    );

    if (!doctorReport) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `No doctor report found with Report ID: ${reportId}.`
          )
        );
    }

    if (
      doctorReport.workWithEmployeeId.toString() !== userId.toString() &&
      role !== "TBM"
    ) {
      // Check if the parent has the report with the same doctor report ID
      const parentReport = await DCR.findOne({
        createdBy: doctorReport.workWithEmployeeId,
        "doctorReports._id": reportId,
      });

      if (!parentReport) {
        return res
          .status(400)
          .json(
            new ApiRes(
              400,
              null,
              `No doctor report not found in your up line as you are working with ${doctorReport.workWithEmployeeRole}.`
            )
          );
      }

      const parentDoctorReport = parentReport.doctorReports.find(
        (r) => r._id.toString() === reportId.toString()
      );

      if (
        ["COMPLETE CALL", "PENDING"].includes(parentDoctorReport.reportStatus)
      ) {
        return res
          .status(400)
          .json(
            new ApiRes(
              400,
              null,
              `You can't incomplete this report as the person working with you has his report status : ${parentDoctorReport.reportStatus}.`
            )
          );
      }
    }

    await DCR.updateOne(
      { createdBy: userId, "doctorReports._id": reportId },
      {
        $set: {
          "doctorReports.$.reportStatus": "INCOMPLETE CALL",
          "doctorReports.$.remarks": remarks,
          "doctorReports.$.completedAt": Date.now(),
        },
      }
    );

    Logger(`${name} incomplete'd a doctor report with ID ${reportId}.`, "info");
    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, Doctor report with ID ${reportId} mark as incomplete.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//--- This API is for 'CHEMIST/STOCKIST's [CS]' reports incompletion for a particular User. --->
const incompleteCSReportCall = asyncHandler(async (req, res) => {
  const { _id: userId, name, role } = req.user;
  const { reportId, remarks } = req.body;

  if (!validateFields(req.body, ["reportId", "remarks"], res)) return;

  try {
    // Fetch the report and relevant doctor report in a single query
    const existingReport = await DCR.findOne({
      createdBy: userId,
      "csReports._id": reportId,
    }).lean();

    if (!existingReport) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `No doctor report found with Report ID: ${reportId}.`
          )
        );
    }

    const csReport = existingReport.csReports.find(
      (r) => r._id.toString() === reportId.toString()
    );

    if (!csReport) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `No Chemist/Stockist report found with Report ID: ${reportId}.`
          )
        );
    }

    if (
      csReport.workWithEmployeeId.toString() !== userId.toString() &&
      role !== "TBM"
    ) {
      // Check if the parent has the report with the same doctor report ID
      const parentReport = await DCR.findOne({
        createdBy: csReport.workWithEmployeeId,
        "csReports._id": reportId,
      });

      if (!parentReport) {
        return res
          .status(400)
          .json(
            new ApiRes(
              400,
              null,
              `No Chemist/Stockist report not found in your up line as you are working with ${csReport.workWithEmployeeRole}.`
            )
          );
      }

      const parentCsReport = parentReport.csReports.find(
        (r) => r._id.toString() === reportId.toString()
      );

      if (["COMPLETE CALL", "PENDING"].includes(parentCsReport.reportStatus)) {
        return res
          .status(400)
          .json(
            new ApiRes(
              400,
              null,
              `You can't incomplete this report as the person working with you has his report status : ${parentCsReport.reportStatus}.`
            )
          );
      }
    }

    await DCR.updateOne(
      { createdBy: userId, "csReports._id": reportId },
      {
        $set: {
          "csReports.$.reportStatus": "INCOMPLETE CALL",
          "csReports.$.remarks": remarks,
          "csReports.$.completedAt": Date.now(),
        },
      }
    );

    Logger(
      `${name} incomplete'd a Chemist/Stockist report with ID ${reportId}.`,
      "info"
    );
    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, Chemist/Stockist report with ID ${reportId} mark as incomplete.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//--- This API is used to end the working day [COMPLETE THE DCR REPORT BY USER] --->
const completeAnyDCRReport = asyncHandler(async (req, res) => {
  const { _id: userId, name } = req.user;
  const { reportId, endLocation } = req.body;

  try {
    const dcrReport = await DCR.findById(reportId);

    if (!dcrReport) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `Sorry, ${name}, You don't have a DCR report for ${reportId}.`
          )
        );
    }

    const areAllReportsCompleted = (reports) =>
      reports.length === 0 ||
      reports.every(
        (report) =>
          report.completedAt &&
          (report.reportStatus === "COMPLETE CALL" ||
            report.reportStatus === "INCOMPLETE CALL")
      );

    if (
      !areAllReportsCompleted(dcrReport.doctorReports) ||
      !areAllReportsCompleted(dcrReport.csReports)
    ) {
      return res
        .status(300)
        .json(
          new ApiRes(
            300,
            null,
            `Sorry, ${name}, You have not completed all the DCR reports.`
          )
        );
    }

    const totalTravelingDistance = await getTotalTravelingDistanceFromDCRReport(
      reportId,
      endLocation
    );
    endLocation.area = await getPlaceNameFromLocation(endLocation);
    dcrReport.endLocation = endLocation;
    dcrReport.totalDistance = totalTravelingDistance;
    dcrReport.reportStatus = "COMPLETE";

    const attendanceStatus = await markAttendance(
      userId,
      name,
      dcrReport.workStatus
    );

    if (!attendanceStatus) {
      return res
        .status(300)
        .json(
          new ApiRes(
            300,
            null,
            `Sorry, ${name}, Your attendance is already exists for ${dcrReport.workStatus} for ${dcrReport.reportDate}.`
          )
        );
    }

    await dcrReport.save();

    // Check that total 15 reports is completed or not to increase PL COUNT by 1
    await checkAndUpdatePrivilegedLeave(userId);

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `Well done ${name}, You've completed your current DCR report and your attendance has been marked. You traveled ${totalTravelingDistance} kms today.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//--- This API is used to delete any DCR report [DELETE THE DCR REPORT BY USER] --->
const deleteAnyDCRReport = asyncHandler(async (req, res) => {
  const { _id: userId, name } = req.user;
  const reportId = req.params.reportId;

  if (!reportId) {
    return res
      .status(400)
      .json(new ApiRes(400, null, "Report ID is required."));
  }

  try {
    const dcrReport = await DCR.findById(reportId);

    if (!dcrReport) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `Sorry, ${name}, You don't have a DCR report for ${reportId}.`
          )
        );
    }

    if (dcrReport.doctorReports.length > 0 || dcrReport.csReports.length > 0) {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `Sorry, ${name}, You can't delete this report, because it has ${dcrReport.doctorReports.length} doctor reports and ${dcrReport.csReports.length} Chemist/Stockist reports.`
          )
        );
    }

    if (dcrReport.createdBy.toString() !== userId.toString()) {
      return res
        .status(403)
        .json(
          new ApiRes(
            403,
            null,
            `Sorry, ${name}, You don't have permission to delete this DCR report.`
          )
        );
    }

    await DCR.findByIdAndDelete(reportId);

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, Your DCR report with ID ${reportId} deleted.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//--- UPDATE START LOCATION OF ANY DCR REPORT --->
const updateStartLocationOfAnyDCRReport = asyncHandler(async (req, res) => {
  const { name } = req.user;
  const { reportId, startLocation } = req.body;

  if (!validateFields(req.body, ["reportId", "startLocation"], res)) return;

  try {
    const dcrReport = await DCR.findById(reportId);

    if (!dcrReport) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `Sorry, ${name}, You don't have a DCR report for ${reportId}.`
          )
        );
    }

    startLocation.area = await getPlaceNameFromLocation(startLocation);

    dcrReport.startLocation = startLocation;
    await dcrReport.save();

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, Your start location updated for your current DCR report.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//--- WEEK OFF API's --->
const getAvailableWeekOffDays = asyncHandler(async (req, res) => {
  const { _id: userId, name } = req.user;

  try {
    const [year, month] = dayjs().format("YYYY-MM").split("-");

    // Optimized query: Fetch attendance and DCR reports in one go
    const [existingAttendance, currentMonthDCRReports] = await Promise.all([
      Attendance.findOne({ empId: userId }),
      DCR.find({
        createdBy: userId,
        reportStatus: "COMPLETE",
        isHoliday: true,
        reportDate: {
          $gte: `${year}-${month}-01`,
          $lt: `${year}-${month}-31`,
        },
      }),
    ]);

    // Extract used week-off dates from attendance
    const usedWeekOffDates = Object.values(
      existingAttendance?.attendance?.[year]?.[month] || {}
    )
      .filter((item) => item.title === "WEEK OFF" && item.date)
      .map((item) => item.date);

    // Filter week-off days from DCR reports
    const weekOffDays = currentMonthDCRReports
      .map((report) => report.reportDate)
      .filter((reportDate) => !usedWeekOffDates.includes(reportDate));

    if (weekOffDays.length === 0) {
      return res
        .status(300)
        .json(
          new ApiRes(
            300,
            null,
            `Sorry, ${name}, You don't have week off days in this month.`
          )
        );
    }

    return res.status(200).json(new ApiRes(200, weekOffDays, ""));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const takeWeekOff = asyncHandler(async (req, res) => {
  const { _id: userId, name } = req.user;
  const { weekOffDate } = req.body;

  if (!validateFields(req.body, ["weekOffDate"], res)) return;

  try {
    const currentMonth = dayjs().format("YYYY-MM");
    const weekOffMonth = dayjs(weekOffDate).format("YYYY-MM");

    if (currentMonth !== weekOffMonth) {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `Sorry, ${name}, You can't take week off on ${weekOffDate}, It is not in the current month.`
          )
        );
    }

    const today = dayjs().format("YYYY-MM-DD");
    const [year, month, day] = today.split("-");

    const [dcrReports, existingAttendance] = await Promise.all([
      DCR.findOne({
        createdBy: userId,
        reportStatus: "COMPLETE",
        isHoliday: true,
        reportDate: weekOffDate,
      }),
      Attendance.findOne({ empId: userId }),
    ]);

    if (!dcrReports) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `Sorry, ${name}, You don't have a DCR report for ${weekOffDate}.`
          )
        );
    }

    if (!existingAttendance) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `Sorry, ${name}, Your attendance record not found.`
          )
        );
    }

    const monthAttendance =
      existingAttendance?.attendance?.[year]?.[month] || {};

    const alreadyUsedWeekOff = Object.values(monthAttendance).some(
      (item) => item.date === weekOffDate && item.title === "WEEK OFF"
    );

    if (alreadyUsedWeekOff) {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `Sorry, ${name}, You already used a week off for ${weekOffDate}.`
          )
        );
    }

    existingAttendance.attendance[year][month][today] = {
      title: "WEEK OFF",
      date: weekOffDate,
    };

    existingAttendance.markModified("attendance");
    await existingAttendance.save();

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, Today is marked as a week off for you against ${weekOffDate}.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});
//--- WEEK OFF API's --->

//---VIEW DCR FROM-TO DATE API's --->
const getDoctorAndCSReportsBetweenDates = asyncHandler(async (req, res) => {
  const { name } = req.user;
  const { _id: userId, fromDate, toDate } = req.query;

  if (!validateFields(req.query, ["_id", "fromDate", "toDate"], res)) return;

  try {
    const dcrReports = await DCR.find({
      createdBy: userId,
      reportDate: { $gte: fromDate, $lte: toDate },
    })
      .select("doctorReports csReports")
      .populate({
        path: "doctorReports.doctor",
        select: "docName",
      });

    if (!dcrReports) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `Sorry, ${name}, You don't have any DCR reports between ${fromDate} and ${toDate}.`
          )
        );
    }

    const doctorReports = dcrReports.flatMap((dcr) => dcr.doctorReports);
    const csReports = dcrReports.flatMap((dcr) => dcr.csReports);

    return res
      .status(201)
      .json(
        new ApiRes(
          201,
          { doctorReports, csReports },
          `${name}, Reports found between ${fromDate} and ${toDate}.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//---GET DAILY DCR ATTENDANCE API'S --->
const getDCRAttendantReportsOfAnyYearsMonth = asyncHandler(async (req, res) => {
  const { name } = req.user;
  const { _id: userId, year, month } = req.query;

  try {
    // Generate start and end dates for the month
    const startOfMonth = `${year}-${month}-01`;
    const endOfMonth = `${year}-${month}-31`;

    // Query only the necessary fields to reduce database load
    const dcrReports = await DCR.find(
      {
        createdBy: userId,
        reportDate: { $gte: startOfMonth, $lt: endOfMonth },
        reportStatus: "COMPLETE",
      },
      {
        _id: 1,
        area: 1,
        workStatus: 1,
        reportDate: 1,
        doctorReports: 1,
        csReports: 1,
      }
    );

    // If no reports found, return early
    if (!dcrReports || dcrReports.length === 0) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `Sorry, ${name}, The user doesn't have any DCR reports for ${year}-${month}.`
          )
        );
    }

    // Process DCR reports to calculate attendant reports
    const totalAttendantReports = dcrReports.map((dcr) => {
      const doctorReportCount =
        dcr.doctorReports?.filter(
          (report) => report.reportStatus === "COMPLETE CALL"
        ).length || 0;

      const csReportCount =
        dcr.csReports?.filter(
          (report) => report.reportStatus === "COMPLETE CALL"
        ).length || 0;

      const doctorReportWorkWithOthersCount =
        dcr.doctorReports?.filter(
          (report) =>
            report.reportStatus === "COMPLETE CALL" &&
            report.workWithEmployeeId !== userId
        ).length || 0;

      const csReportWorkWithOthersCount =
        dcr.csReports?.filter(
          (report) =>
            report.reportStatus === "COMPLETE CALL" &&
            report.workWithEmployeeId !== userId
        ).length || 0;

      return {
        _id: dcr._id,
        area: dcr.area == "" ? "IN MEETING" : dcr.area,
        reportDate: dcr.reportDate,
        day: dayjs(dcr.reportDate).format("dddd").toUpperCase(),
        doctorReportCount,
        csReportCount,
        doctorReportWorkWithOthersCount,
        csReportWorkWithOthersCount,
        workStatus: dcr.workStatus,
      };
    });

    // Respond with the aggregated data
    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          totalAttendantReports,
          `${name}, Reports found for ${year}-${month}.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//---GET MONTHLY DCR REPORT STATS API'S --->
const getMonthlyDCRReportStats = asyncHandler(async (req, res) => {
  const { name } = req.user;
  const { _id: userId, year, month } = req.query;

  // Validate required fields
  if (!validateFields(req.query, ["_id", "year", "month"], res)) return;

  try {
    const startOfMonth = `${year}-${month}-01`;
    const endOfMonth = `${year}-${month}-31`;

    // Fetch reports in parallel
    const [allDCRReports, totalDvl] = await Promise.all([
      DCR.find({
        createdBy: userId,
        workStatus: { $ne: "ADMIN DAY" },
        reportDate: { $gte: startOfMonth, $lt: endOfMonth },
        reportStatus: "COMPLETE",
      }),
      DVL.find({ addedBy: userId }),
    ]);

    // Aggregate stats
    let totalWorkDay = 0,
      totalCampDay = 0,
      totalDoctorReports = 0,
      totalChemistReports = 0,
      totalStockistReports = 0;

    const uniqueDoctorIds = new Set();

    allDCRReports.forEach((dcr) => {
      if (dcr.workStatus === "WORKING DAY") totalWorkDay++;
      if (dcr.workStatus === "CAMP DAY") totalCampDay++;

      // Count doctor reports
      const doctorReports = dcr.doctorReports?.filter(
        (report) =>
          report.reportStatus === "COMPLETE CALL" && report.completedAt
      );
      totalDoctorReports += doctorReports?.length || 0;

      // Add unique doctor IDs
      doctorReports?.forEach((report) => uniqueDoctorIds.add(report.doctor));

      // Count chemist and stockist reports
      dcr.csReports?.forEach((report) => {
        if (
          report.reportStatus === "COMPLETE CALL" &&
          report.completedAt &&
          report.visitType === "CHEMIST"
        )
          totalChemistReports++;
        if (
          report.reportStatus === "COMPLETE CALL" &&
          report.completedAt &&
          report.visitType === "STOCKIST"
        )
          totalStockistReports++;
      });
    });

    const totalUniqueDoctorReports = uniqueDoctorIds.size;

    // Compute averages
    const doctorReportsAverage = totalWorkDay
      ? totalDoctorReports / totalWorkDay
      : 0;
    const chemistReportsAverage = totalWorkDay
      ? totalChemistReports / totalWorkDay
      : 0;
    const stockistReportsAverage = totalWorkDay
      ? totalStockistReports / totalWorkDay
      : 0;

    // Calculate percentage of completed doctor reports
    const percentageOfCompletedDoctorReports =
      totalDvl.length > 0
        ? (totalUniqueDoctorReports / totalDvl.length) * 100
        : 0;

    // Response
    return res.status(200).json(
      new ApiRes(
        200,
        {
          totalWorkDay,
          totalCampDay,
          totalDoctorReports,
          totalChemistReports,
          totalStockistReports,
          totalUniqueDoctorReports,
          totalDvl: totalDvl.length,
          doctorReportsAverage,
          chemistReportsAverage,
          stockistReportsAverage,
          percentageOfCompletedDoctorReports,
        },
        `${name}, your stats for ${year}-${month} are ready.`
      )
    );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//---GET FULL DCR REPORT API'S --->
const getFullDCRReport = asyncHandler(async (req, res) => {
  const { name } = req.user;
  const reportId = req.params.reportId;

  if (!reportId) {
    return res
      .status(400)
      .json(new ApiRes(400, null, `${name}, Report ID is required.`));
  }

  try {
    const dcrReport = await DCR.findById(reportId).populate([
      {
        path: "createdBy",
        select: "name role empId",
      },
      {
        path: "doctorReports.doctor",
        select: "docName",
      },
    ]);

    if (!dcrReport) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `${name}, DCR report with ID ${reportId} not found.`
          )
        );
    }

    return res.status(201).json(new ApiRes(201, dcrReport, ""));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//---GET CURRENT DCR REPORT STATUS API'S --->
const getCurrentDCRReportStatuses = asyncHandler(async (req, res) => {
  const { _id: userId, name } = req.user;

  try {
    const today = dayjs().format("YYYY-MM-DD");

    // Fetch week off/leave status and today's report in parallel
    const [weekOffAndLeaveStatus, todayReport] = await Promise.all([
      checkForWeekOffAndLeave(userId),
      DCR.findOne({ createdBy: userId, reportDate: today }).lean(),
    ]);

    const { isOnLeave, isWeekOff } = weekOffAndLeaveStatus;

    // Handle leave and week off cases early
    if (isOnLeave) {
      return res.status(201).json(
        new ApiRes(201, {
          isOnLeave: true,
          message: `${name}, You are on a leave today. Enjoy your leave.`,
        })
      );
    }
    if (isWeekOff) {
      return res.status(201).json(
        new ApiRes(201, {
          isWeekOff: true,
          message: `${name}, You are on a week off today. Enjoy your week off.`,
        })
      );
    }

    // Handle case when no report is found
    if (!todayReport) {
      return res.status(201).json(
        new ApiRes(201, {
          createReport: true,
          message: `${name}, No report found. Please create one.`,
        })
      );
    }

    // Extract and prepare response data
    const {
      _id: reportId,
      isMeeting,
      workStatus,
      startLocation,
      endLocation,
      meetingDetails,
      reportStatus,
      totalDistance,
    } = todayReport;

    const responseData = {
      reportId,
      isWorkingDay: workStatus === "WORKING DAY",
      isAdminDay: workStatus === "ADMIN DAY",
      isTrainingDay: workStatus === "TRAINING DAY",
      isCampDay: workStatus === "CAMP DAY",
      isJoiningDay: workStatus === "JOINING DAY",
      isMeetingDay: isMeeting && workStatus === "MEETING DAY",
      isReportComplete: reportStatus === "COMPLETE",
      startLocationNeeded: !startLocation.latitude,
      endLocationNeeded: !endLocation.latitude,
      meetingDetails,
    };

    // Construct dynamic message based on work status
    let dynamicMessage = `${name}, `;
    switch (workStatus) {
      case "JOINING DAY":
        dynamicMessage +=
          "Today is your joining day. Welcome onboard! Follow your manager's instructions.";
        break;
      case "ADMIN DAY":
        dynamicMessage +=
          "Today is an 'Administration Work' day. No day plan needed.";
        break;
      case "TRAINING DAY":
        dynamicMessage +=
          "Today is a training day. Follow your trainer's instructions.";
        break;
      case "MEETING DAY":
        if (isMeeting) dynamicMessage += "Today is a meeting day.";
        break;
      case "CAMP DAY":
        dynamicMessage += "Today is a camp day.";
        break;
    }

    if (workStatus !== "ADMIN DAY") {
      if (responseData.isReportComplete) {
        dynamicMessage = `You've completed your report for today. You traveled ${totalDistance} kms today.`;
      } else {
        dynamicMessage += `Your report is active with work status "${workStatus}".`;
      }
    }

    // Add location-related messages
    if (responseData.startLocationNeeded) {
      dynamicMessage += " Please add your start location.";
    }
    if (responseData.endLocationNeeded) {
      dynamicMessage += " End location is not set.";
    }

    responseData.message = dynamicMessage;

    // Send final response
    return res.status(201).json(new ApiRes(201, responseData, ""));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//---GET ROUTE OF ANY DCR REPORT --->
const getRouteOfAnyDCRReport = asyncHandler(async (req, res) => {
  const { empId, date } = req.query;

  if (!validateFields(req.query, ["empId", "date"], res)) return;

  try {
    const dcrReport = await DCR.findOne({ createdBy: empId, reportDate: date });

    if (!dcrReport) {
      return res
        .status(404)
        .json(
          new ApiRes(404, null, `DCR Report of ${empId} on ${date} not found.`)
        );
    }

    const listOfLocations = await getAllLocationsOfSingleDCRReport(
      dcrReport._id
    );

    return res.status(200).json(new ApiRes(200, listOfLocations, ""));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//---IMAGE UPLOAD API ONLY FOR ANDROID --->
const uploadCompleteCallPhoto = asyncHandler(async (req, res) => {
  const { name } = req.user;
  try {
    const file = req.files.image[0];
    if (!file) {
      return res.status(400).json({ message: "No image file uploaded" });
    }
    const filePath = file.path;
    const downloadURL = await uploadImageToFirebase(filePath);

    res
      .status(201)
      .json(
        new ApiRes(
          201,
          { downloadURL },
          `${name}, Your image is uploaded, Now you can complete your call.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

export {
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
  getRouteOfAnyDCRReport,
  uploadCompleteCallPhoto,
};
