import { ApiRes, validateFields } from "../util/api.response.js";
import { User } from "../models/user.models.js";
import { Attendance } from "../models/attendance.models.js";
import { Holiday } from "../models/holiday.models.js";
import { Leave } from "../models/leave.models.js";
import { asyncHandler } from "../util/async.handler.js";
import { Logger } from "../util/logger.js";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore.js";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter.js";
import { DCR } from "../models/dcr.models.js";
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const generateDatesArray = (year, month) => {
  const startOfMonth = dayjs(`${year}-${month}-01`); // Start of the month
  const daysInMonth = startOfMonth.daysInMonth(); // Number of days in the month

  const dates = Array.from({ length: daysInMonth }, (_, index) =>
    startOfMonth.add(index, "day").format("YYYY-MM-DD")
  );

  return dates;
};

const create = asyncHandler(async (req, res) => {
  const { title } = req.body;
  const { name, _id } = req.user;

  // Validate required fields
  if (!validateFields(req.body, ["title"], res)) return;

  try {
    const date = dayjs().format("YYYY-MM-DD");
    const [year, month] = date.split("-");

    // Construct the dynamic path for attendance
    const attendancePath = `attendance.${year}.${month}.${date}`;

    // Perform an atomic update
    const updateResult = await Attendance.updateOne(
      { empId: _id, [attendancePath]: { $exists: false } }, // Ensure no duplicate entry
      {
        $set: { [attendancePath]: { title } }, // Add new attendance entry
        $setOnInsert: { empId: _id }, // Initialize attendance if not existing
      },
      { upsert: true } // Insert if no document exists
    );

    // Check if the update was applied or skipped (duplicate entry)
    if (updateResult.matchedCount > 0 && updateResult.modifiedCount === 0) {
      return res
        .status(300)
        .json(
          new ApiRes(
            300,
            null,
            `${name}, Your attendance already exists for ${title} on ${date}.`
          )
        );
    }

    Logger(
      `${name}, Your attendance has been marked for ${title} on ${date}.`,
      "info"
    );

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, Your attendance has been marked for ${title} on ${date}.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const getAttendance = asyncHandler(async (req, res) => {
  const { empId: _id, year, month } = req.query;

  if (!validateFields(req.query, ["empId", "year", "month"], res)) return;

  try {
    // Generate all dates for the specified month
    const monthlyDates = generateDatesArray(year, month);

    // Fetch data in parallel to reduce I/O time
    const [holidays, attendance, leave] = await Promise.all([
      Holiday.find({
        date: { $gte: `${year}-${month}-01`, $lte: `${year}-${month}-31` },
      }).lean(),
      Attendance.findOne({ empId: _id }).lean(),
      Leave.findOne({ empId: _id }).lean(),
    ]);

    const holidayMap = new Map(
      holidays.map((holiday) => [holiday.date, holiday.title])
    );
    const leaveSet = new Set(
      leave?.leaves
        ?.filter((leave) => leave.status === "APPROVED")
        .flatMap((leave) => {
          const fromDate = dayjs(leave.fromDate);
          const toDate = dayjs(leave.toDate);
          const leaveDates = [];
          for (
            let date = fromDate;
            date.isSameOrBefore(toDate);
            date = date.add(1, "day")
          ) {
            leaveDates.push(date.format("YYYY-MM-DD"));
          }
          return leaveDates;
        })
    );

    const dcrReports = await DCR.find({
      createdBy: _id,
      reportDate: { $gte: `${year}-${month}-01`, $lte: `${year}-${month}-31` },
    });

    const attendanceData = attendance?.attendance?.[year]?.[month] || {};
    const resultList = monthlyDates
      .map((date) => {
        const holidayTitle = holidayMap.get(date);
        const attendanceObj = attendanceData[date];

        if (attendanceObj && attendanceObj.title !== "WEEK OFF") {
          const reportId = dcrReports.find(
            (report) => report.reportDate === date
          )._id;
          return {
            start: dayjs(date).toDate(),
            end: dayjs(date).toDate(),
            link: [
              "WORKING DAY",
              "CAMP DAY",
              "MEETING DAY",
              "JOINING DAY",
              "TRAINING DAY",
              "ADMIN DAY",
            ].includes(attendanceObj.title)
              ? `/report/${reportId}`
              : null,
            startDate: date,
            endDate: date,
            title: attendanceObj.title,
            reportId: [
              "WORKING DAY",
              "CAMP DAY",
              "MEETING DAY",
              "JOINING DAY",
              "TRAINING DAY",
              "ADMIN DAY",
            ].includes(attendanceObj.title)
              ? reportId
              : null,
            isHoliday: !!holidayTitle,
            holiday: holidayTitle || null,
          };
        } else if (attendanceObj && attendanceObj.title === "WEEK OFF") {
          return {
            start: dayjs(date).toDate(),
            end: dayjs(date).toDate(),
            link: null,
            startDate: date,
            endDate: date,
            title: "WEEK OFF",
            reportId: null,
            isHoliday: false,
            holiday: holidayTitle || null,
          };
        } else if (attendanceObj && attendanceObj.title === "ABSENT") {
          return {
            start: dayjs(date).toDate(),
            end: dayjs(date).toDate(),
            link: null,
            startDate: date,
            endDate: date,
            title: "ABSENT",
            reportId: null,
            isHoliday: false,
            holiday: holidayTitle || null,
          };
        } else if (leaveSet.has(date)) {
          return {
            start: dayjs(date).toDate(),
            end: dayjs(date).toDate(),
            link: null,
            startDate: date,
            endDate: date,
            title: "LEAVE",
            reportId: null,
            isHoliday: !!holidayTitle,
            holiday: holidayTitle || null,
          };
        } else if (holidayTitle) {
          return {
            start: dayjs(date).toDate(),
            end: dayjs(date).toDate(),
            link: null,
            startDate: date,
            endDate: date,
            title: "HOLIDAY",
            reportId: null,
            isHoliday: true,
            holiday: holidayTitle,
          };
        }

        return null; // No attendance, leave, or holiday
      })
      .filter(Boolean); // Remove null entries

    return res.status(200).json(new ApiRes(200, resultList, null));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

export { create, getAttendance };
