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

// Routes
const apiV1 = "/api/v1";

app.use(`${apiV1}/users`, userRoutes);
app.use(`${apiV1}/headquarters`, headquarterRoutes);
app.use(`${apiV1}/products`, productRoutes);
app.use(`${apiV1}/miscs`, miscRoutes);
app.use(`${apiV1}/holidays`, holidayRoutes);

export { app };
