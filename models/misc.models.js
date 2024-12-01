import { model, Schema } from "mongoose";

const miscSchema = new Schema({
  empId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  miscs: {
    type: Object,
    of: Schema.Types.Mixed,
  },
});

export const Misc = model("Misc", miscSchema);
