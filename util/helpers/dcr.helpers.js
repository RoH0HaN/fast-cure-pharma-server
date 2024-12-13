import { User, Employee, Manager } from "../../models/user.models.js";
import { Attendance } from "../../models/attendance.models.js";
import { DVL } from "../../models/dvl.models.js";
import { Holiday } from "../../models/holiday.models.js";
import axios from "axios";
import { Logger } from "../logger.js";
import dotenv from "dotenv";
import dayjs from "dayjs";
import { DCR } from "../../models/dcr.models.js";

dotenv.config({
  path: "../../.env",
});

const getDistanceBetweenTwoLocations = async (origin, destination) => {
  try {
    const { data } = await axios.get(
      "https://api.olamaps.io/routing/v1/distanceMatrix/basic",
      {
        params: {
          origins: `${origin.latitude},${origin.longitude}`,
          destinations: `${destination.latitude},${destination.longitude}`,
          api_key: process.env.API_KEY,
        },
      }
    );
    const distanceInMeters = data?.rows[0]?.elements[0]?.distance;
    const distanceInKilometers = Number(distanceInMeters) / 1000; // Convert to kilometers
    return distanceInKilometers;
  } catch (error) {
    Logger(`Error fetching distance: ${error.message}`, "error");
    return 0;
  }
};

const getPlaceNameFromLocation = async (location) => {
  const longitude = parseFloat(location.longitude);
  const latitude = parseFloat(location.latitude);

  // Validate latitude and longitude before proceeding
  if (
    isNaN(latitude) ||
    isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return "";
  }

  try {
    const { data } = await axios.get(
      "https://api.olamaps.io/places/v1/reverse-geocode",
      {
        params: {
          api_key: process.env.API_KEY,
          latlng: `${latitude},${longitude}`,
        },
      }
    );

    // Extract location information with a clear priority
    console.log(
      data?.results[0]?.formatted_address || data?.results[0]?.name || ""
    );

    return data?.results[0]?.formatted_address || data?.results[0]?.name || "";
  } catch (error) {
    Logger(`Error fetching place name: ${error.message}`, "error");
    return "";
  }
};

const getWorkWithEmployeeId = async (userId, workWithEmployeeRole) => {
  try {
    // Fetch the user to start traversal
    const user = await User.findById(userId).lean();
    if (!user) throw new Error("User not found");

    let parentId = user.basicDetails.parentId;
    let parentDetails = {
      parentId: "",
      parentRole: "",
      parentName: "",
    };

    // Traverse the parent chain
    while (parentId) {
      const parent = await User.findById(parentId)
        .select("_id role name basicDetails.parentId")
        .lean();

      if (!parent) throw new Error("Parent not found");

      if (parent.role === "ADMIN" || parent.role === workWithEmployeeRole) {
        parentDetails.parentId = parent._id;
        parentDetails.parentRole = parent.role;
        parentDetails.parentName = parent.name;
        break;
      }

      parentId = parent.basicDetails.parentId;
    }

    if (!parentDetails.parentId) {
      throw new Error(
        `No parent found with the role "${workWithEmployeeRole}" or "ADMIN".`
      );
    }

    return parentDetails;
  } catch (error) {
    Logger(error, "error");
    throw new Error(
      `Error getting work with employee id. Message: ${error.message}`
    );
  }
};

const checkForHoliday = async (date) => {
  const holidays = await Holiday.find({ h_date: date })
    .select("-_id date")
    .lean();

  if (holidays.length > 0) {
    return true;
  }
  return false;
};

