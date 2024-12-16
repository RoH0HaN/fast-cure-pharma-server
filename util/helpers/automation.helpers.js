import dayjs from "dayjs";
import { User } from "../../models/user.models.js";
import { Leave } from "../../models/leave.models.js";
import { Attendance } from "../../models/attendance.models.js";
import { DCR } from "../../models/dcr.models.js";
import { Logger } from "../logger.js";

const createLWPLeaves = async (empId, date) => {
  try {
    const [employee, leave] = await Promise.all([
      User.findById(empId).lean(),
      Leave.findOne({ empId }),
    ]);

    if (!employee) {
      return false;
    }

    if (!leave) {
      return false;
    }

    // Create a new leave entry
    const newLeave = {
      leaveType: "LEAVE-WITHOUT-PAY",
      reason: "THIS LEAVE IS APPLIED AND APPROVED BY SYSTEM",
      fromDate: dayjs(date).format("YYYY-MM-DD"),
      toDate: dayjs(date).format("YYYY-MM-DD"),
      duration: 1,
      status: "APPROVED",
      requestedOn: dayjs(date).format("YYYY-MM-DD"),
      approvedOn: dayjs(date).format("YYYY-MM-DD"),
      approvedBy: "SYSTEM",
      usedLeaveCounts: {
        cl: 0,
        pl: 0,
        lwp: 1,
      },
    };

    // Update leave record
    leave.lwpCount = leave.lwpCount + 1;
    leave.leaves.push(newLeave);
    await leave.save();

    return true;
  } catch (error) {
    Logger(error, "error");
    return false;
  }
};

const incompleteDCRReport = async (reportId) => {
  try {
    const report = await DCR.findById(reportId);

    if (!report) {
      return false;
    }

    report.reportStatus = "INCOMPLETE";
    await report.save();

    return true;
  } catch (error) {
    Logger(error, "error");
    return false;
  }
};

const createAbsentAttendance = async (empId, date) => {
  try {
    const [year, month] = date.split("-");

    // Find the attendance record
    let attendanceRecord = await Attendance.findOne({ empId });

    if (!attendanceRecord) {
      // Create a new record if it doesn't exist
      attendanceRecord = new Attendance({
        empId: empId,
        attendance: {
          [year]: {
            [month]: {
              [date]: { title },
            },
          },
        },
      });
      await attendanceRecord.save();

      return true;
    }

    // Check if attendance for the date already exists
    const attendanceForDate =
      attendanceRecord.attendance?.[year]?.[month]?.[date] || null;

    if (attendanceForDate?.title) {
      return false;
    }

    // Ensure nested objects exist
    if (!attendanceRecord.attendance[year]) {
      attendanceRecord.attendance[year] = {};
    }
    if (!attendanceRecord.attendance[year][month]) {
      attendanceRecord.attendance[year][month] = {};
    }

    attendanceRecord.attendance[year][month][date] = { title: "ABSENT" };

    // Mark the field as modified and save
    attendanceRecord.markModified("attendance");
    await attendanceRecord.save();

    return true;
  } catch (error) {
    Logger(error, "error");
    throw new Error("Failed to mark absent attendance.");
  }
};

export { createLWPLeaves, incompleteDCRReport, createAbsentAttendance };
