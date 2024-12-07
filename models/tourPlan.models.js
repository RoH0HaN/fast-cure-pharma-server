import { model, Schema } from "mongoose";

const tourPlanSchema = new Schema({
  empId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  tourPlan: {
    type: Map,
    of: Schema.Types.Mixed,
  },
  isExtraDayForCreated: { type: Boolean, default: false },
  isExtraDayForApproved: { type: Boolean, default: false },
});

export const TourPlan = model("TourPlan", tourPlanSchema);