const updateDvlDoctorLocation = async (dvlId, location) => {
  try {
    const existingDVL = await DVL.findById(dvlId);
    if (existingDVL.locations.length == 0) {
      // Add location to the DVL array
      existingDVL.locations.push(location);

      // Save DVL back to the database
      await existingDVL.save();
      Logger(
        `New location added for ${existingDVL.docName}, with id ${dvlId}.`,
        "info"
      );
      return true;
    }
    const destinationCoords = existingDVL.locations
      .map((loc) => `${loc.latitude},${loc.longitude}`)
      .join("|");

    const originCoord = `${location.latitude},${location.longitude}`;

    // Call Ola Distance Matrix API
    const { data } = await axios.get(
      "https://api.olamaps.io/routing/v1/distanceMatrix/basic",
      {
        params: {
          origins: originCoord,
          destinations: destinationCoords,
          api_key: process.env.API_KEY,
        },
      }
    );
    const distances = data.rows[0].elements.map((element) => element.distance);

    // Convert distances from meters to kilometers
    const distancesInKm = distances.map((distance) => Number(distance) / 1000);

    // Check if all distances are greater than 50 km
    const isOutside = distancesInKm.every((distance) => distance > 50);
    if (isOutside) {
      // Add location to the DVL array
      existingDVL.locations.push(location);

      // Save DVL back to the database
      await existingDVL.save();
      Logger(
        `New location added for ${existingDVL.docName}, with id ${dvlId}.`,
        "info"
      );
      return true;
    }

    return false;
  } catch (error) {
    Logger(error, "error");
    throw new Error("Failed to process the location check.");
  }
};

const getTotalTravelingDistanceFromDCRReport = async (
  dcrReportId,
  endLocation
) => {
  try {
    const dcrReport = await DCR.findById(dcrReportId); // Ensure this is asynchronous if necessary
    let allLocationsInOrder = [dcrReport.startLocation];

    // Sort doctor reports based on completedAt and map to locations
    if (dcrReport.doctorReports.length > 0) {
      const doctorReportLocations = dcrReport.doctorReports
        .filter(
          (report) =>
            report.completedAt && report.reportStatus === "COMPLETE CALL"
        ) // Filter out reports with null/undefined completedAt
        .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt)) // Sort by completedAt (earliest first)
        .map((report) => report.location);

      // Concatenate all the locations in order
      allLocationsInOrder = allLocationsInOrder.concat(doctorReportLocations);
    }

    // Add the end location at the end
    allLocationsInOrder.push(endLocation);

    let totalDistance = 0;

    for (let i = 0; i < allLocationsInOrder.length - 1; i++) {
      const origin = allLocationsInOrder[i];
      const destination = allLocationsInOrder[i + 1];

      const distance = await getDistanceBetweenTwoLocations(
        origin,
        destination
      );

      totalDistance += distance;
    }

    return totalDistance;
  } catch (error) {
    Logger(`Error processing location check: ${error.message}`, "error");
    throw new Error("Failed to process the location check.");
  }
};

const markAttendance = async (userId, name, title) => {
  try {
    const date = dayjs().format("YYYY-MM-DD");
    const [year, month] = date.split("-");

    // Construct the dynamic path for attendance
    const attendancePath = `attendance.${year}.${month}.${date}`;

    // Perform an atomic update
    const updateResult = await Attendance.updateOne(
      { empId: userId, [attendancePath]: { $exists: false } }, // Ensure no duplicate entry
      {
        $set: { [attendancePath]: { title } }, // Add new attendance entry
        $setOnInsert: { empId: userId }, // Initialize attendance if not existing
      },
      { upsert: true } // Insert if no document exists
    );

    // Check if the update was applied or skipped (duplicate entry)
    if (updateResult.matchedCount > 0 && updateResult.modifiedCount === 0) {
      return false;
    }

    Logger(
      `${name}'s attendance has been marked for WORKING DAY on ${date}.`,
      "info"
    );

    return true;
  } catch (error) {
    Logger(error, "error");
    throw new Error("Failed to mark attendance.");
  }
};

export {
  getPlaceNameFromLocation,
  getWorkWithEmployeeId,
  checkForHoliday,
  updateDvlDoctorLocation,
  getTotalTravelingDistanceFromDCRReport,
  markAttendance,
};
