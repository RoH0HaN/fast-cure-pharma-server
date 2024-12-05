import { model, Schema } from "mongoose";

const holidaySchema = new Schema({
  title: { type: String, required: true, uppercase: true },
  date: { type: String, required: true },
});

export const Holiday = model("Holiday", holidaySchema);
