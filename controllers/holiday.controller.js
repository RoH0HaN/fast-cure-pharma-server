import { ApiRes, validateFields } from "../util/api.response.js";
import { Holiday } from "../models/holiday.models.js";
import { asyncHandler } from "../util/async.handler.js";
import { Logger } from "../util/logger.js";

const createHoliday = asyncHandler(async (req, res) => {
  const holidays = req.body;

  // Validate input
  if (!Array.isArray(holidays) || holidays.length === 0) {
    return res
      .status(400)
      .json(new ApiRes(400, null, "Holidays are required."));
  }

  try {
    // Filter out invalid holiday objects without title or date
    const validHolidays = holidays.filter(
      (holiday) => holiday.title && holiday.date
    );

    if (validHolidays.length === 0) {
      return res
        .status(400)
        .json(new ApiRes(400, null, "No valid holidays to create."));
    }

    // Extract dates from the valid holidays
    const holidayDates = validHolidays.map((holiday) => holiday.date);

    // Fetch existing holidays with the same dates
    const existingHolidays = await Holiday.find({
      date: { $in: holidayDates },
    }).select("date");

    // Create a Set of existing holiday dates for quick lookup
    const existingDatesSet = new Set(existingHolidays.map((h) => h.date));

    // Filter out holidays that already exist
    const newHolidays = validHolidays.filter(
      (holiday) => !existingDatesSet.has(holiday.date)
    );

    if (newHolidays.length === 0) {
      return res
        .status(200)
        .json(
          new ApiRes(
            200,
            null,
            "All holidays already exist, no new holidays created."
          )
        );
    }

    // Prepare documents for bulk insertion
    const holidayDocs = newHolidays.map((holiday) => ({
      title: holiday.title,
      date: holiday.date,
    }));

    // Perform bulk insert for new holidays
    await Holiday.insertMany(holidayDocs);

    Logger(`Holidays created by ${req.user?.name || "unknown user"}.`, "info");

    return res
      .status(200)
      .json(new ApiRes(200, null, `${newHolidays.length} holiday(s) created.`));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const updateHoliday = asyncHandler(async (req, res) => {
  const { _id, title, date } = req.body;

  // Validate required fields (_id, title, date)
  if (!validateFields(req.body, ["_id", "title", "date"], res)) {
    return;
  }

  try {
    // Use findOneAndUpdate for a single query approach
    const updatedHoliday = await Holiday.findOneAndUpdate(
      { _id },
      { $set: { title, date } },
      { new: true } // Returns updated document and applies validation
    );

    if (!updatedHoliday) {
      // If no holiday is found, respond with 404
      return res.status(404).json(new ApiRes(404, null, "Holiday not found."));
    }

    // Log the update action
    Logger(
      `Holiday updated: ID=${_id}, Title: ${updatedHoliday.title}, Date: ${updatedHoliday.date}.`,
      "info"
    );

    // Respond with a success message
    return res
      .status(200)
      .json(
        new ApiRes(200, null, `Holiday "${updatedHoliday.title}" updated.`)
      );
  } catch (error) {
    // Log and handle unexpected errors
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const deleteHoliday = asyncHandler(async (req, res) => {
  const { _id } = req.params; // Extract the holiday ID from the request parameters

  // Validate the required field (_id)
  if (!_id) {
    // Respond with a 400 Bad Request if the holiday ID is missing
    return res
      .status(400)
      .json(new ApiRes(400, null, "Holiday ID is required."));
  }

  try {
    // Step 1: Check if the holiday exists
    const holiday = await Holiday.findById(_id);
    if (!holiday) {
      // Respond with a 404 Not Found if the holiday does not exist
      return res.status(404).json(new ApiRes(404, null, "Holiday not found."));
    }

    // Step 2: Delete the holiday
    await Holiday.findByIdAndDelete(_id);

    // Step 3: Log the deletion action
    Logger(
      `Holiday with ID ${_id} deleted by ${req.user?.name || "unknown user"}.`,
      "info"
    );

    // Step 4: Send a success response
    return res
      .status(200)
      .json(new ApiRes(200, null, `Holiday ${holiday.title} deleted.`));
  } catch (error) {
    // Log and handle unexpected errors
    Logger(error, "error");

    // Respond with a 500 Internal Server Error
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const getHolidays = asyncHandler(async (req, res) => {
  try {
    // Fetch holidays, selecting only required fields and sorting by date in ascending order
    const holidays = await Holiday.find({})
      .select("_id title date")
      .sort("date"); // Directly sort by date

    // Respond with the list of holidays or an appropriate message if no holidays are found
    return res
      .status(200)
      .json(
        new ApiRes(200, holidays, holidays.length ? "" : "No holidays found.")
      );
  } catch (error) {
    // Log the error and respond with an internal server error
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const getHolidaysByYear = asyncHandler(async (req, res) => {
  const year = req.params.year; // Extract the year from the request parameters

  try {
    // Validate the year format (e.g., "2024")
    if (!/^\d{4}$/.test(year)) {
      return res
        .status(400)
        .json(new ApiRes(400, null, "Invalid year format. Expected YYYY."));
    }

    // Construct the start and end dates for the year in string format
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Fetch holidays within the specified year range
    const holidays = await Holiday.find({
      date: { $gte: startDate, $lte: endDate }, // Lexicographical string comparison
    })
      .select("_id title date")
      .sort({ date: 1 }); // Sort holidays by date for better presentation

    // Respond with holidays or a message if no holidays are found
    return res
      .status(200)
      .json(
        new ApiRes(200, holidays, holidays.length ? "" : "No holidays found.")
      );
  } catch (error) {
    // Log the error and send an internal server error response
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

// API's specific for Web App --->
const getHolidaysById = asyncHandler(async (req, res) => {
  const _id = req.params._id;

  if (!id) {
    return res
      .status(400)
      .json(new ApiRes(400, null, "Holiday ID is required."));
  }

  try {
    const holiday = await Holiday.findById(_id).select("_id title date");

    if (!holiday) {
      return res.status(404).json(new ApiRes(404, null, "Holiday not found."));
    }

    return res.status(200).json(new ApiRes(200, holiday, ""));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});
// API's specific for Web App --->

export {
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getHolidays,
  getHolidaysByYear,
  getHolidaysById,
};
