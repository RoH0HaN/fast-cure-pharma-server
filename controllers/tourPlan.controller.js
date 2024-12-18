import {
  getCurrentYearAndNextMonth,
  hasDownlineTourPlans,
} from "../util/helpers/tourPlan.helpers.js";
import { ApiRes, validateFields } from "../util/api.response.js";
import { TourPlan } from "../models/tourPlan.models.js";
import { User } from "../models/user.models.js";
import { DCR } from "../models/dcr.models.js";
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
      existingTourPlan = await TourPlan.create({ empId: _id });
    } else {
      // Role-based restrictions for creating tour plans
      const createAllowed =
        (role === "TBM" && todayDate >= 20 && todayDate <= 25) ||
        (role !== "TBM" && todayDate >= 20 && todayDate <= 27);

      if (!createAllowed && !existingTourPlan.isExtraDayForCreated) {
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
    const tourPlans = Object.fromEntries(existingTourPlan.tourPlan) || {};

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

    // --- Update the isExtraDayForCreated and isExtraDayForApproved flags
    // existingTourPlan.isExtraDayForCreated = false;
    // existingTourPlan.isExtraDayForApproved = false;

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

    if (!createAllowed && !existingTourPlan.isExtraDayForCreated) {
      return res
        .status(300) // used in android app for warning
        .json(
          new ApiRes(
            300,
            null,
            `${name}, You can update tour plans only between 20th and 25th of every month. Please contact ADMIN for more information.`
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
    // Fetch employee details
    const employee = await User.findById(_id).select("headquarter role");

    if (!employee) {
      return res.status(404).json(new ApiRes(404, null, "Employee not found."));
    }

    // Fetch places under headquarter if not TBM
    let placesUnderHeadquarter = [];
    if (employee.role !== "TBM") {
      const employeeHeadquarter = await Headquarter.findOne({
        name: employee.headquarter,
      })
        .select("places")
        .populate("places", "name type");

      if (employeeHeadquarter?.places) {
        placesUnderHeadquarter = [...employeeHeadquarter.places];
        placesUnderHeadquarter.push({ name: employee.headquarter, type: "HQ" });
      }
    }

    // Fetch tour plan for the employee
    const tourPlan = await TourPlan.findOne({ empId: _id });
    if (!tourPlan) {
      return res
        .status(300)
        .json(new ApiRes(300, null, "Tour plan not found."));
    }

    const tourPlans = Object.fromEntries(tourPlan.tourPlan || {});

    if (!tourPlans[year] || !tourPlans[year][month]) {
      return res
        .status(300)
        .json(new ApiRes(300, null, "Tour plan not found for this month."));
    }

    const monthData = tourPlans[year][month];
    const tourPlanDates = monthData.map((item) => item.date);

    // Fetch DCR reports for the tour plan dates
    const dcrReports = await DCR.find({
      reportDate: { $in: tourPlanDates },
      $or: [{ createdBy: _id }],
    }).select("reportDate area");

    // Build maps for quick lookup
    const dcrReportsMap = new Map(
      dcrReports.map((report) => [report.reportDate, report.area])
    );
    const dcrReportsExistsMap = new Map(
      dcrReports.map((report) => [report.reportDate, report._id])
    );

    // Fetch all unique places mentioned in the tour plan
    const uniquePlaces = [
      ...new Set(monthData.map((item) => item.place).filter(Boolean)),
    ];

    // Fetch all places and headquarters data in one go
    const placesDetails = await Place.find({
      name: { $in: uniquePlaces },
    }).select("name type");
    const hqDetails = await Headquarter.find({
      name: { $in: uniquePlaces },
    }).select("name type");

    const placesMap = new Map(
      [...placesDetails, ...hqDetails].map((place) => [place.name, place])
    );

    // Build the modified tour plan
    const modifiedTourPlan = monthData.map((item) => {
      const place = item.place;
      const date = item.date;
      const changedArea = dcrReportsMap.get(date) || "";
      const remarks = item.remarks || "";

      let area = "";
      let type = "";

      if (place) {
        const placeDetails = placesMap.get(place);
        if (placeDetails) {
          area = placeDetails.name;
          type = placeDetails.type;
        }

        // Adjust type based on headquarter places for non-TBM employees
        if (employee.role !== "TBM") {
          type =
            placesUnderHeadquarter.find((hqPlace) => hqPlace.name === area)
              ?.type || "OUT";
        }

        // Update type based on changed area
        if (changedArea) {
          const changedPlaceDetails = placesMap.get(changedArea);
          type = changedPlaceDetails ? changedPlaceDetails.type : "HQ";
        }
      }

      const reportId = dcrReportsExistsMap.get(date);
      return {
        date: item.date || "date",
        day: item.day || "day",
        place: area,
        type: type || "",
        remarks: remarks || "",
        isApproved: item.isApproved || false,
        changedArea: changedArea,
        reportId: reportId,
        isReportExists: reportId ? true : false,
      };
    });

    return res.status(201).json(
      new ApiRes(
        201,
        {
          empId: _id,
          tourPlan: modifiedTourPlan,
          isExtraDayForCreated: tourPlan.isExtraDayForCreated,
          isExtraDayForApproved: tourPlan.isExtraDayForApproved,
        },
        "Tour plan found."
      )
    );
  } catch (error) {
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

    //Check approval date constraints for non-admin users
    if (
      role !== "ADMIN" &&
      !existingTourPlan.isExtraDayForApproved &&
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

    const tourPlans = existingTourPlan.tourPlan || {};
    const updates = [];

    // Prepare updates for only the necessary fields
    selectedPlanDates.forEach((date) => {
      let [year, month] = date.split("-");
      month = Number(month);

      if (tourPlans[year]?.[month]) {
        const monthlyPlan = tourPlans[year][month];
        const tourDate = monthlyPlan.find((item) => item.date === date);

        if (tourDate && !tourDate.isApproved) {
          tourDate.isApproved = true;

          // Push the update to the list of bulk updates
          updates.push({
            filter: {
              empId: _id,
              [`tourPlan.${year}.${month}.date`]: date,
            },
            update: {
              $set: {
                [`tourPlan.${year}.${month}.$.isApproved`]: true,
                isExtraDayForApproved: false,
              },
            },
          });
        }
      }
    });

    // Apply bulk updates
    if (updates.length > 0) {
      const bulkOps = updates.map((u) => ({
        updateOne: u,
      }));

      await TourPlan.bulkWrite(bulkOps);
    }

    return res.status(200).json(new ApiRes(200, null, "Tour plan approved."));
  } catch (error) {
    console.log("error", error);
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
      type === "create" ? "isExtraDayForCreated" : "isExtraDayForApproved";

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

    if (!tourPlan?.tourPlans?.[year] || !tourPlan?.tourPlans?.[year]?.[month]) {
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

    const todayPlan = tourPlan.tourPlans?.[year]?.[month]?.find(
      (item) => item.date === today && item.isApproved == true
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
