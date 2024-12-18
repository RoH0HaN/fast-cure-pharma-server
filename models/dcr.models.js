import { model, Schema } from "mongoose";

const doctorReportSchema = new Schema({
  doctor: {
    type: Schema.Types.ObjectId,
    ref: "DVL",
    required: true,
  },
  location: {
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
  },
  image: {
    type: String,
    default: "",
  },
  reportStatus: {
    type: String,
    enum: ["PENDING", "INCOMPLETE CALL", "COMPLETE CALL"],
    uppercase: true,
    trim: true,
    default: "PENDING",
  },
  area: {
    type: String,
    uppercase: true,
    trim: true,
    default: "",
  },
  prodOne: { type: String, required: true, uppercase: true },
  prodTwo: { type: String, default: "N/A", uppercase: true },
  prodThree: { type: String, default: "N/A", uppercase: true },
  prodFour: { type: String, default: "N/A", uppercase: true },
  remarks: { type: String, default: "N/A", uppercase: true },
  workWithEmployeeRole: {
    type: String,
    enum: ["ABM", "RBM", "ZBM", "TBM", "SELF"],
    uppercase: true,
    trim: true,
    required: true,
  },
  workWithEmployeeId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  workWithEmployeeName: {
    type: String,
    uppercase: true,
    required: true,
  },
  completedAt: {
    type: Date,
    default: null,
  },
});

const csReportSchema = new Schema({
  visitType: {
    type: String,
    enum: ["CHEMIST", "STOCKIST"],
    uppercase: true,
    trim: true,
    required: true,
  },
  name: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  location: {
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
  },
  reportStatus: {
    type: String,
    enum: ["PENDING", "INCOMPLETE CALL", "COMPLETE CALL"],
    uppercase: true,
    trim: true,
    default: "PENDING",
  },
  image: {
    type: String,
    default: "",
  },
  area: {
    type: String,
    uppercase: true,
    trim: true,
    default: "",
  },
  remarks: { type: String, default: "N/A", uppercase: true },
  workWithEmployeeRole: {
    type: String,
    enum: ["ABM", "RBM", "ZBM", "TBM", "SELF"],
    uppercase: true,
    trim: true,
    required: true,
  },
  workWithEmployeeId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  workWithEmployeeName: {
    type: String,
    uppercase: true,
    required: true,
  },
  completedAt: {
    type: Date,
    default: null,
  },
});

const trainingReportSchema = new Schema({
  area: {
    type: String,
    uppercase: true,
    trim: true,
    default: "",
  },
  workWithEmployeeRole: {
    type: String,
    enum: ["ABM", "RBM", "ZBM", "TBM", "SELF"],
    uppercase: true,
    trim: true,
    required: true,
  },
  workWithEmployeeId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  workWithEmployeeName: {
    type: String,
    uppercase: true,
    required: true,
  },
});

const meetingDetailsSchema = new Schema({
  title: { type: String, default: "", uppercase: true },
  startDate: { type: String, required: true, uppercase: true },
  endDate: { type: String, required: true, uppercase: true },
  description: { type: String, default: "", uppercase: true },
});

const dcrSchema = new Schema({
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  reportDate: {
    type: String,
    required: true,
  },
  workStatus: {
    type: String,
    uppercase: true,
    enum: [
      "WORKING DAY",
      "CAMP DAY",
      "MEETING DAY",
      "JOINING DAY",
      "TRAINING DAY",
      "ADMIN DAY",
    ],
    trim: true,
    default: "",
  },
  startLocation: {
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    area: { type: String, default: "", uppercase: true },
  },
  endLocation: {
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    area: { type: String, default: "", uppercase: true },
  },
  area: {
    type: String,
    uppercase: true,
    trim: true,
    default: "",
  },
  totalDistance: {
    type: Number,
    default: 0,
  },
  reportStatus: {
    type: String,
    enum: ["PENDING", "INCOMPLETE", "COMPLETE"],
    uppercase: true,
    trim: true,
    default: "PENDING",
  },
  isHoliday: {
    type: Boolean,
    default: false,
  },
  isMeeting: {
    type: Boolean,
    default: false,
  },
  doctorReports: [doctorReportSchema],
  csReports: [csReportSchema],
  trainingReport: { type: trainingReportSchema, default: null },
  meetingDetails: { type: meetingDetailsSchema, default: null },
});

export const DCR = model("DCR", dcrSchema);
