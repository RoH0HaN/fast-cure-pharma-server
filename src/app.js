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

// Routes
const apiV1 = "/api/v1";

app.use(`${apiV1}/users`, userRoutes);
app.use(`${apiV1}/headquarters`, headquarterRoutes);

export { app };
