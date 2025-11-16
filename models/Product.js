// models/Product.js
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: String,
  price: Number, // This is price in CENTS
  brand: String,
  size: String,
  quantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  mainImageUrl: {
    type: String,
    required: [true, "Please provide a main image URL"]
  },
  cartImageUrl: {
    type: String,
    required: [true, "Please provide a cart/thumbnail image URL"]
  },
  // 👇 --- ADD THESE TWO FIELDS ---
  category: {
    type: String,
    required: true,
    // This ensures you can only pick from these values
    enum: ["Hoodie", "Tee", "Shorts", "Accessory"]
  },
  isBestSeller: {
    type: Boolean,
    default: false,
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

productSchema.virtual("inStock").get(function () {
  return this.quantity > 0;
});

module.exports = mongoose.model("Product", productSchema);