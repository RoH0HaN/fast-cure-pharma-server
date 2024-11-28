import { model, Schema } from "mongoose";

const attendanceSchema = new Schema(
  {
    empId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    attendance: {
      type: Object,
      of: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

export const Attendance = model("Attendance", attendanceSchema);
