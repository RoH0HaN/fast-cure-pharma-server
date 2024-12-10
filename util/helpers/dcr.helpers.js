import axios from "axios";

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
      "https://nominatim.openstreetmap.org/reverse",
      {
        params: {
          lat: latitude,
          lon: longitude,
          format: "json",
          addressdetails: 1,
        },
        headers: {
          "User-Agent": "Optimized Node.js Geocoder",
        },
      }
    );

    // Extract location information with a clear priority
    const { address = {} } = data;
    return (
      address.city ||
      address.town ||
      address.village ||
      address.county ||
      address.hamlet ||
      ""
    );
  } catch (error) {
    Logger(`Error fetching place name: ${error.message}`, "error");
    return "";
  }
};

export { getPlaceNameFromLocation };
