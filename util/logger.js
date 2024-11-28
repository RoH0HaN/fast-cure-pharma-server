import path from "path";

const Logger = (message, level = "info") => {
  const error = new Error();
  const stack = error.stack ? error.stack.split("\n") : [];

  // Try to get the caller file path; fallback to 'unknown' if not found
  let callerFilePath = null;
  for (let i = 2; i < stack.length; i++) {
    const match = stack[i]?.match(/\(([^)]+)\)/);

    // Handle anonymous functions and try to find the next valid stack entry
    if (match && !stack[i].includes("<anonymous>")) {
      callerFilePath = match[1];
      break;
    }
  }

  // Get the base file name or set 'unknown' if the file path is not found
  const fileName = callerFilePath ? path.basename(callerFilePath) : "unknown";

  // Get current timestamp
  const timestamp = new Date().toISOString();

  // Log message format
  const logMessage = `Timestamp: ${timestamp} , LOG TYPE: [${level.toUpperCase()}] , FILENAME: [${fileName}] - ${message}`;

  // Log to console based on the log level
  switch (level) {
    case "info":
      console.log(logMessage);
      break;
    case "warn":
      console.warn(logMessage);
      break;
    case "error":
      console.error(logMessage);
      break;
  }
};

export { Logger };
