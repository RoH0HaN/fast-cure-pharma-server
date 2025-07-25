import { model, Schema } from "mongoose";

const headquarterSchema = new Schema(
  {
    name: { type: String, required: true, uppercase: true, trim: true },
    places: {
      type: [{ type: Schema.Types.ObjectId, ref: "Place" }],
      default: [],
    },
    type: { type: String, default: "HQ" },
  },
  { timestamps: true }
);

const placeSchema = new Schema({
  name: { type: String, required: true, uppercase: true, trim: true },
  headquarter: {
    type: Schema.Types.ObjectId,
    ref: "Headquarter",
    required: true,
  },
  type: {
    type: String,
    enum: ["HILL", "OUT", "EX", "HILL-EX", "HILL-OUT"],
    required: true,
  },
});

const Headquarter = model("Headquarter", headquarterSchema);
const Place = model("Place", placeSchema);

export { Headquarter, Place };
