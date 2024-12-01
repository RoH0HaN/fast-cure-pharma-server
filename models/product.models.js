import { model, Schema } from "mongoose";

const productSchema = new Schema({
  name: { type: String, required: true, uppercase: true, trim: true },
  shortCode: { type: String, required: true, uppercase: true, trim: true },
  category: { type: String, required: true, uppercase: true, trim: true },
});

const categorySchema = new Schema({
  name: { type: String, required: true, uppercase: true, trim: true },
});

const Product = model("Product", productSchema);
const Category = model("Category", categorySchema);

export { Product, Category };
