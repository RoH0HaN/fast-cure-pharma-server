class ApiRes {
  constructor(statusCode, data, message = "") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}

function validateFields(body, requiredFields, res) {
  const missingFields = requiredFields
    .filter((field) => {
      return !Object.keys(body).includes(field);
    })
    .map((field) => field);

  if (missingFields.length > 0) {
    return res
      .status(400)
      .json(
        new ApiRes(
          400,
          null,
          `Missing required fields: ${missingFields.join(", ")}`
        )
      );
  }

  // Return true if all fields are present
  return true;
}

export { ApiRes, validateFields };
