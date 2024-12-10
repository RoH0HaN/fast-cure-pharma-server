import { TourPlan } from "../../models/tourPlan.models.js";
import { User } from "../../models/user.models.js";
import dayjs from "dayjs";

const getCurrentYearAndNextMonth = () => {
  const today = dayjs();
  const currentMonth = today.month() + 1; // Month is zero-indexed in dayjs, so add 1
  const currentYear = today.year();

  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

  return { year: nextYear, month: nextMonth };
};

const hasDownlineTourPlans = async (empId, year, month) => {
  try {
    const user = await User.findById(empId)
      .select("downlineEmployees _id")
      .lean();

    if (!user || !user.downlineEmployees?.length) return [];

    const employeeIds = new Set(user.downlineEmployees);

    const employees = await User.find({ _id: { $in: Array.from(employeeIds) } })
      .select("_id name role empId downlineEmployees")
      .lean();

    const tourPlans = await TourPlan.find({
      empId: { $in: employees.map((e) => e._id) },
      [`tourPlan.${year}.${month}`]: { $exists: true },
    }).select("empId");

    const employeesWithTourPlans = new Set(
      tourPlans.map((plan) => plan.empId.toString())
    );

    const employeesWithoutTourPlans = employees.filter(
      (employee) => !employeesWithTourPlans.has(employee._id.toString())
    );

    return employeesWithoutTourPlans.map(
      (employee) => `${employee.empId} - ${employee.name} [${employee.role}]`
    );
  } catch (error) {
    Logger(error, "error");
    throw new Error("Error fetching downline tour plans.");
  }
};

export { getCurrentYearAndNextMonth, hasDownlineTourPlans };
