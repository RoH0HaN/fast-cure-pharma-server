import { ApiRes, validateFields } from "../util/api.response.js";
import { User } from "../models/user.models.js";
import { Leave } from "../models/leave.models.js";
import { asyncHandler } from "../util/async.handler.js";
import { Logger } from "../util/logger.js";
import dayjs from "dayjs";
import { Holiday } from "../models/holiday.models.js";

const getDatesBetween = (fromDate, toDate) => {
  // Parse dates using dayjs
  const startDate = dayjs(fromDate);
  const endDate = dayjs(toDate);

  // Check if fromDate is after toDate
  if (startDate.isAfter(endDate)) {
    return {
      error: true,
      message: `'${fromDate}' cannot be after '${toDate}'.`,
      dates: [],
      duration: 0,
    };
  }

  // Generate the list of dates
  const dates = [];
  for (
    let date = startDate;
    date.isSameOrBefore(endDate);
    date = date.add(1, "day")
  ) {
    dates.push(date.format("YYYY-MM-DD"));
  }

  // Calculate the duration in days (inclusive of both start and end dates)
  const duration = endDate.diff(startDate, "day") + 1;

  return {
    error: false,
    message: "Dates generated successfully.",
    dates,
    duration,
  };
};

const getRemainingLeavesCount = asyncHandler(async (req, res) => {
  const { _id, name } = req.user;
  try {
    const leave = await Leave.findOne({ empId: _id });
    if (!leave) {
      return res
        .status(404)
        .json(new ApiRes(404, null, `${name}, Your leave record not found.`));
    }
    return res.status(200).json(
      new ApiRes(
        200,
        {
          cl: leave.clCount,
          pl: leave.plCount,
        },
        ""
      )
    );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const applyLeave = asyncHandler(async (req, res) => {
  const { _id: empId } = req.user;
  const { leaveType, reason, fromDate, toDate } = req.body;

  // Validate required fields
  if (
    !validateFields(
      req.body,
      ["leaveType", "reason", "fromDate", "toDate"],
      res
    )
  )
    return;

  try {
    const {
      error,
      message,
      dates: requestedLeaveDates,
      duration: leaveDuration,
    } = getDatesBetween(fromDate, toDate);

    if (error) {
      return res.status(400).json(new ApiRes(400, null, message));
    }

    // Check employee existence and leave data in parallel
    const [employee, leave, holidays] = await Promise.all([
      User.findById(empId),
      Leave.findOne({ empId }),
      Holiday.find({
        date: { $gte: fromDate, $lte: toDate },
      }).lean(),
    ]);

    if (!employee) {
      return res.status(404).json(new ApiRes(404, null, "Employee not found."));
    }

    if (leave) {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `${employee.name}, Your leave record not found.`
          )
        );
    }

    let remarks = "Has consecutive";

    if (
      (leave.plCount <= 0 && leaveType === "PRIVILEGED") ||
      (leave.clCount <= 0 && leaveType === "CASUAL")
    ) {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `${employee.name}, Sorry no ${leaveType} leave available.`
          )
        );
    }

    const casualLeaveDAysInMonth = leave.leaves.reduce((total, leave) => {
      if (
        leave.status === "APPROVED" &&
        leave.leaveType === "CASUAL" &&
        dayjs(leave.fromDate).format("YYYY-MM") ===
          dayjs(fromDate).format("YYYY-MM")
      ) {
        return total + leave.usedLeaveCounts.cl;
      }

      return total;
    }, 0);

    if (leaveType === "CASUAL" && casualLeaveDAysInMonth >= 3) {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `${employee.name}, You can't apply for more than 3 casual leaves in a month.`
          )
        );
    }

    const holidayDates = holidays.map((holiday) => holiday.date);

    const hasConsecutiveHolidays = requestedLeaveDates.some((date) => {
      const previousDay = dayjs(date).subtract(1, "day").format("YYYY-MM-DD");
      const nextDay = dayjs(date).add(1, "day").format("YYYY-MM-DD");
      return (
        holidayDates.includes(previousDay) || holidayDates.includes(nextDay)
      );
    });

    const hasConsecutiveWeekends = requestedLeaveDates.some((date) => {
      const previousDay = dayjs(date).subtract(1, "day").format("YYYY-MM-DD");
      const nextDay = dayjs(date).add(1, "day").format("YYYY-MM-DD");
      return previousDay.day() === 0 || nextDay.day() === 0;
    });

    if (leaveType !== "LEAVE-WITHOUT-PAY") {
      if (hasConsecutiveHolidays) {
        remarks += " holidays";
      }

      if (hasConsecutiveWeekends) {
        remarks += " weekends";
      }
    }

    const overlappingLeave = leave.leaves.find((leave) => {
      return (
        dayjs(leave.fromDate).isSameOrBefore(dayjs(fromDate)) &&
        dayjs(leave.toDate).isSameOrAfter(dayjs(toDate)) &&
        (leave.status === "APPROVED" || leave.status === "PENDING")
      );
    });

    if (overlappingLeave) {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `${employee.name}, Sorry an existing ${overlappingLeave.leaveType} leave found for your requested dates.`
          )
        );
    }

    let remainingPL = leave.plCount;
    let remainingCL = leave.clCount;

    let plUsed = 0;
    let clUsed = 0;
    let lwpUsed = 0;

    if (leaveType === "PRIVILEGED") {
      requestedLeaveDates.forEach((date) => {
        if (remainingPL > 0) {
          plUsed++;
          remainingPL--;
        } else if (remainingCL > 0 && clUsed < 3) {
          clUsed++;
          remainingCL--;
        } else {
          lwpUsed++;
        }
      });
    } else if (leaveType === "CASUAL") {
      requestedLeaveDates.forEach((date) => {
        if (remainingCL > 0 && clUsed < 3) {
          clUsed++;
          remainingCL--;
        } else if (remainingPL > 0) {
          plUsed++;
          remainingPL--;
        } else {
          lwpUsed++;
        }
      });
    } else if (leaveType === "LEAVE-WITHOUT-PAY") {
      requestedLeaveDates.forEach((date) => {
        lwpUsed++;
      });
    }

    leave.leaves.push({
      leaveType,
      status: "PENDING",
      reason,
      fromDate,
      toDate,
      duration: leaveDuration,
      requestedOn: dayjs().format("YYYY-MM-DD"),
      remarks,
      usedLeaveCounts: {
        cl: clUsed,
        pl: plUsed,
        lwp: lwpUsed,
      },
    });

    await leave.save();
    Logger(`${employee.name} applied for ${leaveType} leave.`);

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          leave,
          `${employee.name}, Your ${leaveType} leave has been applied, please wait for approval.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const addLeave = asyncHandler(async (req, res) => {
  const name = req.user.name;
  const { empId, reason, fromDate, toDate } = req.body;

  // Validate required fields
  if (!validateFields(req.body, ["empId", "reason", "fromDate", "toDate"], res))
    return;

  try {
    const {
      error,
      message,
      duration: leaveDuration,
    } = getDatesBetween(fromDate, toDate);

    if (error) {
      return res.status(400).json(new ApiRes(400, null, message));
    }
    // Check employee existence and leave data in parallel
    const [employee, leave] = await Promise.all([
      User.findById(empId),
      Leave.findOne({ empId }),
    ]);

    if (!employee) {
      return res.status(404).json(new ApiRes(404, null, "Employee not found."));
    }

    if (leave) {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `${employee.name}, Your leave record not found.`
          )
        );
    }

    leave.leaves.push({
      leaveType: "MEDICAL",
      reason,
      fromDate,
      toDate,
      duration: leaveDuration,
      status: "APPROVED",
      requestedOn: dayjs().format("YYYY-MM-DD"),
      approvedOn: dayjs().format("YYYY-MM-DD"),
      approvedBy: name,
      usedLeaveCounts: {
        cl: 0,
        pl: 0,
        lwp: 0,
      },
    });

    await leave.save();

    Logger(`${name}, applied a MEDICAL leave for ${employee.name}.`);

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, Leave applied successfully for ${employee.name}.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const approveLeave = asyncHandler(async (req, res) => {});

export { applyLeave, addLeave, approveLeave, getRemainingLeavesCount };
