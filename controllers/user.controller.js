import {
  validateEmail,
  generateAccess,
  switchRole,
  switchParent,
  updateAttendanceOfHrOh,
  initializeLeaveDocument,
  initializeTourPlanDocument,
} from "../util/helpers/user.helpers.js";
import { ApiRes, validateFields } from "../util/api.response.js";
import { User, Employee, Manager } from "../models/user.models.js";
import { asyncHandler } from "../util/async.handler.js";
import { Logger } from "../util/logger.js";

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
      case "TBM":
      case "HR/OH":
        employee = new Employee(employeeData);
        break;

      case "ABM":
      case "ZBM":
      case "ZBM":
        employee = new Manager(employeeData);
        break;

      default:
        return res.status(400).json(new ApiRes(400, null, "Invalid role."));
    }

    employee.save();
    if (parentRole !== "ADMIN") {
      await Employee.findByIdAndUpdate(
        parentId,
        {
          $push: { downLineEmployees: employee._id },
        },
        { new: true }
      );
    }
    await initializeTourPlanDocument(employee._id);
    await initializeLeaveDocument(employee._id, dateOfJoining);
    return res.status(200).json(new ApiRes(200, null, "User created."));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal Server Error."));
  }
});

const update = asyncHandler(async (req, res) => {
  const {
    _id,
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

  // Validate required fields
  if (
    validateFields(
      req.body,
      [
        "_id",
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

  // Validate email format
  if (!validateEmail(email)) {
    return res
      .status(400)
      .json(new ApiRes(400, null, "Invalid email address."));
  }

  try {
    // Check if the user exists
    const user = await User.findById(_id);
    if (!user) {
      return res
        .status(400)
        .json(new ApiRes(400, null, "User with this ID does not exist."));
    }

    // Handle changes to the parentId and update references accordingly
    if (parentId !== user.basicDetails?.parentId) {
      const session = await User.startSession(); // Start a session for transaction
      session.startTransaction();
      try {
        // Remove user from the old parent's downline
        await User.findByIdAndUpdate(
          user.basicDetails?.parentId,
          { $pull: { downLineEmployees: user._id } },
          { session }
        );

        // Add user to the new parent's downline, unless the parentRole is ADMIN
        if (parentRole !== "ADMIN") {
          await User.findByIdAndUpdate(
            parentId,
            { $addToSet: { downLineEmployees: user._id } },
            { session }
          );
        }

        await session.commitTransaction();
        session.endSession();
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
      }
    }

    if (role !== user.role && role !== "ADMIN") {
      await switchRole(user._id, role);
    }

    if (user.basicDetails.parentId !== parentId) {
      await switchParent(user._id, parentId);
    }

    // Build the updated employee data
    const employeeData = {
      empId,
      name,
      email,
      password, // Ensure this is hashed elsewhere for security
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
      case "ZBM":
      case "RBM":
      case "ABM":
        // Update the user data
        await Manager.findByIdAndUpdate(
          _id,
          {
            $set: employeeData,
          },
          {
            new: true,
          }
        );

        break;
      case "TBM":
      case "HR/OH":
        // Update the user data
        await Employee.findByIdAndUpdate(
          _id,
          {
            $set: employeeData,
          },
          {
            new: true,
          }
        );

        break;

      default:
        break;
    }

    Logger(`User ${empId} updated`, "info");
    return res
      .status(200)
      .json(new ApiRes(200, null, `User ${empId} updated.`));
  } catch (error) {
    // Log and handle unexpected errors
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal Server Error."));
  }
});

const view = asyncHandler(async (req, res) => {
  const _id = req.params._id;

  if (!_id) {
    return res.status(400).json(new ApiRes(400, null, "User ID is required."));
  }

  try {
    // Check if the user exists
    const user = await User.findById(_id);
    if (!user) {
      return res
        .status(400)
        .json(new ApiRes(400, null, "User with this ID does not exist."));
    }

    Logger(`User ${user.empId} viewed`, "info");
    return res
      .status(201)
      .json(new ApiRes(201, user, `User ${user.empId} viewed.`));
  } catch (error) {
    // Log and handle unexpected errors
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

const archive = asyncHandler(async (req, res) => {
  const _id = req.params._id;

  if (!_id) {
    return res.status(400).json(new ApiRes(400, null, "User ID is required."));
  }

  if (req.user.role !== "ADMIN") {
    return res
      .status(403)
      .json(
        new ApiRes(403, null, "You are not authorized to perform this action.")
      );
  }
  try {
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json(new ApiRes(404, null, "User not found."));
    }
    user.isArchived = true;
    await user.save();
    return res.status(200).json(new ApiRes(200, user, "User archived."));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal Server Error."));
  }
});

const getDownlineEmployees = asyncHandler(async (req, res) => {
  const { _id, role } = req.user;

  try {
    // Define a Set to track processed employees and avoid duplicates
    const processedSet = new Set();
    const downlines = [];

    // Add employee to the downline list
    const addEmployee = (employee) => {
      if (!processedSet.has(employee._id.toString())) {
        processedSet.add(employee._id.toString());
        downlines.push({
          _id: employee._id,
          name: employee.name,
          empId: employee.empId,
        });
      }
    };

    // Recursive function to fetch all downlines
    const fetchDownLineEmployees = async (downLineEmployees) => {
      // Fetch all downline employees in a single query
      const employees = await User.find({
        _id: { $in: downLineEmployees },
      }).select("_id empId name role downLineEmployees");

      for (const employee of employees) {
        addEmployee(employee);

        // Continue fetching if the employee has a downline
        if (employee.downLineEmployees?.length > 0) {
          await fetchDownLineEmployees(employee.downLineEmployees);
        }
      }
    };

    // Handle ADMIN and HR/OH roles
    if (role === "ADMIN" || role === "HR/OH") {
      // Fetch all employees
      const allEmployees = await User.find({ role: { $ne: "ADMIN" } }).select(
        "_id name empId"
      );
      allEmployees.forEach(addEmployee);
    } else {
      // For other roles, fetch the current user's record and their downlines
      const currentUser = await User.findById(_id).select(
        "_id empId name role downLineEmployees"
      );

      addEmployee(currentUser);

      // Fetch downline employees
      await fetchDownLineEmployees(currentUser.downLineEmployees);
    }

    // Return the accumulated downlines
    return res.status(200).json(new ApiRes(200, downlines, ""));
  } catch (error) {
    // Log and handle server errors
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal Server Error."));
  }
});

// API's specific for Web App --->
const getEmployeesDataForTable = asyncHandler(async (req, res) => {
  try {
    let employees = await User.find({ role: { $ne: "ADMIN" } }).select(
      "_id empId name basicDetails.parentName role password headquarter email isArchived -__t"
    );

    if (!employees.length) {
      return res.status(200).json(new ApiRes(200, [], `No employees found.`));
    }

    employees = employees.map((employee) => {
      return {
        _id: employee._id,
        empId: employee.empId,
        name: employee.name,
        parentName: employee._doc.basicDetails.parentName,
        role: employee.role,
        password: employee.password,
        headquarter: employee.headquarter,
        email: employee.email,
        isArchived: employee.isArchived,
      };
    });

    return res.status(200).json(new ApiRes(200, employees, ""));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal Server Error."));
  }
});

const getEmployeesIdAndNameBasedOnRole = asyncHandler(async (req, res) => {
  const employeeRole = req.params.role;

  if (!validateFields(req.params, ["role"], res)) {
    return;
  }

  try {
    const employees = await User.find({ role: employeeRole }).select(
      "_id name"
    );

    if (!employees.length) {
      return res
        .status(200)
        .json(
          new ApiRes(200, [], `No employees found of role ${employeeRole}.`)
        );
    }

    return res
      .status(200)
      .json(
        new ApiRes(200, employees, `All employees of role ${employeeRole}.`)
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal Server Error."));
  }
});
// API's specific for Web App --->

export {
  create,
  createAdmin,
  login,
  changePassword,
  update,
  view,
  archive,
  getEmployeesIdAndNameBasedOnRole,
  getDownlineEmployees,
  getEmployeesDataForTable,
};
