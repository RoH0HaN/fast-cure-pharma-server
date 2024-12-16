import { model, Schema } from "mongoose";

const dvlSchema = new Schema({
  docName: { type: String, required: true, uppercase: true },
  qualification: { type: String, default: "", uppercase: true },
  area: { type: String, required: true, uppercase: true },
  locations: [
    {
      latitude: { type: Number, default: 0 },
      longitude: { type: Number, default: 0 },
    },
  ],
  prodOne: { type: String, required: true, uppercase: true },
  prodTwo: { type: String, default: "N/A", uppercase: true },
  prodThree: { type: String, default: "N/A", uppercase: true },
  prodFour: { type: String, default: "N/A", uppercase: true },
  remarks: { type: String, default: "N/A", uppercase: true },
  freqVisit: { type: String, default: "N/A", uppercase: true },
  status: { type: String, default: "PENDING", uppercase: true },
  addedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
  dataToBeUpdated: { type: Object, default: {} },
  isArchived: { type: Boolean, default: false },
  isNeedToDelete: { type: Boolean, default: false },
  isNeedToUpdate: { type: Boolean, default: false },
});

export const DVL = model("DVL", dvlSchema);
