import { ApiRes, validateFields } from "../util/api.response.js";
import { Misc } from "../models/misc.models.js";
import { asyncHandler } from "../util/async.handler.js";
import { Logger } from "../util/logger.js";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween.js";
dayjs.extend(isBetween);

const create = asyncHandler(async (req, res) => {
  const miscs = req.body; // Extract miscellaneous items from the request body
  const empId = req.user._id; // Extract employee ID from the authenticated user
  const empName = req.user.name; // Extract employee name from the authenticated user

  // Validate that `miscs` is provided and not empty
  if (!Array.isArray(miscs) || miscs.length === 0) {
    return res
      .status(400)
      .json(new ApiRes(400, null, "Miscellaneous items are required."));
  }

  try {
    // Use a consistent date format for the current day
    const date = dayjs().format("YYYY-MM-DD");

    // Check if there is already a Misc record for the employee
    let existingMisc = await Misc.findOne({ empId });

    if (existingMisc) {
      // Extract and check existing data for the current date
      const existingMiscData = existingMisc.miscs || {};

      if (existingMiscData[date]) {
        return res
          .status(400)
          .json(
            new ApiRes(
              400,
              null,
              "Miscellaneous already exists for today. Please try again tomorrow."
            )
          );
      }

      // Add today's miscellaneous items to the existing data
      existingMiscData[date] = miscs;
      existingMisc.miscs = existingMiscData;

      // Mark `miscs` as modified for Mongoose to track changes
      existingMisc.markModified("miscs");
      await existingMisc.save();
    } else {
      // Create a new Misc document if none exists for the employee
      const newMisc = {
        [date]: miscs, // Use an object to represent the date-to-items mapping
      };

      await Misc.create({ empId, miscs: newMisc });
    }

    // Log the successful operation
    Logger(`Miscellaneous added for employee ${empName} on ${date}.`, "info");

    return res
      .status(200)
      .json(new ApiRes(200, null, "Miscellaneous added for today."));
  } catch (error) {
    // Log the error for debugging purposes
    Logger(error, "error");

    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const getMiscellaneous = asyncHandler(async (req, res) => {
  const { _id, fromDate, toDate } = req.query;

  // Validate required fields
  if (!validateFields(req.query, ["_id", "fromDate", "toDate"], res)) {
    return;
  }

  try {
    // Retrieve the employee's miscellaneous data
    const existingMisc = await Misc.findOne({ empId: _id });

    // If no miscellaneous data exists, return an empty response
    if (!existingMisc || !existingMisc.miscs) {
      return res
        .status(200)
        .json(new ApiRes(200, [], "No miscellaneous records found."));
    }

    // Filter the miscellaneous data within the specified date range
    const filteredMiscData = Object.entries(existingMisc.miscs)
      .filter(([key]) => {
        // Use dayjs for date comparison, including edge cases
        return dayjs(key).isBetween(fromDate, toDate, "day", "[]");
      })
      .flatMap(([date, miscArray]) => {
        // Append the date to each misc item in the filtered array
        return miscArray.map((misc) => ({ ...misc, date }));
      });

    // If no data matches the date range, return an appropriate response
    if (filteredMiscData.length === 0) {
      return res
        .status(200)
        .json(
          new ApiRes(
            200,
            [],
            `No miscellaneous records found from ${fromDate} to ${toDate}.`
          )
        );
    }

    // Return the filtered data with a success response
    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          filteredMiscData,
          `Miscellaneous records found from ${fromDate} to ${toDate}.`
        )
      );
  } catch (error) {
    // Log the error and return a server error response
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

export { create, getMiscellaneous };
