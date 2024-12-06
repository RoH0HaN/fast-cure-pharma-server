import { ApiRes, validateFields } from "../util/api.response.js";
import { DVL } from "../models/dvl.models.js";
import { asyncHandler } from "../util/async.handler.js";
import { Logger } from "../util/logger.js";
import { User } from "../models/user.models.js";

const getReasonForPending = async (dvl) => {
  const { isNeedToDelete, isNeedToUpdate, dataToBeUpdated } = dvl;
  if (
    isNeedToDelete &&
    !isNeedToUpdate &&
    Object.keys(dataToBeUpdated).length === 0
  ) {
    return "REQUEST FOR DELETE";
  } else if (
    !isNeedToDelete &&
    isNeedToUpdate &&
    Object.keys(dataToBeUpdated).length > 0
  ) {
    return "REQUEST FOR UPDATE";
  } else {
    return "REQUEST FOR APPROVE";
  }
};

const create = asyncHandler(async (req, res) => {
  // Extract fields from the request body
  const {
    docName,
    qualification,
    area,
    prodOne,
    prodTwo,
    prodThree,
    prodFour,
    freqVisit,
  } = req.body;

  const addedBy = req.user._id; // Extract `addedBy` from the authenticated user's data

  // Validate required fields
  if (
    !validateFields(
      req.body,
      ["docName", "qualification", "prodOne", "freqVisit"],
      res
    )
  ) {
    return; // Exit if validation fails
  }

  try {
    // Use `lean()` to optimize read performance when no document methods are needed
    const existingDVL = await DVL.findOne({
      docName: docName.trim(),
      qualification: qualification.trim(),
      addedBy,
    }).lean();

    // Return early if a duplicate DVL exists
    if (existingDVL) {
      return res.status(400).json(new ApiRes(400, null, "DVL already exists."));
    }

    // Create the DVL object
    const dvl = new DVL({
      docName: docName.trim(),
      qualification: qualification.trim(),
      area: area?.trim(),
      prodOne: prodOne?.trim(),
      prodTwo: prodTwo?.trim(),
      prodThree: prodThree?.trim(),
      prodFour: prodFour?.trim(),
      freqVisit,
      addedBy,
    });

    // Save the new DVL in the database
    await dvl.save();

    // Log the creation event for auditing purposes
    Logger(`${req.user?.name} [${req.user?.empId}], DVL ${docName} created.`);

    // Send a success response
    return res.status(200).json(new ApiRes(200, null, "DVL created."));
  } catch (error) {
    // Log the error and send an internal server error response
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const requestUpdate = asyncHandler(async (req, res) => {
  const {
    _id,
    docName,
    qualification,
    area,
    prodOne,
    prodTwo,
    prodThree,
    prodFour,
    freqVisit,
  } = req.body;

  // Validate required fields
  if (
    !validateFields(
      req.body,
      ["_id", "docName", "qualification", "prodOne", "freqVisit"],
      res
    )
  ) {
    return; // Exit early if validation fails
  }

  try {
    const dvl = await DVL.findById(_id);

    if (!dvl) {
      return res.status(404).json(new ApiRes(404, null, "DVL not found."));
    }

    if (dvl.status !== "APPROVED") {
      return res
        .status(400)
        .json(new ApiRes(400, null, "Update request can't be sent."));
    }

    dvl.dataToBeUpdated = {
      docName: docName.trim(),
      qualification: qualification.trim(),
      area: area?.trim(),
      prodOne: prodOne?.trim(),
      prodTwo: prodTwo?.trim(),
      prodThree: prodThree?.trim(),
      prodFour: prodFour?.trim(),
      freqVisit,
    };
    dvl.status = "PENDING";
    dvl.approvedBy = null;
    dvl.isNeedToUpdate = true;

    await dvl.save();

    // Log the operation
    Logger(
      `${req.user?.name} [${req.user?.empId}], requested updates for DVL ${docName}.`,
      "info"
    );

    // Send success response
    return res.status(200).json(new ApiRes(200, null, "Update request sent."));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const requestDelete = asyncHandler(async (req, res) => {
  const _id = req.params._id;

  if (!_id) {
    return res.status(400).json(new ApiRes(400, null, "DVL ID is required."));
  }

  try {
    const dvl = await DVL.findById(_id);

    if (!dvl) {
      return res.status(404).json(new ApiRes(404, null, "DVL not found."));
    }

    if (dvl.status === "APPROVED") {
      dvl.isNeedToDelete = true;
      dvl.status = "PENDING";
      dvl.approvedBy = null;
      await dvl.save();

      // Log the operation
      Logger(
        `${req.user?.name} [${req.user?.empId}], requested deletion for DVL ${dvl.docName}.`,
        "info"
      );
    } else if (dvl.status === "PENDING") {
      await DVL.findByIdAndDelete(_id);

      // Log the operation
      Logger(
        `${req.user?.name} [${req.user?.empId}], deleted DVL ${dvl.docName}.`,
        "info"
      );
    }

    // Send success response
    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          dvl.status === "PENDING"
            ? `DVL ${dvl.docName} deleted.`
            : `DVL ${dvl.docName} deletion request sent.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const approve = asyncHandler(async (req, res) => {
  const _id = req.params._id;

  if (!_id) {
    return res.status(400).json(new ApiRes(400, null, "DVL ID is required."));
  }

  try {
    const dvl = await DVL.findById(_id);

    if (!dvl) {
      return res.status(404).json(new ApiRes(404, null, "DVL not found."));
    }

    const { status, isNeedToDelete, isNeedToUpdate, dataToBeUpdated, docName } =
      dvl;

    // to approve a newly add DVl
    if (!isNeedToDelete && !isNeedToUpdate && status === "PENDING") {
      dvl.status = "APPROVED";
      dvl.approvedBy = req.user?._id;
      await dvl.save();

      // Log the operation
      Logger(
        `${req.user?.name} [${req.user?.empId}], approved DVL ${docName}.`,
        "info"
      );

      // Send success response
      return res
        .status(200)
        .json(new ApiRes(200, null, `DVL ${docName} approved.`));
    }
    // to approve a delete DVL request
    else if (
      isNeedToDelete &&
      !isNeedToUpdate &&
      status === "PENDING" &&
      Object.keys(dataToBeUpdated).length === 0
    ) {
      await DVL.findByIdAndDelete(_id);

      // Log the operation
      Logger(
        `${req.user?.name} [${req.user?.empId}], deleted DVL ${docName}.`,
        "info"
      );

      // Send success response
      return res
        .status(200)
        .json(new ApiRes(200, null, `DVL ${docName} deleted.`));
    }
    // to approve a update DVL request
    else if (
      isNeedToUpdate &&
      !isNeedToDelete &&
      status === "PENDING" &&
      Object.keys(dataToBeUpdated).length > 0
    ) {
      await DVL.findByIdAndUpdate(
        _id,
        {
          $set: {
            ...dataToBeUpdated,
            dataToBeUpdated: {},
            isNeedToUpdate: false,
            addedBy: dvl.addedBy,
            status: "APPROVED",
            approvedBy: req.user?._id,
          },
        },
        { new: true }
      );

      // Log the operation
      Logger(
        `${req.user?.name} [${req.user?.empId}], updated DVL ${docName}.`,
        "info"
      );

      // Send success response
      return res
        .status(200)
        .json(new ApiRes(200, null, `DVL ${docName} updated.`));
    }

    // Send success response
    return res
      .status(200)
      .json(new ApiRes(200, null, `DVL ${docName} already approved.`));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const reject = asyncHandler(async (req, res) => {
  const _id = req.params._id;

  if (!_id) {
    return res.status(400).json(new ApiRes(400, null, "DVL ID is required."));
  }

  try {
    const dvl = await DVL.findById(_id);

    if (!dvl) {
      return res.status(404).json(new ApiRes(404, null, "DVL not found."));
    }
    const { status, isNeedToDelete, isNeedToUpdate, dataToBeUpdated, docName } =
      dvl;

    // to reject a newly add DVl
    if (!isNeedToDelete && !isNeedToUpdate && status === "PENDING") {
      await DVL.findByIdAndDelete(_id);

      // Log the operation
      Logger(
        `${req.user?.name} [${req.user?.empId}], deleted DVL ${docName}.`,
        "info"
      );

      // Send success response
      return res
        .status(200)
        .json(new ApiRes(200, null, `DVL ${docName} deleted.`));
    }
    // to reject a delete DVL request
    else if (
      isNeedToDelete &&
      !isNeedToUpdate &&
      status === "PENDING" &&
      Object.keys(dataToBeUpdated).length === 0
    ) {
      await DVL.findByIdAndUpdate(
        _id,
        {
          $set: {
            isNeedToDelete: false,
            approvedBy: req.user?._id,
            status: "APPROVED",
          },
        },
        { new: true }
      );

      // Log the operation
      Logger(
        `${req.user?.name} [${req.user?.empId}], updated DVL ${docName}, delete request rejected.`,
        "info"
      );

      // Send success response
      return res
        .status(200)
        .json(new ApiRes(200, null, `DVL ${docName} delete request rejected.`));
    }
    // to reject a update DVL request
    else if (
      isNeedToUpdate &&
      !isNeedToDelete &&
      status === "PENDING" &&
      Object.keys(dataToBeUpdated).length > 0
    ) {
      await DVL.findByIdAndUpdate(
        _id,
        {
          $set: {
            dataToBeUpdated: {},
            isNeedToUpdate: false,
            approvedBy: req.user?._id,
            status: "APPROVED",
          },
        },
        { new: true }
      );

      // Log the operation
      Logger(
        `${req.user?.name} [${req.user?.empId}], updated DVL ${docName}.`,
        "info"
      );

      // Send success response
      return res
        .status(200)
        .json(
          new ApiRes(
            200,
            null,
            `DVL ${docName} updated, update request rejected.`
          )
        );
    }

    // Send success response
    return res
      .status(200)
      .json(new ApiRes(200, null, `DVL ${docName} already approved.`));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const archive = asyncHandler(async (req, res) => {
  const _id = req.params._id;

  if (!_id) {
    return res.status(400).json(new ApiRes(400, null, "DVL ID is required."));
  }

  try {
    const dvl = await DVL.findById(_id);

    if (!dvl) {
      return res.status(404).json(new ApiRes(404, null, "DVL not found."));
    }

    if (dvl.status !== "APPROVED") {
      return res
        .status(400)
        .json(new ApiRes(400, null, "DVL is not approved."));
    }

    dvl.status = "ARCHIVED";
    await dvl.save();

    // Log the operation
    Logger(
      `${req.user?.name} [${req.user?.empId}], archived DVL ${dvl.docName}.`,
      "info"
    );

    // Send success response
    return res
      .status(200)
      .json(new ApiRes(200, null, `DVL ${dvl.docName} archived.`));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const getPendingDVLs = asyncHandler(async (req, res) => {
  const { role, _id } = req.user;
  try {
    const dvls = [];
    const dvlSet = new Set();

    const addUniqueDvl = (dvlList) => {
      dvlList.forEach((dvl) => {
        if (!dvlSet.has(dvl._id.toString())) {
          dvls.push({
            _id: dvl._id,
            empId: dvl.addedBy.empId,
            docName: dvl.docName,
            qualification: dvl.qualification,
            area: dvl.area,
            prodOne: dvl.prodOne,
            prodTwo: dvl.prodTwo,
            prodThree: dvl.prodThree,
            prodFour: dvl.prodFour,
            freqVisit: dvl.freqVisit,
            addedBy: `${dvl.addedBy.name} [${dvl.addedBy.role}]`,
            reason: dvl.isNeedToDelete
              ? "DELETION REQUEST"
              : dvl.isNeedToUpdate
                ? "UPDATE REQUEST"
                : "APPROVAL REQUEST",
            dataToBeUpdated: dvl.dataToBeUpdated,
            isNeedToUpdate: dvl.isNeedToUpdate,
            isNeedToDelete: dvl.isNeedToDelete,
          });
          dvlSet.add(dvl._id.toString());
        }
      });
    };

    if (role === "ADMIN") {
      // Admin fetching all pending DVLs
      const pendingDvls = await DVL.find({ status: "PENDING" })
        .select("-__v -locations -remarks -isArchived")
        .populate("addedBy", "name role empId");
      addUniqueDvl(pendingDvls);
    } else {
      const user = await User.findById(_id).select("downlineEmployees _id");

      const pendingDvls = await DVL.find({
        status: "PENDING",
        addedBy: user._id,
      })
        .select("-__v -locations -remarks -isArchived")
        .populate("addedBy", "name role empId");

      addUniqueDvl(pendingDvls);

      const fetchDownlinePendingDvls = async (employeeIds) => {
        const employees = await User.find({
          _id: { $in: employeeIds },
        }).select("downlineEmployees _id");

        for (const employee of employees) {
          const employeePendingDvls = await DVL.find({
            status: "PENDING",
            addedBy: employee._id,
          })
            .select("-__v -locations -remarks -isArchived")
            .populate("addedBy", "name role empId");

          addUniqueDvl(employeePendingDvls);

          if (employee.downlineEmployees?.length > 0) {
            await fetchDownlinePendingDvls(employee.downlineEmployees);
          }
        }
      };

      if (user.downlineEmployees?.length > 0) {
        await fetchDownlinePendingDvls(user.downlineEmployees);
      }
    }

    // Send success response
    return res.status(201).json(new ApiRes(201, dvls, ""));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const getApprovedDVLs = asyncHandler(async (req, res) => {
  const _id = req.params._id;
  try {
    const dvls = [];
    const dvlSet = new Set();

    const addUniqueDvl = (dvlList) => {
      dvlList.forEach((dvl) => {
        if (!dvlSet.has(dvl._id.toString())) {
          dvls.push({
            _id: dvl._id,
            empId: dvl.addedBy.empId,
            docName: dvl.docName,
            qualification: dvl.qualification,
            area: dvl.area,
            prodOne: dvl.prodOne,
            prodTwo: dvl.prodTwo,
            prodThree: dvl.prodThree,
            prodFour: dvl.prodFour,
            freqVisit: dvl.freqVisit,
            addedBy: `${dvl.addedBy.name} [${dvl.addedBy.role}]`,
            approvedBy: `${dvl.approvedBy.name} [${dvl.approvedBy.role}]`,
            locations: dvl.locations,
            dataToBeUpdated: dvl.dataToBeUpdated,
            isNeedToUpdate: dvl.isNeedToUpdate,
            isNeedToDelete: dvl.isNeedToDelete,
          });
          dvlSet.add(dvl._id.toString());
        }
      });
    };

    const fetchDownlineApprovedDvls = async (employeeIds) => {
      const employees = await User.find({
        _id: { $in: employeeIds },
      }).select("downlineEmployees _id");

      for (const employee of employees) {
        const employeeApprovedDvls = await DVL.find({
          status: "APPROVED",
          isArchived: false,
          addedBy: employee._id,
        })
          .select("-__v -locations -remarks -isArchived")
          .populate([
            { path: "addedBy", select: "name role empId" },
            { path: "approvedBy", select: "name role" },
          ]);

        addUniqueDvl(employeeApprovedDvls);

        if (employee.downlineEmployees?.length > 0) {
          await fetchDownlineApprovedDvls(employee.downlineEmployees);
        }
      }
    };

    const user = await User.findById(_id).select("downlineEmployees _id");

    const approvedDvls = await DVL.find({
      status: "APPROVED",
      isArchived: false,
      addedBy: user._id,
    })
      .select("-__v -locations -remarks -isArchived")
      .populate([
        { path: "addedBy", select: "name role empId" },
        { path: "approvedBy", select: "name role" },
      ]);

    addUniqueDvl(approvedDvls);

    if (user.downlineEmployees?.length > 0) {
      await fetchDownlineApprovedDvls(user.downlineEmployees);
    }

    // Send success response
    return res.status(201).json(new ApiRes(201, dvls, ""));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

export {
  create,
  requestDelete,
  requestUpdate,
  approve,
  reject,
  archive,
  getPendingDVLs,
  getApprovedDVLs,
};
