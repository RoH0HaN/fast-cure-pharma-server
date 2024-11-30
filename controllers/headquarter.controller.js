import { ApiRes, validateFields } from "../util/api.response.js";
import { Headquarter, Place } from "../models/headquarter.models.js";
import { User } from "../models/user.models.js";
import { asyncHandler } from "../util/async.handler.js";
import { Logger } from "../util/logger.js";

const createHeadquarter = asyncHandler(async (req, res) => {
  const { name } = req.query;

  if (!name) {
    return res
      .status(400)
      .json(new ApiRes(400, null, "Headquarter name is required."));
  }

  try {
    const existingHeadquarter = await Headquarter.findOne({ name });

    if (existingHeadquarter) {
      return res
        .status(400)
        .json(new ApiRes(400, null, "Headquarter already exists."));
    }

    const newHeadquarter = new Headquarter({ name });
    await newHeadquarter.save();

    Logger(`Headquarter ${name} created.`);

    return res
      .status(200)
      .json(new ApiRes(200, null, `Headquarter ${name} created successfully.`));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const createPlace = asyncHandler(async (req, res) => {
  const { places, headquarter } = req.body;

  // Validate required fields
  if (!validateFields(req.body, ["places", "headquarter"], res)) {
    return;
  }

  try {
    // Check if the headquarter exists
    const headquarterExists = await Headquarter.findById(headquarter);
    if (!headquarterExists) {
      return res
        .status(400)
        .json(new ApiRes(400, null, "Headquarter does not exist."));
    }

    // Ensure `places` is an array
    const placeArray = Array.isArray(places) ? places : JSON.parse(places);

    // Filter out places that already exist in the database
    const existingPlaces = await Place.find({
      headquarter,
      name: { $in: placeArray.map((place) => place.name) },
    });

    const existingPlaceNames = existingPlaces.map((place) => place.name);

    // Identify new places to create
    const newPlaces = placeArray.filter(
      (place) => !existingPlaceNames.includes(place.name.toUpperCase())
    );

    // Bulk insert new places and update the headquarter in parallel
    const insertedPlaces = await Place.insertMany(
      newPlaces.map(({ name, type }) => ({
        name,
        type,
        headquarter,
      }))
    );

    const placeIds = insertedPlaces.map((place) => place._id);

    // Update the headquarter with the new place IDs
    await Headquarter.findByIdAndUpdate(headquarter, {
      $addToSet: { places: { $each: placeIds } },
    });

    // Log the creation of each new place
    insertedPlaces.forEach((place) =>
      Logger(`Place ${place.name} created under headquarter ${headquarter}.`)
    );

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `Places created successfully${
            existingPlaceNames.length
              ? `. Except: ${existingPlaceNames.join(", ")}, cause the are already existing`
              : ""
          }.`
        )
      );
  } catch (error) {
    // Log and handle unexpected errors
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const getAllHeadquartersByRole = asyncHandler(async (req, res) => {
  const { role, _id } = req.user; // Extract user role and ID from request
  try {
    let headquarters = []; // To store the result

    if (role === "ADMIN") {
      // Fetch all headquarters with their associated places for ADMIN role
      headquarters = await Headquarter.aggregate([
        {
          $lookup: {
            from: "places", // Join with 'places' collection
            localField: "places", // Match 'places' field in headquarters
            foreignField: "_id", // Match '_id' in 'places' collection
            as: "places", // Output array field name
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            places: {
              $map: {
                input: "$places",
                as: "place",
                in: {
                  _id: "$$place._id",
                  name: "$$place.name",
                  type: "$$place.type",
                },
              },
            },
          },
        },
      ]);
    } else {
      // Fetch user-specific headquarter and downline hierarchy
      const user = await User.findById(_id).select(
        "headquarter downLineEmployees -_id"
      );

      // Set to track unique headquarters to avoid duplicates
      const headquarterSet = new Set();

      // Function to add headquarters to the result if not already added
      const addUniqueHeadquarter = (hqArray) => {
        hqArray.forEach((hq) => {
          if (!headquarterSet.has(hq._id.toString())) {
            headquarters.push({
              _id: hq._id,
              name: hq.name,
              places: hq.places.map((place) => ({
                _id: place._id,
                name: place.name,
                type: place.type,
              })),
            });
            headquarterSet.add(hq._id.toString());
          }
        });
      };

      // Fetch and add the user's direct headquarter
      const userHeadquarters = await Headquarter.find({
        name: user.headquarter,
      })
        .select("name places _id")
        .populate({
          path: "places",
          select: "name type _id",
        });

      addUniqueHeadquarter(userHeadquarters);

      // Recursively fetch downline headquarters
      const fetchDownlineHeadquarters = async (employeeIds) => {
        const employees = await User.find({ _id: { $in: employeeIds } }).select(
          "headquarter downLineEmployees"
        );

        for (const employee of employees) {
          // Fetch headquarters for the current employee
          const employeeHeadquarters = await Headquarter.find({
            name: employee.headquarter,
          })
            .select("name places _id")
            .populate({
              path: "places",
              select: "name type _id",
            });

          addUniqueHeadquarter(employeeHeadquarters);

          // Recursively process downline employees
          if (employee.downLineEmployees?.length > 0) {
            await fetchDownlineHeadquarters(employee.downLineEmployees);
          }
        }
      };

      // Start fetching downlines from the user's downline employees
      if (user.downLineEmployees?.length > 0) {
        await fetchDownlineHeadquarters(user.downLineEmployees);
      }
    }

    // Return the collected headquarters
    return res
      .status(200)
      .json(
        new ApiRes(200, headquarters, "Headquarters fetched successfully.")
      );
  } catch (error) {
    // Handle unexpected errors
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

export { createHeadquarter, createPlace, getAllHeadquartersByRole };
