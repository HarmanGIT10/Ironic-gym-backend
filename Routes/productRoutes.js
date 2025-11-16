// Routes/productRoutes.js
const express = require("express");
const Product = require("../models/Product");
// Import your middleware
const { protect, admin } = require("../Middleware/adminMiddleware");

const router = express.Router();

// ✅ Add product
// This route is now protected: only a logged-in admin can add a product.
router.post("/add", protect, admin, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error adding product" });
  }
});

// ✅ Get all products
// This route is public so your customers can see items.
router.get("/", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) { // <-- This is the corrected line (no "=>")
    res.status(500).json({ message: "Error fetching products" });
  }
});

router.delete("/:id", protect, admin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      await product.deleteOne(); // Use deleteOne() on the document
      res.json({ message: "Product removed" });
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
router.put("/:id", protect, admin, async (req, res) => {
  try {
    const {
      name, price, brand, quantity, category, isBestSeller,mainImageUrl, cartImageUrl} = req.body;

    const product = await Product.findById(req.params.id);

    if (product) {
      // Update fields
      product.name = name || product.name;
      product.price = price || product.price;
      product.brand = brand || product.brand;
      product.quantity = quantity || product.quantity;
      product.category = category || product.category;
      product.isBestSeller = isBestSeller; // Note: not "||" - we need to be able to set it to false
      product.mainImageUrl = mainImageUrl || product.mainImageUrl;
      product.cartImageUrl = cartImageUrl || product.cartImageUrl;
      const updatedProduct = await product.save();
      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
// We will add PUT (update) and DELETE routes here later

module.exports = router;