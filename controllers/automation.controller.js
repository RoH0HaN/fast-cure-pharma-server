import { Logger } from "../util/logger.js";
import { User } from "../models/user.models.js";
import { Leave } from "../models/leave.models.js";
import { Attendance } from "../models/attendance.models.js";
import { DCR } from "../models/dcr.models.js";
import { asyncHandler } from "../util/async.handler.js";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween.js";
dayjs.extend(isBetween);
import {
  createAbsentAttendance,
  createLWPLeaves,
  incompleteDCRReport,
} from "../util/helpers/automation.helpers.js";

const automateEmployeeLeaveAttendanceAndReport = asyncHandler(
  async (req, res) => {
    try {
      const [year, month] = dayjs().format("YYYY-MM").split("-");
      const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");

      const employees = await User.find({
        role: { $ne: "ADMIN" },
        isArchived: false,
      }).lean();
      const allLeaves = await Leave.find({}).lean();
      const allAttendances = await Attendance.find({}).lean();
      const dcrReports = await DCR.find({
        reportDate: yesterday,
      }).lean();

      for (const employee of employees) {
        const attendance = allAttendances.find(
          (a) => a.empId.toString() === employee._id.toString()
        );
        const leave = allLeaves.find(
          (l) => l.empId.toString() === employee._id.toString()
        );
        const dcr = dcrReports.find(
          (d) => d.createdBy.toString() === employee._id.toString()
        );

        const yesterdayAttendance =
          attendance.attendances[year][month][yesterday];
        const yesterdayLeave = leave?.leaves.some(
          (leave) =>
            dayjs(yesterday).isBetween(
              dayjs(leave.fromDate),
              dayjs(leave.toDate),
              "day",
              "[]" // Inclusive of both `fromDate` and `toDate`
            ) && leave.status !== "PENDING"
        );

        if (employee.role === "HR/OH") {
          if (!yesterdayAttendance) {
            if (!yesterdayLeave) {
              await createLWPLeaves(employee._id, yesterday);
              await createAbsentAttendance(employee._id, yesterday);
            }
          }
        } else {
          if (!yesterdayLeave) {
            if (!yesterdayAttendance) {
              if (dcr) {
                if (dcr.reportStatus === "PENDING") {
                  await incompleteDCRReport(dcr._id);
                  await createLWPLeaves(employee._id, yesterday);
                  await createAbsentAttendance(employee._id, yesterday);
                }
              } else {
                await createLWPLeaves(employee._id, yesterday);
                await createAbsentAttendance(employee._id, yesterday);
              }
            }
          }
        }
      }

      return res
        .status(200)
        .json(
          new ApiRes(
            200,
            null,
            "Employee leave and attendance updated successfully."
          )
        );
    } catch (error) {
      Logger(error, "error");
      return res
        .status(500)
        .json(new ApiRes(500, null, error.message || "Internal Server Error."));
    }
  }
);

const automateResetLeaves = asyncHandler(async (req, res) => {
  try {
    const employees = await User.find({
      role: { $ne: "ADMIN" },
      isArchived: false,
    }).lean();

    for (const employee of employees) {
      const leave = await Leave.findOne({ empId: employee._id });
      if (leave) {
        leave.clCount = 14;
        leave.plCount = 0;
        await leave.save();
      }
    }

    return res
      .status(200)
      .json(new ApiRes(200, null, "Leaves reset successfully."));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal Server Error."));
  }
});

export { automateResetLeaves, automateEmployeeLeaveAttendanceAndReport };
