import { model, Schema } from "mongoose";

// Hybrid Schema
const leaveCountsSchema = new Schema({
  cl: { type: Number, default: 0 },
  pl: { type: Number, default: 0 },
  lwp: { type: Number, default: 0 },
});

// Leave Request Sub document Schema
const leaveRequestSchema = new Schema({
  leaveType: {
    type: String,
    enum: ["CASUAL", "PRIVILEGED", "LEAVE-WITHOUT-PAY", "MEDICAL"],
    required: true,
    uppercase: true,
  }, // e.g., "PL", "CL", "LWP"
  status: {
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED"],
    required: true,
    uppercase: true,
  }, // e.g., "Pending", "Approved", "Rejected"
  reason: { type: String, required: true, uppercase: true },
  fromDate: { type: String, required: true },
  toDate: { type: String, required: true },
  duration: { type: Number, required: true },
  requestedOn: { type: String, default: "" },
  usedLeaveCounts: { type: leaveCountsSchema, default: () => ({}) },
  approvedBy: { type: String, default: "", uppercase: true },
  rejectedBy: { type: String, default: "", uppercase: true },
  approvedOn: { type: String, default: "" },
  rejectedOn: { type: String, default: "" },
  remarks: { type: String, default: "", uppercase: true },
});

// Main Leave Schema
const leaveSchema = new Schema({
  empId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  plCount: { type: Number, required: true, default: 0 },
  clCount: { type: Number, required: true, default: 0 },
  lwpCount: { type: Number, required: true, default: 0 },
  updatedOn: { type: String },
  leaves: { type: [leaveRequestSchema], default: [] },
});

export const Leave = model("Leave", leaveSchema);
