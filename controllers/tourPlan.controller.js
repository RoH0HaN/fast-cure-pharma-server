import {
  getCurrentYearAndNextMonth,
  hasDownlineTourPlans,
} from "../util/helpers/tourPlan.helpers.js";
import { ApiRes, validateFields } from "../util/api.response.js";
import { TourPlan } from "../models/tourPlan.models.js";
import { User } from "../models/user.models.js";
import { Headquarter, Place } from "../models/headquarter.models.js";
import { asyncHandler } from "../util/async.handler.js";
import { Logger } from "../util/logger.js";
import dayjs from "dayjs";

const create = asyncHandler(async (req, res) => {
  const { name, role, _id } = req.user;
  const tourPlan = req.body;

  if (!Array.isArray(tourPlan) || tourPlan.length === 0) {
    return res
      .status(400)
      .json(new ApiRes(400, null, "Tour plan entries are required."));
  }

  try {
    const { year, month } = getCurrentYearAndNextMonth();
    const todayDate = dayjs().date();

    let existingTourPlan = await TourPlan.findOne({ empId: _id });

    // Ensure the tour plan exists or create a new one
    if (!existingTourPlan) {
      existingTourPlan = new TourPlan({ empId: _id });
    } else {
      // Role-based restrictions for creating tour plans
      const createAllowed =
        (role === "TBM" && todayDate >= 20 && todayDate <= 25) ||
        (role !== "TBM" && todayDate >= 20 && todayDate <= 27);

      if (!createAllowed && !existingTourPlan.isExtraDayForCreate) {
        return res
          .status(300) // used in android app for warning
          .json(
            new ApiRes(
              300,
              null,
              `${name}, You can create tour plans only between 20th and 25th of every month. Please contact ADMIN for more information.`
            )
          );
      }
    }

    // Check for downline employees' tour plans (non-TBM roles)
    if (role !== "TBM") {
      const employeesWithNoTourPlans = await hasDownlineTourPlans(
        _id,
        year,
        month
      );

      if (employeesWithNoTourPlans.length > 0) {
        return res.status(203).json(
          new ApiRes(
            203, // used in android app for warning
            employeesWithNoTourPlans,
            `${name}, Some of your downline employees do not have tour plans.`
          )
        );
      }
    }

    // Validate and update the tour plan
    const tourPlans = existingTourPlan.tourPlan || {};

    if (!tourPlans[year]) tourPlans[year] = {};
    if (tourPlans[year][month]) {
      return res.status(300).json(
        new ApiRes(
          300, // used in android app for warning
          null,
          `${name}, Your tour plan already exists for month ${month}.`
        )
      );
    }

    tourPlans[year][month] = tourPlan;

    existingTourPlan.tourPlan = new Map(Object.entries(tourPlans));
    existingTourPlan.isExtraDayForCreate = false;
    existingTourPlan.isExtraDayForUpdate = false;

    await existingTourPlan.save();

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, Your tour plan has been created successfully for month ${month}.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const update = asyncHandler(async (req, res) => {
  const { name, role, _id } = req.user;
  const tourPlan = req.body;
  if (!Array.isArray(tourPlan) || tourPlan.length === 0) {
    return res
      .status(400)
      .json(new ApiRes(400, null, "Tour plan entries are required."));
  }
  try {
    const { year, month } = getCurrentYearAndNextMonth();
    const todayDate = dayjs().date();

    let existingTourPlan = await TourPlan.findOne({ empId: _id }).lean(); //Lean for performance cause no extra mongoose methods won't come along

    // Ensure the tour plan exists or create a new one
    if (!existingTourPlan) {
      return res
        .status(404)
        .json(new ApiRes(404, null, `${name}, No tour plan found.`));
    }
    //Role-based restrictions for creating tour plans
    const createAllowed =
      (role === "TBM" && todayDate >= 20 && todayDate <= 25) ||
      (role !== "TBM" && todayDate >= 20 && todayDate <= 27);

    if (!createAllowed && !existingTourPlan.isExtraDayForCreate) {
      return res
        .status(300) // used in android app for warning
        .json(
          new ApiRes(
            300,
            null,
            `${name}, You can create tour plans only between 20th and 25th of every month. Please contact ADMIN for more information.`
          )
        );
    }

    const tourPlans = existingTourPlan.tourPlan || {};

    if (!tourPlans[year] || !tourPlans[year][month]) {
      return res
        .status(404)
        .json(
          new ApiRes(
            404,
            null,
            `${name}, No tour plan found for month ${month}.`
          )
        );
    }
    // Update tour plans
    const existingTourPlanList = tourPlans[year][month];

    const updatedTourPlanList = tourPlan.map((item, index) => {
      const currentPlan = existingTourPlanList[index] || {};

      return {
        date: item.date,
        day: item.day,
        place: item.place,
        remarks: item.remarks,
        isApproved:
          currentPlan.place === item.place ? currentPlan.isApproved : false,
      };
    });

    // Save updated tour plans
    tourPlans[year][month] = updatedTourPlanList;

    await TourPlan.updateOne(
      { empId: _id },
      {
        $set: {
          [`tourPlan.${year}.${month}`]: updatedTourPlanList,
          isExtraDayForCreate: false,
        },
      }
    );

    return res
      .status(200)
      .json(new ApiRes(200, null, `${name}, Your tour plan has been updated.`));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const getTourPlan = asyncHandler(async (req, res) => {
  const { _id, year, month } = req.query;

  if (!validateFields(req.query, ["_id", "year", "month"], res)) {
    return;
  }

  try {
    const employee = await User.findById(_id).select("headquarter role");

    if (!employee) {
      return res.status(404).json(new ApiRes(404, null, "Employee not found."));
    }

    if (employee.role !== "TBM") {
      const employeeHeadquarter = await Headquarter.findOne({
        name: employee.headquarter,
      })
        .select("places")
        .populate("places");

      const placesUnderHeadquarter = employeeHeadquarter.places;
      placesUnderHeadquarter.push({ name: employee.headquarter, type: "HQ" });
    }

    const tourPlan = await TourPlan.findOne({
      empId: _id,
    });

    if (!tourPlan) {
      return res.status(300).json(new ApiRes(300, [], "Tour plan not found."));
    }

    let tourPlans = Object.fromEntries(tourPlan.tourPlan || {});

    if (!tourPlans[year] || !tourPlans[year][month]) {
      return res
        .status(300)
        .json(new ApiRes(300, [], "Tour plan not found for this month."));
    }
    const yearData = tourPlans[year];
    const monthData = yearData[month];

    // const tourPlanDates = monthData.map((item) => item.date);

    //TODO: need to check area and changed area from the dcr report to show in tour plan

    const modifiedTourPlan = monthData.map((item) => {
      return {
        date: item.date || "date",
        day: item.day || "day",
        place: item.place,
        type: item.type || "type",
        remarks: item.remarks || "remarks",
        isApproved: item.isApproved || false,
        changedArea: "changedArea",
        reportId: "reportId",
      };
    });

    return res.status(201).json(
      new ApiRes(
        201,
        {
          empId: _id,
          tourPlan: modifiedTourPlan,
          isExtraDayForCreate: tourPlan.isExtraDayForCreate,
          isExtraDayForApprove: tourPlan.isExtraDayForApprove,
        },
        "Tour plan found."
      )
    );
  } catch (error) {
    console.log(error);

    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const getTourPlanForEdit = asyncHandler(async (req, res) => {
  const { _id, name } = req.user;

  try {
    const { year, month } = getCurrentYearAndNextMonth();

    const tourPlan = await TourPlan.findOne({
      empId: _id,
    });

    if (!tourPlan) {
      return res.status(404).json(new ApiRes(404, null, ""));
    }

    let tourPlans = Object.fromEntries(tourPlan.tourPlan);

    if (!tourPlans[year] || !tourPlans[year][month]) {
      return res
        .status(300)
        .json(
          new ApiRes(
            300,
            null,
            `${name}, no existing tour plan found to edit, create one first.`
          )
        );
    }

    return res
      .status(201)
      .json(
        new ApiRes(
          201,
          tourPlans[year][month],
          `${name}, an existing tour plan found for month ${month} & year ${year} you can't add a new one until next month's 20th.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const approveTourPlanDates = asyncHandler(async (req, res) => {
  const role = req.user.role;
  const _id = req.params._id;
  const selectedPlanDates = req.body;

  // Validate input
  if (!Array.isArray(selectedPlanDates) || selectedPlanDates.length === 0) {
    return res
      .status(400)
      .json(new ApiRes(400, null, "Tour plan entries are required."));
  }

  try {
    const todayDate = dayjs().date();

    // Fetch the tour plan for the employee
    const existingTourPlan = await TourPlan.findOne({ empId: _id }).lean();

    if (!existingTourPlan) {
      return res
        .status(404)
        .json(new ApiRes(404, null, "Tour plan not found for this employee."));
    }

    // Check approval date constraints for non-admin users
    if (
      role !== "ADMIN" &&
      !existingTourPlan.isExtraDayForApprove &&
      (todayDate < 20 || todayDate > 27)
    ) {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            "Tour plan can be approved only between 20 and 27th of every month. Please contact admin."
          )
        );
    }

    const updatedPlans = {};

    // Update tour plan approval status
    selectedPlanDates.forEach((date) => {
      const [year, month] = date.split("-");

      if (existingTourPlan.tourPlan?.[year]?.[month]) {
        const monthlyPlan = existingTourPlan.tourPlan[year][month];
        const tourDate = monthlyPlan.find((item) => item.date === date);

        if (tourDate && !tourDate.isApproved) {
          tourDate.isApproved = true;

          // Track changes for efficient saving
          if (!updatedPlans[year]) updatedPlans[year] = {};
          if (!updatedPlans[year][month]) updatedPlans[year][month] = [];
          updatedPlans[year][month].push(tourDate);
        }
      }
    });

    // Directly update only the modified fields in the database
    const bulkUpdates = [];
    for (const year in updatedPlans) {
      for (const month in updatedPlans[year]) {
        bulkUpdates.push({
          updateOne: {
            filter: { empId: _id },
            update: {
              [`tourPlan.${year}.${month}`]: updatedPlans[year][month],
              isExtraDayForApprove: false,
            },
          },
        });
      }
    }

    if (bulkUpdates.length > 0) {
      await TourPlan.bulkWrite(bulkUpdates);
    }

    return res.status(200).json(new ApiRes(200, null, "Tour plan approved."));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const allowExtraDay = asyncHandler(async (req, res) => {
  const { _id } = req.params;
  const { type } = req.query; // 'create' or 'approve'

  if (!_id || !["create", "approve"].includes(type)) {
    return res
      .status(400)
      .json(
        new ApiRes(
          400,
          null,
          "Employee ID and a valid type ('create' or 'approve') are required."
        )
      );
  }

  try {
    const updateField =
      type === "create" ? "isExtraDayForCreate" : "isExtraDayForApprove";

    // Upsert the document: Create if not exists, update if exists
    const result = await TourPlan.findOneAndUpdate(
      { empId: _id },
      {
        $set: {
          [updateField]: true,
        },
        $setOnInsert: {
          empId: _id,
          tourPlan: {},
        },
      },
      {
        new: true,
        upsert: true,
      }
    );

    const message =
      type === "create"
        ? "Extra day added for creating tour plan successfully."
        : "Extra day added for approving tour plan successfully.";

    return res.status(200).json(new ApiRes(200, result, message));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const getTodayTourPlanArea = asyncHandler(async (req, res) => {
  const { _id: userId, name } = req.user;

  try {
    const [year, month] = dayjs().format("YYYY-MM").split("-");
    const today = dayjs().format("YYYY-MM-DD");
    const tourPlan = await TourPlan.findOne({
      empId: userId,
    });

    let todayArea = "";

    if (!tourPlan?.tourPlans[year] || !tourPlan?.tourPlans[year][month]) {
      return res
        .status(300)
        .json(
          new ApiRes(
            300,
            null,
            `${name}, You don't have an existing tour plan.`
          )
        );
    }

    const todayPlan = tourPlan.tourPlans[year][month].find(
      (item) => item.date === today
    );

    if (todayPlan) {
      todayArea = todayPlan.area;
    }

    return res.status(200).json(new ApiRes(200, todayArea, ""));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

export {
  create,
  update,
  getTourPlan,
  approveTourPlanDates,
  allowExtraDay,
  getTourPlanForEdit,
  getTodayTourPlanArea,
};
