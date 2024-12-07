import { ApiRes, validateFields } from "../util/api.response.js";
import { Headquarter, Place } from "../models/headquarter.models.js";
import { User } from "../models/user.models.js";
import { asyncHandler } from "../util/async.handler.js";
import { Logger } from "../util/logger.js";

// Headquarter API's --->
const createHeadquarter = asyncHandler(async (req, res) => {
  const { name } = req.body;

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

const getAllHeadquartersByRole = asyncHandler(async (req, res) => {
  const { role, _id } = req.user; // Extract user role and ID from request
  try {
    let headquarters = []; // To store the result

    if (role === "ADMIN") {
      // Fetch all headquarters with their associated places for ADMIN role
      headquarters = await Headquarter.find({}).select("name type _id");
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
              type: hq.type,
            });
            headquarterSet.add(hq._id.toString());
          }
        });
      };

      // Fetch and add the user's direct headquarter
      const userHeadquarters = await Headquarter.find({
        name: user.headquarter,
      }).select("name type _id");

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
          }).select("name type _id");

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

const deleteHeadquarter = asyncHandler(async (req, res) => {
  const _id = req.params._id; // Extract headquarter ID from request parameters

  // Validate the required parameter `_id`
  if (!_id) {
    return res
      .status(400)
      .json(new ApiRes(400, null, "Headquarter ID is required."));
  }

  try {
    // Use `findById` first to check if the headquarter exists
    const headquarter = await Headquarter.findById(_id);

    if (!headquarter) {
      // If headquarter doesn't exist, return a 404 error
      return res
        .status(404)
        .json(new ApiRes(404, null, "Headquarter not found."));
    }

    // Delete associated places in one operation using their reference to the headquarter
    const deletePlaces = Place.deleteMany({ headquarter: _id });

    // Delete the headquarter
    const deleteHeadquarter = Headquarter.findByIdAndDelete(_id);

    // Run both deletions concurrently for better performance
    await Promise.all([deletePlaces, deleteHeadquarter]);

    // Log success and return a success response
    Logger(
      `Headquarter ${headquarter.name} with ID ${_id} deleted successfully.`,
      "info"
    );
    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `Headquarter ${headquarter.name} deleted successfully.`
        )
      );
  } catch (error) {
    // Log the error and return a 500 internal server error
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const getHeadquarterNames = asyncHandler(async (req, res) => {
  try {
    const headquarters = await Headquarter.find().select("name");

    const names = headquarters.map((hq) => hq.name);

    return res.status(200).json(new ApiRes(200, names, ""));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});
// Headquarter API's --->

// Places API's --->
const createPlaces = asyncHandler(async (req, res) => {
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

const deletePlace = asyncHandler(async (req, res) => {
  const _id = req.params._id; // Extract place ID from request parameters

  // Validate the required parameter `_id`
  if (!_id) {
    return res.status(400).json(new ApiRes(400, null, "Place ID is required."));
  }

  try {
    // Check if the place exists by finding it using its ID
    const place = await Place.findById(_id);

    if (!place) {
      // If place doesn't exist, return a 404 error
      return res.status(404).json(new ApiRes(404, null, "Place not found."));
    }

    // Delete the place by its ID
    await Place.findByIdAndDelete(_id);

    // Log the deletion event for auditing purposes
    Logger(`Place ${place.name} with ID ${_id} deleted successfully.`, "info");

    // Return a success response indicating the place was deleted
    return res
      .status(200)
      .json(new ApiRes(200, null, `Place ${place.name} deleted successfully.`));
  } catch (error) {
    // Log the error for debugging and troubleshooting
    Logger(error, "error");

    // Return a 500 internal server error response if an exception occurs
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const editPlace = asyncHandler(async (req, res) => {
  const { _id, name, type } = req.body; // Extract place ID and new name from request body

  // Validate the required parameters `_id` and `name`
  if (!validateFields(req.body, ["_id", "name", "type"], res)) {
    return; // If validation fails, return an error response
  }

  try {
    // Check if the place exists by finding it using its ID
    const place = await Place.findById(_id);

    if (!place) {
      // If place doesn't exist, return a 404 error
      return res.status(404).json(new ApiRes(404, null, "Place not found."));
    }

    // Update the place name by its ID
    const updatedPlace = await Place.findByIdAndUpdate(
      _id,
      { name, type }, // Only update the name field
      { new: true } // Return the updated document
    );

    // Log the successful update for auditing purposes
    Logger(
      `Place ${place.name} with ID ${_id} updated to ${updatedPlace.name}[${updatedPlace.type}] successfully.`,
      "info"
    );

    // Return a success response with the updated place data
    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          null,
          `Place ${place.name} updated to ${updatedPlace.name}[${updatedPlace.type}] successfully.`
        )
      );
  } catch (error) {
    // Log the error for debugging and troubleshooting
    Logger(error, "error");

    // Return a 500 internal server error response if an exception occurs
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const getPlacesByHeadquarter = asyncHandler(async (req, res) => {
  const _id = req.params._id; // Extract headquarter ID from request parameters

  // Validate the required parameter `_id`
  if (!_id) {
    return res
      .status(400)
      .json(new ApiRes(400, null, "Headquarter ID is required."));
  }

  try {
    // Fetch places associated with the given headquarter
    const places = await Place.find({ headquarter: _id })
      .select("name type headquarter")
      .populate("headquarter", "name");

    if (!places.length) {
      // If no places found, return a 404 error
      return res.status(200).json(new ApiRes(200, [], "Places not found."));
    }

    // Transform the result to replace `headquarter` with its `name`
    const transformedPlaces = places.map((place) => ({
      _id: place._id,
      name: place.name,
      type: place.type,
      headquarter: place.headquarter.name, // Extract the name from the populated headquarter
    }));

    // Return the transformed places with a success message
    return res.status(200).json(new ApiRes(200, transformedPlaces, ""));
  } catch (error) {
    // Log the error and return a 500 internal server error
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});
// Places API's --->

// API for Headquarter and Places ---> //Downline Included
const getUsersHeadquarterAndPlaces = asyncHandler(async (req, res) => {
  const _id = req.user._id;

  try {
    const user = await User.findById(_id).select(
      "headquarter downLineEmployees"
    );
    const headquarter = await Headquarter.findOne({ name: user.headquarter });
    if (!headquarter) {
      return res
        .status(404)
        .json(new ApiRes(404, null, "Headquarter not found."));
    }
    const places = await Place.find({ headquarter: headquarter._id }).select(
      "name"
    );

    const allPlacesAndHeadquarter = [];
    const allPlacesAndHeadquarterSet = new Set();

    addUniqueData = (places) => {
      places.forEach((place) => {
        if (!allPlacesAndHeadquarterSet.has(place.name)) {
          allPlacesAndHeadquarterSet.add(place.name);
          allPlacesAndHeadquarter.push(place.name);
        }
      });
    };

    fetchDownlinePlacesAndHeadquarter = async (employeeIds) => {
      const employees = await User.find({ _id: { $in: employeeIds } }).select(
        "headquarter downLineEmployees"
      );
      for (const employee of employees) {
        const headquarter = await Headquarter.findOne({
          name: employee.headquarter,
        });
        const places = await Place.find({
          headquarter: headquarter._id,
        }).select("name");
        addUniqueData(Array.from(headquarter.name));
        addUniqueData(places);

        if (employee.downLineEmployees?.length > 0) {
          await fetchDownlinePlacesAndHeadquarter(employee.downLineEmployees);
        }
      }
    };

    addUniqueData(Array.from(headquarter.name));
    addUniqueData(places);

    if (user.downLineEmployees?.length > 0) {
      await fetchDownlinePlacesAndHeadquarter(user.downLineEmployees);
    }

    return res.status(200).json(new ApiRes(200, allPlacesAndHeadquarter, ""));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

// API for Headquarter and Places --->

export {
  createHeadquarter,
  createPlaces,
  getAllHeadquartersByRole,
  getPlacesByHeadquarter,
  deleteHeadquarter,
  deletePlace,
  editPlace,
  getHeadquarterNames,
  getUsersHeadquarterAndPlaces,
};
