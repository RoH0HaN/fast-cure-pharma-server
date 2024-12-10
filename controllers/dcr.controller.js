import { getPlaceNameFromLocation } from "../util/helpers/dcr.helpers.js";
import { getDatesBetween } from "../util/helpers/leave.helpers.js";
import { ApiRes, validateFields } from "../util/api.response.js";
import { DCR } from "../models/dcr.models.js";
import { asyncHandler } from "../util/async.handler.js";
import { Logger } from "../util/logger.js";
import { User } from "../models/user.models.js";
import dayjs from "dayjs";

//--- This API is for 'WORKING DAY', 'TRAINING DAY', 'JOINING DAY', 'CAMP DAY' reports. --->
const createDailyReport = asyncHandler(async (req, res) => {
  const { _id, name } = req.user;
  const { workingStatus, startLocation } = req.body;
  const reportDate = dayjs().format("YYYY-MM-DD");

  if (!validateFields(req.body, ["workingStatus", "startLocation"], res))
    return;

  try {
    const existingReport = await DCR.findOne({
      createdBy: _id,
      reportDate,
    });

    if (existingReport) {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `${name}, A report already exists for ${reportDate}.`
          )
        );
    }

    startLocation.area = await getPlaceNameFromLocation(startLocation);

    const newReport = new DCR({
      createdBy: _id,
      workingStatus,
      startLocation,
      reportDate,
    });

    await newReport.save();

    Logger(
      `${name}'s ${workingStatus} report for ${reportDate} has been created from near ${startLocation.area}.`
    );

    return res
      .status(201)
      .json(
        new ApiRes(
          201,
          newReport._id,
          `${name}, Your ${workingStatus} report for ${reportDate} has been created with start location near ${startLocation.area}.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

//--- This API is for 'MEETING DAY' reports. --->
const createMeetingReport = asyncHandler(async (req, res) => {
  const { _id, name } = req.user;
  const { title, description, startDate, endDate } = req.body;

  if (
    !validateFields(
      req.body,
      ["title", "description", "startDate", "endDate"],
      res
    )
  )
    return;

  try {
    const meetingDayDates = getDatesBetween(startDate, endDate);

    if (meetingDayDates.error) {
      return res
        .status(400)
        .json(new ApiRes(400, null, meetingDayDates.message));
    }

    meetingDayDates.dates.forEach(async (date) => {
      const newReport = new DCR({
        createdBy: _id,
        workingStatus: "MEETING DAY",
        reportDate: date,
        isMeeting: true,
        meetingDetails: {
          title,
          description,
          startDate,
          endDate,
        },
      });
      newReport.save();
    });

    Logger(
      `${name}'s meeting report from ${startDate} to ${endDate} has been created.`
    );

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `${name}, your meeting report from ${startDate} to ${endDate} has been created.`
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});
