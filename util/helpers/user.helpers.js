import { User, Employee, Manager } from "../../models/user.models.js";
import { Leave } from "../../models/leave.models.js";
import { Attendance } from "../../models/attendance.models.js";
import { Logger } from "../../util/logger.js";
import jwt from "jsonwebtoken";
import dayjs from "dayjs";
import mongoose from "mongoose";
import { TourPlan } from "../../models/tourPlan.models.js";

const initializeLeaveDocument = async (empId, dateOfJoining) => {
  const joiningDate = dayjs(dateOfJoining, "YYYY-MM-DD");
  const currentYearMarch31st = dayjs().year(dayjs().year()).month(2).date(31);

  let clCount = 0;
  if (joiningDate.isAfter(currentYearMarch31st)) {
    const nextMarch31st = dayjs()
      .year(dayjs().year() + 1)
      .month(2)
      .date(31);
    const daysTillMarch31st = nextMarch31st.diff(joiningDate, "days") + 1;

    clCount =
      daysTillMarch31st >= 365
        ? 14
        : Math.floor((14 / 365) * daysTillMarch31st);
  } else {
    clCount = 14;
  }
  await Leave.updateOne(
    { empId },
    {
      empId,
      updatedOn: dateOfJoining,
      clCount,
    },
    { upsert: true }
  );
};

const initializeTourPlanDocument = async (empId) => {
  await TourPlan.updateOne(
    { empId },
    {
      empId,
    },
    { upsert: true }
  );
};

const updateAttendanceOfHrOh = async (empId) => {
  try {
    let date = dayjs().format("YYYY-MM-DD");

    const [year, month, day] = date.split("-");
    const attendance = { title: "WORKING DAY" };

    let existingAttendance = await Attendance.findOne({
      empId,
    });

    if (existingAttendance) {
      let updated = false;
      let attendanceObj = existingAttendance._doc.attendance; //check later

      if (attendanceObj[year]) {
        if (attendanceObj[year][month]) {
          if (attendanceObj[year][month][date]) {
            Logger(`Attendance of ${empId} already exists`, "info");
          } else {
            attendanceObj[year][month][date] = attendance;
            updated = true;
          }
        } else {
          attendanceObj[year][month] = { [date]: attendance };
          updated = true;
        }
      } else {
        attendanceObj[year] = { [month]: { [date]: attendance } };
        updated = true;
      }

      if (updated) {
        existingAttendance.attendance = new Map(Object.entries(attendanceObj));
        await existingAttendance.save();
      }
    } else {
      const newAttendance = new Map([
        [year, { [month]: { [date]: attendance } }],
      ]);

      await Attendance.create({
        empId,
        attendance: newAttendance,
      });
    }
  } catch (error) {
    throw error;
  }
};

const validateEmail = (email) => {
  return email.includes("@") && email.indexOf("@") > 0;
};

const generateAccess = async (userID) => {
  try {
    let user;
    user = await Employee.findById(userID);
    if (!user) {
      user = await User.findById(userID);
    }
    const accessToken = await user.generateAccessToken();

    return { accessToken };
  } catch (error) {
    throw error;
  }
};

const switchRole = async (userId, role) => {
  try {
    const session = await mongoose.startSession();
    session.startTransaction();

    const user = await User.findById(userId);

    const isManagerRole = ["ZBM", "RBM", "ABM"].includes(role);
    const isEmployeeRole = ["HR/OH", "TBM"].includes(role);

    const isCurrentlyEmployee = user instanceof Employee;
    const isCurrentlyManager = user instanceof Manager;

    if (
      (isCurrentlyEmployee && isEmployeeRole) ||
      (isCurrentlyManager && isManagerRole)
    ) {
      user.role = role;
      await user.save({ session }, { new: true });
      await session.commitTransaction();
      session.endSession();

      return user._id;
    }

    await User.findByIdAndDelete(userId).session(session);
    const commonFields = user.toObject();
    delete commonFields.__t;
    commonFields.role = role;

    if (isManagerRole) {
      const newManager = new Manager({
        ...commonFields,
        downLineEmployees: [],
      });

      await newManager.save({ session }, { new: true });
      await session.commitTransaction();
      session.endSession();
      return newManager._id;
    } else if (isEmployeeRole) {
      const newEmployee = new Employee({
        ...commonFields,
      });
      await newEmployee.save({ session }, { new: true });
      await session.commitTransaction();
      session.endSession();
      return newEmployee._id;
    }
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
      session.endSession();
    }
    Logger(error, "error");
    throw new Error(error.message || "Internal Server Error.");
  }
};

const switchParent = async (userId, newParentId) => {
  try {
    // Start a MongoDB session
    const session = await mongoose.startSession();
    session.startTransaction();

    // Fetch the user and validate parent change
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error("User not found.");
    const oldParentId = user.basicDetails.parentId;

    // Determine if old parent is not an ADMIN
    const oldParentRole = user.basicDetails.parentRole;

    const operations = [];

    // Remove user from old parent's downline if applicable
    if (oldParentRole !== "ADMIN") {
      operations.push({
        updateOne: {
          filter: { _id: oldParentId },
          update: { $pull: { downLineEmployees: userId } },
        },
      });
    }

    // Add user to new parent's downline if applicable
    const newParent = await Manager.findById(newParentId).session(session);
    if (!newParent) throw new Error("New parent not found.");
    const newParentRole = newParent.role;

    if (newParentRole !== "ADMIN") {
      operations.push({
        updateOne: {
          filter: { _id: newParentId },
          update: { $push: { downLineEmployees: userId } },
        },
      });
    }

    // Execute all operations in bulk
    if (operations.length > 0) {
      await Manager.bulkWrite(operations, { session });
    }

    // Update user's parent details
    user.basicDetails.parentId = newParentId;
    user.basicDetails.parentRole = newParentRole;
    await user.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    Logger(error, "error");
    throw new Error(error.message || "Internal Server Error.");
  }
};

export {
  validateEmail,
  generateAccess,
  switchRole,
  switchParent,
  updateAttendanceOfHrOh,
  initializeLeaveDocument,
  initializeTourPlanDocument,
};
