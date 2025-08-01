import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const corsOption = {
  origin: process.env.CORS_ORIGIN,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "x-refresh-token"],
};

const app = express();

app.use(cors(corsOption));
app.use(express.json({ limit: "24kb" }));
app.use(express.urlencoded({ limit: "24kb", extended: true }));
app.use(express.static("public"));
app.use(cookieParser());

// Route Imports
import userRoutes from "../routes/user.routes.js";
import headquarterRoutes from "../routes/headquarter.routes.js";
import productRoutes from "../routes/product.routes.js";
import miscRoutes from "../routes/misc.routes.js";
import holidayRoutes from "../routes/holiday.routes.js";
import dvlRoutes from "../routes/dvl.routes.js";
import tourPlanRoutes from "../routes/tourPlan.routes.js";
import attendanceRoutes from "../routes/attendance.routes.js";
import leaveRoutes from "../routes/leave.routes.js";
import dcrRoutes from "../routes/dcr.routes.js";
import automationRoutes from "../routes/automation.routes.js";

// Routes
const apiV1 = "/api/v1";

app.use(`${apiV1}/users`, userRoutes);
app.use(`${apiV1}/headquarters`, headquarterRoutes);
app.use(`${apiV1}/products`, productRoutes);
app.use(`${apiV1}/miscs`, miscRoutes);
app.use(`${apiV1}/holidays`, holidayRoutes);
app.use(`${apiV1}/dvls`, dvlRoutes);
app.use(`${apiV1}/tour-plans`, tourPlanRoutes);
app.use(`${apiV1}/attendances`, attendanceRoutes);
app.use(`${apiV1}/leaves`, leaveRoutes);
app.use(`${apiV1}/dcrs`, dcrRoutes);
app.use(`${apiV1}/automations`, automationRoutes);

export { app };
