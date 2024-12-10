import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore.js";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter.js";
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const getDatesBetween = (fromDate, toDate) => {
  // Parse dates using dayjs
  const startDate = dayjs(fromDate);
  const endDate = dayjs(toDate);

  // Check if fromDate is after toDate
  if (startDate.isAfter(endDate)) {
    return {
      error: true,
      message: `'${fromDate}' cannot be after '${toDate}'.`,
      dates: [],
      duration: 0,
    };
  }

  // Generate the list of dates
  const dates = [];
  for (
    let date = startDate;
    date.isSameOrBefore(endDate);
    date = date.add(1, "day")
  ) {
    dates.push(date.format("YYYY-MM-DD"));
  }

  // Calculate the duration in days (inclusive of both start and end dates)
  const duration = endDate.diff(startDate, "day") + 1;

  return {
    error: false,
    message: "Dates generated successfully.",
    dates,
    duration,
  };
};

const getCurrentMonthWorkingDays = async (empId) => {
  try {
    //TODO: Get current month working days from DCR

    return 12;
  } catch (error) {
    throw new Error(`${error}, Failed to get current month working days.`);
  }
};

export { getDatesBetween, getCurrentMonthWorkingDays };
