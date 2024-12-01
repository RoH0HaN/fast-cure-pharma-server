import { ApiRes, validateFields } from "../util/api.response.js";
import { Category, Product } from "../models/product.models.js";
import { asyncHandler } from "../util/async.handler.js";
import { Logger } from "../util/logger.js";

// Product API's --->
const createProduct = asyncHandler(async (req, res) => {
  const { name, shortCode, category } = req.body;

  // Validate required fields
  if (!validateFields(req.body, ["name", "shortCode", "category"], res)) {
    return;
  }

  try {
    const existingProduct = await Product.findOne({ name });

    if (existingProduct) {
      return res
        .status(400)
        .json(
          new ApiRes(
            400,
            null,
            `Product ${existingProduct.name} already exists.`
          )
        );
    }
    const product = new Product({ name, shortCode, category });
    await product.save();

    Logger(`Product ${product.name} created.`, "info");

    return res
      .status(200)
      .json(new ApiRes(200, null, `Product ${product.name} created.`));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const updateProduct = asyncHandler(async (req, res) => {
  const { _id, name, shortCode, category } = req.body;

  // Validate required fields
  if (
    !validateFields(req.body, ["_id", "name", "shortCode", "category"], res)
  ) {
    return;
  }

  try {
    // Update the product directly using `findByIdAndUpdate`
    const updatedProduct = await Product.findByIdAndUpdate(
      _id,
      { name, shortCode, category },
      { new: true } // Return the updated document
    );

    if (!updatedProduct) {
      return res
        .status(404)
        .json(
          new ApiRes(404, null, `Product ${name} with ID ${_id} not found.`)
        );
    }

    Logger(`Product ${updatedProduct.name} updated.`, "info");

    return res
      .status(200)
      .json(new ApiRes(200, null, `Product ${updatedProduct.name} updated.`));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const deleteProduct = asyncHandler(async (req, res) => {
  const _id = req.params._id; // Extract product ID from request parameters

  // Validate the required parameter `_id`
  if (!validateFields(req.params, ["_id"], res)) {
    return; // If validation fails, return an error response
  }

  try {
    const deletedProduct = await Product.findByIdAndDelete(_id);

    if (!deletedProduct) {
      return res
        .status(404)
        .json(new ApiRes(404, null, `Product with ID ${_id} not found.`));
    }

    Logger(`Product ${deletedProduct.name} deleted.`, "info");

    return res
      .status(200)
      .json(new ApiRes(200, null, `Product ${deletedProduct.name} deleted.`));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const getAllProducts = asyncHandler(async (req, res) => {
  try {
    const products = await Product.find().select("_id name shortCode category");

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          products,
          products.length ? "Products found." : "No products found."
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

// API's specific for Web App --->
const getProductNames = asyncHandler(async (req, res) => {
  try {
    const products = await Product.find().select("name");

    const names = products.map((product) => product.name);

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          names,
          names.length ? "Product names found." : "No product names found."
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});
// API's specific for Web App --->

// Product API's --->

// Category API's --->
const createCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;

  if (!validateFields(req.body, ["name"], res)) {
    return;
  }

  try {
    const existingCategory = await Category.findOne({ name });

    if (existingCategory) {
      return res
        .status(400)
        .json(new ApiRes(400, null, "Category already exists."));
    }

    const newCategory = new Category({ name });
    await newCategory.save();

    Logger(`Category ${name} created.`);

    return res
      .status(201)
      .json(new ApiRes(201, null, `Category ${newCategory.name} created.`));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const updateCategory = asyncHandler(async (req, res) => {
  const { _id, name } = req.body;

  if (!validateFields(req.body, ["_id", "name"], res)) {
    return;
  }

  try {
    const updatedCategory = await Category.findByIdAndUpdate(
      _id,
      { name },
      { new: true } // Return the updated document
    );

    if (!updatedCategory) {
      return res
        .status(404)
        .json(
          new ApiRes(404, null, `Category ${name} with ID ${_id} not found.`)
        );
    }

    Logger(`Category ${updatedCategory.name} updated.`);

    return res
      .status(200)
      .json(new ApiRes(200, null, `Category ${updatedCategory.name} updated.`));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const deleteCategory = asyncHandler(async (req, res) => {
  const _id = req.params._id;

  if (!validateFields(req.params, ["_id"], res)) {
    return;
  }

  try {
    const deletedCategory = await Category.findByIdAndDelete(_id);

    if (!deletedCategory) {
      return res
        .status(404)
        .json(new ApiRes(404, null, `Category with ID ${_id} not found.`));
    }

    Logger(`Category ${deletedCategory.name} deleted.`);

    return res
      .status(200)
      .json(new ApiRes(200, null, `Category ${deletedCategory.name} deleted.`));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

const getAllCategories = asyncHandler(async (req, res) => {
  try {
    const categories = await Category.find().select("_id name");

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          categories,
          categories.length ? "Categories found." : "No Categories found."
        )
      );
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});

// API's specific for Web App --->
const getCategoryNames = asyncHandler(async (req, res) => {
  try {
    const categories = await Category.find().select("name");

    const names = categories.map((category) => category.name);

    return res.status(200).json(new ApiRes(200, names, ""));
  } catch (error) {
    Logger(error, "error");
    return res
      .status(500)
      .json(new ApiRes(500, null, error.message || "Internal server error."));
  }
});
// API's specific for Web App --->

// Category API's --->

export {
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
};
