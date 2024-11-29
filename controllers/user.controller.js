import { ApiRes, validateFields } from "../util/api.response.js";
import { User, Employee, Manager } from "../models/user.models.js";
import { Leave } from "../models/leave.models.js";
import { Attendance } from "../models/attendance.models.js";
import { asyncHandler } from "../util/async.handler.js";
import { Logger } from "../util/logger.js";
import jwt from "jsonwebtoken";
import dayjs from "dayjs";

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

const create = asyncHandler(async (req, res) => {
  const {
    empId,
    role,
    parentRole,
    parentName,
    name,
    password,
    email,
    mobile,
    headquarter,
    pan,
    aadhaar,
    fatherName,
    address,
    hq,
    ex,
    out,
    hillEx,
    hillOut,
    tAll,
    iAll,
    basic,
    hra,
    conAll,
    eduAll,
    speAll,
    medAll,
    mobileAll,
    dateOfBirth,
    dateOfJoining,
    parentId,
    pfNo,
    bankAccNo,
    ifscCode,
    esiNo,
  } = req.body;

  if (
    validateFields(
      req.body,
      [
        "empId",
        "role",
        "parentRole",
        "parentName",
        "name",
        "password",
        "email",
        "mobile",
        "headquarter",
        "pan",
        "aadhaar",
        "fatherName",
        "address",
        "hq",
        "ex",
        "out",
        "hillEx",
        "hillOut",
        "tAll",
        "iAll",
        "basic",
        "hra",
        "conAll",
        "eduAll",
        "speAll",
        "medAll",
        "mobileAll",
        "dateOfBirth",
        "dateOfJoining",
        "parentId",
        "pfNo",
        "bankAccNo",
        "ifscCode",
        "esiNo",
      ],
      res
    ) !== true
  ) {
    return;
  }

  if (!validateEmail(email)) {
    return res
      .status(400)
      .json(new ApiRes(400, null, "Invalid email address."));
  }

  try {
    const existedUser = await User.findOne({ email });
    if (existedUser) {
      return res
        .status(400)
        .json(new ApiRes(400, null, "User with this email already exists."));
    }
    const existedEmpId = await User.findOne({ empId });
    if (existedEmpId) {
      return res
        .status(400)
        .json(new ApiRes(400, null, "Employee Id already exists."));
    }

    let employee;

    const employeeData = {
      empId,
      name,
      email,
      password,
      role,
      mobile,
      headquarter,
      basicDetails: {
        pan,
        aadhaar,
        dateOfBirth,
        dateOfJoining,
        fatherName,
        address,
        parentId,
        parentRole,
        parentName,
      },
      distanceAllowanceDetails: {
        hq,
        ex,
        out,
        hillEx,
        hillOut,
        tAll,
        iAll,
        mobileAll,
      },
      salaryStructure: {
        basic,
        hra,
        conAll,
        eduAll,
        speAll,
        medAll,
        pfNo,
        bankAccNo,
        ifscCode,
        esiNo,
      },
    };

    switch (role) {
      case "TBM" || "HR/OH":
        employee = new Employee(employeeData);
        break;

      case "ABM" || "RBM" || "ZBM":
        employee = new Manager(employeeData);
        break;

      default:
        return res.status(400).json(new ApiRes(400, null, "Invalid role."));
    }

    employee.save();
    if (parentRole !== "ADMIN") {
      await User.findByIdAndUpdate(
        parentId,
        {
          $push: { downLineEmployees: employee._id },
        },
        { new: true }
      );
    }
    await initializeLeaveDocument(employee._id, dateOfJoining);
    return res.status(200).json(new ApiRes(200, null, "User created."));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal Server Error."));
  }
});

const createAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, role, mobile, headquarter, empId } = req.body;

  if (
    validateFields(
      req.body,
      ["name", "email", "password", "role", "mobile", "headquarter", "empId"],
      res
    ) !== true
  ) {
    return;
  }

  if (!validateEmail(email)) {
    return res
      .status(400)
      .json(new ApiRes(400, null, "Invalid email address."));
  }

  try {
    const existedUser = await User.findOne({ email });
    if (existedUser) {
      return res
        .status(400)
        .json(
          new ApiRes(400, null, "Employee with this email already exists.")
        );
    }
    const existedEmpId = await User.findOne({ empId });
    if (existedEmpId) {
      return res
        .status(400)
        .json(new ApiRes(400, null, "Employee Id already exists."));
    }

    const user = new User({
      name,
      email,
      password,
      role,
      mobile,
      headquarter,
      empId,
    });

    await user.save();

    return res.status(200).json(new ApiRes(200, null, "Admin created."));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal Server Error."));
  }
});

const login = asyncHandler(async (req, res) => {
  const { credential, password } = req.body;

  if (validateFields(req.body, ["credential", "password"], res) !== true) {
    return;
  }

  try {
    let user;

    if (validateEmail(credential)) {
      user = await User.findOne({ email: credential }).select(
        "_id empId name email password role headquarter mobile"
      );
    } else {
      user = await User.findOne({ empId: credential }).select(
        "_id empId name email password role headquarter mobile"
      );
    }

    if (!user) {
      return res.status(404).json(new ApiRes(404, null, "User not found."));
    }

    if (user.password !== password) {
      return res.status(401).json(new ApiRes(401, null, "Invalid password."));
    }

    if (user.role === "HR/OH") {
      await updateAttendanceOfHrOh(user._id);
    }

    const { accessToken } = await generateAccess(user._id);

    const options = {
      httpOnly: true,
      secure: true,
    };

    Logger(`User ${user.empId} logged in`, "info");

    return res
      .status(201)
      .cookie("token", accessToken, options)
      .json(new ApiRes(201, { accessToken, ...user._doc }, "Login success."));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal Server Error."));
  }
});

const changePassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;

  if (validateFields(req.body, ["newPassword"], res) !== true) {
    return;
  }

  try {
    const user = await User.findById(req.user._id);
    user.password = newPassword;
    await user.save();
    return res.status(200).json(new ApiRes(200, null, "Password changed."));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal Server Error."));
  }
});

export { create, createAdmin, login, changePassword };
