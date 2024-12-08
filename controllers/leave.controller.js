import { ApiRes, validateFields } from "../util/api.response.js";
import { User } from "../models/user.models.js";
import { Leave } from "../models/leave.models.js";
import { asyncHandler } from "../util/async.handler.js";
import { Logger } from "../util/logger.js";
import dayjs from "dayjs";
import { Holiday } from "../models/holiday.models.js";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore.js";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter.js";
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

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

const getCurrentMonthWorkingDays = async (empId) => {
  try {
    //TODO: Get current month working days from DCR

    return 12;
  } catch (error) {
    throw new Error(`${error}, Failed to get current month working days.`);
  }
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
    return res.status(201).json(
      new ApiRes(
        201,
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
          null,
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
    // Validate date range and duration
    const {
      error,
      message,
      duration: leaveDuration,
    } = getDatesBetween(fromDate, toDate);

    if (error) {
      return res.status(400).json(new ApiRes(400, null, message));
    }

    // Fetch employee and leave records in parallel
    const [employee, leave] = await Promise.all([
      User.findById(empId).lean(),
      Leave.findOne({ empId }),
    ]);

    if (!employee) {
      return res.status(404).json(new ApiRes(404, null, "Employee not found."));
    }

    if (!leave) {
      return res
        .status(404)
        .json(
          new ApiRes(404, null, `${employee.name}, Leave record not found.`)
        );
    }

    // Create a new leave entry
    const newLeave = {
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
    };

    // Update leave record
    leave.leaves.push(newLeave);
    await leave.save();

    Logger(`${name} applied a MEDICAL leave for ${employee.name}.`);

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, MEDICAL Leave applied successfully for ${employee.name}.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const approveLeave = asyncHandler(async (req, res) => {
  const name = req.user.name;
  const { leaveId, empId } = req.body;

  try {
    // Fetch employee and leave record in parallel
    const [leave, employee] = await Promise.all([
      Leave.findOne({ "leaves._id": leaveId }).lean(),
      User.findById(empId).lean(),
    ]);

    // Handle missing employee or leave record
    if (!employee) {
      return res.status(404).json(new ApiRes(404, null, "Employee not found."));
    }

    if (!leave) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `${name}, Leave record for ${employee.name} not found.`
          )
        );
    }

    // Find the specific leave request
    const proposedLeave = leave.leaves.find(
      (l) => l._id.toString() === leaveId
    );

    if (!proposedLeave) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `${name}, Leave request not found with ID ${leaveId}.`
          )
        );
    }

    // Check if the leave is already processed
    if (proposedLeave.status !== "PENDING") {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `${name}, Leave request is already ${proposedLeave.status}.`
          )
        );
    }

    // Update leave counts and status
    const updatedFields = {
      "leaves.$.status": "APPROVED",
      "leaves.$.approvedOn": dayjs().format("YYYY-MM-DD"),
      "leaves.$.approvedBy": name,
      "leaves.$.clCount": leave.clCount - proposedLeave.usedLeaveCounts.cl,
      "leaves.$.plCount": leave.plCount - proposedLeave.usedLeaveCounts.pl,
      "leaves.$.lwpCount": leave.lwpCount + proposedLeave.usedLeaveCounts.lwp,
    };

    await Leave.updateOne({ "leaves._id": leaveId }, { $set: updatedFields });

    Logger(`${name} approved ${employee.name}'s leave request.`);

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, ${employee.name}'s leave request approved.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const rejectLeave = asyncHandler(async (req, res) => {
  const name = req.user.name;
  const { leaveId, empId } = req.body;

  try {
    // Fetch employee and leave record in parallel
    const [leave, employee] = await Promise.all([
      Leave.findOne({ "leaves._id": leaveId }).lean(),
      User.findById(empId).lean(),
    ]);

    // Handle missing employee or leave record
    if (!employee) {
      return res.status(404).json(new ApiRes(404, null, "Employee not found."));
    }

    if (!leave) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `${name}, Leave record for ${employee.name} not found.`
          )
        );
    }

    // Find the specific leave request
    const proposedLeave = leave.leaves.find(
      (l) => l._id.toString() === leaveId
    );

    if (!proposedLeave) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `${name}, Leave request not found with ID ${leaveId}.`
          )
        );
    }

    // Check if the leave is already processed
    if (proposedLeave.status === "REJECTED") {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `${name}, Leave request is already ${proposedLeave.status}.`
          )
        );
    }

    // Update leave counts only if it was previously approved
    const updatedFields = {
      "leaves.$.status": "REJECTED",
      "leaves.$.rejectedOn": dayjs().format("YYYY-MM-DD"),
      "leaves.$.rejectedBy": name,
    };

    if (proposedLeave.status === "APPROVED") {
      updatedFields["leaves.$.clCount"] =
        leave.clCount + proposedLeave.usedLeaveCounts.cl;
      updatedFields["leaves.$.plCount"] =
        leave.plCount + proposedLeave.usedLeaveCounts.pl;
      updatedFields["leaves.$.lwpCount"] =
        leave.lwpCount - proposedLeave.usedLeaveCounts.lwp;
    }

    // Update the leave record
    await Leave.updateOne({ "leaves._id": leaveId }, { $set: updatedFields });

    Logger(`${name} rejected ${employee.name}'s leave request.`);

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, ${employee.name}'s leave request rejected.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const deleteLeave = asyncHandler(async (req, res) => {
  const { name, _id } = req.user; // Employee ID and name
  const leaveId = req.params.leaveId;

  try {
    // Use $pull to directly remove the leave record
    const updateResult = await Leave.updateOne(
      { empId: _id, "leaves._id": leaveId }, // Match employee and leave ID
      { $pull: { leaves: { _id: leaveId } } } // Remove the specific leave
    );

    // Check if any leave was modified
    if (updateResult.modifiedCount === 0) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `${name}, Leave request not found with ID ${leaveId}.`
          )
        );
    }

    // Log the deletion
    Logger(`${name} deleted a leave request with ID ${leaveId}.`);

    return res
      .status(200)
      .json(new ApiRes(200, null, `${name}, Your leave request deleted.`));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const getPendingLeaves = asyncHandler(async (req, res) => {
  const { _id, role } = req.user;

  try {
    // Fetch all pending leaves for admin
    if (role === "ADMIN") {
      const pendingLeaves = await Leave.find({ "leaves.status": "PENDING" })
        .populate("empId", "name empId role")
        .lean();

      const resultList = pendingLeaves.flatMap((leave) =>
        leave.leaves
          .filter((l) => l.status === "PENDING")
          .map((l) => ({
            empObjectId: leave.empId._id,
            name: leave.empId.name,
            empId: leave.empId.empId,
            role: leave.empId.role,
            leaveType: l.leaveType,
            leaveId: l._id,
            fromDate: l.fromDate,
            toDate: l.toDate,
            duration: l.duration,
            reason: l.reason,
            remarks: l.remarks,
            status: l.status,
            requestedOn: l.requestedOn,
            usedLeaveCounts: l.usedLeaveCounts,
          }))
      );

      return res.status(200).json(new ApiRes(200, resultList, ""));
    }

    // Fetch downline employees for non-admin users
    const employee = await User.findById(_id)
      .select("downlineEmployees")
      .lean();

    if (!employee) {
      return res.status(404).json(new ApiRes(404, null, "Employee not found"));
    }

    // Fetch all downline employee IDs in a single query
    const downlineEmployeeIds = await User.aggregate([
      { $match: { _id } },
      {
        $graphLookup: {
          from: "users",
          startWith: "$downlineEmployees",
          connectFromField: "downlineEmployees",
          connectToField: "_id",
          as: "downlineEmployeesGraph",
        },
      },
      {
        $project: {
          allEmployeeIds: {
            $concatArrays: [
              "$downlineEmployees",
              "$downlineEmployeesGraph._id",
            ],
          },
        },
      },
    ]);

    const employeeIds = downlineEmployeeIds[0]?.allEmployeeIds || [_id];

    // Fetch pending leaves for downline employees
    const pendingLeaves = await Leave.find({
      empId: { $in: employeeIds },
      "leaves.status": "PENDING",
    })
      .populate("empId", "name empId role")
      .lean();

    const resultList = pendingLeaves.flatMap((leave) =>
      leave.leaves
        .filter((l) => l.status === "PENDING")
        .map((l) => ({
          empObjectId: leave.empId._id,
          name: leave.empId.name,
          empId: leave.empId.empId,
          role: leave.empId.role,
          leaveType: l.leaveType,
          leaveId: l._id,
          fromDate: l.fromDate,
          toDate: l.toDate,
          duration: l.duration,
          reason: l.reason,
          remarks: l.remarks,
          status: l.status,
          requestedOn: l.requestedOn,
          usedLeaveCounts: l.usedLeaveCounts,
        }))
    );

    return res.status(200).json(new ApiRes(200, resultList, ""));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const getApprovedLeavesByEmployeeAndRange = asyncHandler(async (req, res) => {
  const { _id, fromDate, toDate } = req.query;

  if (!validateFields(req.query, ["_id", "fromDate", "toDate"], res)) return;

  try {
    // Check if fromDate is after toDate
    if (startDate.isAfter(endDate)) {
      return res
        .status(400)
        .json(
          new ApiRes(400, null, `'${fromDate}' cannot be after '${toDate}'.`)
        );
    }
    // Find the employee by emp_id
    const employee = await User.findById({ _id }).select("_id name empId role");

    if (!employee) {
      return res.status(404).json(new ApiRes(404, null, "Employee not found"));
    }

    // Find the leave record for the employee
    const leaveRecord = await Leave.findOne({ emp_id });

    if (!leaveRecord) {
      return res
        .status(404)
        .json(
          new ApiRes(404, null, `${employee.name}'s leave record not found`)
        );
    }

    const filteredLeaves = leaveRecord.leaves.filter((leave) => {
      return (
        dayjs(leave.fromDate).isSameOrAfter(dayjs(fromDate)) &&
        dayjs(leave.toDate).isSameOrBefore(dayjs(toDate)) &&
        leave.status !== "PENDING"
      );
    });

    const leaveData = filteredLeaves.map((leave) => {
      return {
        empObjectId: employee._id,
        leaveId: leave._id,
        name: employee.name,
        empId: employee.empId,
        role: employee.role,
        leaveType: leave.leaveType,
        fromDate: leave.fromDate,
        toDate: leave.toDate,
        status: leave.status,
        reason: leave.reason,
        duration: leave.duration,
        requestedOn: leave.requestedOn,
        approvedOn: leave.approvedOn,
        rejectedOn: leave.rejectedOn,
        approvedBy: leave.approvedBy,
        rejectedBy: leave.rejectedBy,
        usedLeaveCounts: leave.usedLeaveCounts,
      };
    });

    return res
      .status(201)
      .json(
        new ApiRes(
          201,
          leaveData,
          `${employee.name}'s APPROVED leaves found from ${fromDate} to ${toDate}.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const getEmployeeLeaveMetrics = asyncHandler(async (req, res) => {
  const _id = req.params._id;

  if (!validateFields(req.params, ["_id"], res)) return;

  try {
    const employee = await User.findById({ _id }).select("_id name empId role");

    if (!employee) {
      return res.status(404).json(new ApiRes(404, null, "Employee not found"));
    }

    const leave = await Leave.findOne({ empId: _id });

    const currentMonthLeaves = leave.leaves.filter((leave) => {
      return (
        dayjs(leave.fromDate).format("YYYY-MM") === dayjs().format("YYYY-MM") &&
        leave.status === "APPROVED"
      );
    });

    const clCount = leave.clCount;
    const plCount = leave.plCount;

    const currentMonthsCl = currentMonthLeaves.filter((leave) => {
      return leave.usedLeaveCounts.cl > 0;
    }).length;

    const currentMonthsPl = currentMonthLeaves.filter((leave) => {
      return leave.usedLeaveCounts.pl > 0;
    }).length;

    const currentMonthLWP = currentMonthLeaves.filter((leave) => {
      return leave.usedLeaveCounts.lwp > 0;
    }).length;

    const currentMonthWorkingDays = await getCurrentMonthWorkingDays(_id);

    return res.status(201).json(
      new ApiRes(
        201,
        {
          clCount,
          plCount,
          currentMonthsCl,
          currentMonthsPl,
          excessiveLeave: currentMonthLWP,
          currentMonthWorkingDays,
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

export {
  applyLeave,
  addLeave,
  approveLeave,
  getRemainingLeavesCount,
  rejectLeave,
  deleteLeave,
  getPendingLeaves,
  getApprovedLeavesByEmployeeAndRange,
  getEmployeeLeaveMetrics,
};
