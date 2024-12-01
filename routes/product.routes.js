import { Router } from "express";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getProductNames,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategories,
  getCategoryNames,
} from "../controllers/product.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Product Routes --->
router.route("/create-product").post(verifyJWT, createProduct);
router.route("/update-product").put(verifyJWT, updateProduct);
router.route("/delete-product/:_id").delete(verifyJWT, deleteProduct);
router.route("/get-all-products").get(verifyJWT, getAllProducts);
router.route("/get-product-names").get(verifyJWT, getProductNames);
// Product Routes --->

// Category Routes --->
router.route("/create-category").post(verifyJWT, createCategory);
router.route("/update-category").put(verifyJWT, updateCategory);
router.route("/delete-category/:_id").delete(verifyJWT, deleteCategory);
router.route("/get-all-categories").get(verifyJWT, getAllCategories);
router.route("/get-category-names").get(verifyJWT, getCategoryNames);
// Category Routes --->

export default router;
