import { model, Schema } from "mongoose";

// Hybrid Schema
const hybridSchema = new Schema({
  title: { type: String, default: "" },
  cl: { type: Number, default: 0 },
  pl: { type: Number, default: 0 },
  lwp: { type: Number, default: 0 },
});

// Leave Request Sub document Schema
const leaveRequestSchema = new Schema({
  leaveType: { type: String, required: true }, // e.g., "PL", "CL", "LWP"
  status: { type: String, required: true }, // e.g., "Pending", "Approved", "Rejected"
  reason: { type: String, required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  duration: { type: Number, required: true },
  requestedOn: { type: String, default: new Date().toISOString() },
  hybrid: { type: hybridSchema, default: () => ({}) },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
  lwpInLeave: { type: Number, default: 0 },
  remarks: { type: String, default: "" },
});

// Main Leave Schema
const leaveSchema = new Schema(
  {
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
  },
  { timestamps: true }
);

export const Leave = model("Leave", leaveSchema);
