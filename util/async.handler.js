const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((error) => {
      // Optionally log the error for debugging purposes
      console.error("Error caught by asyncHandler:", error);
      next(error);
    });
  };
};

export { asyncHandler };
