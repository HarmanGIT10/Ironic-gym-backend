// models/Order.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// This sub-schema stores the shipping address for the order
const shippingAddressSchema = {
  // 👇 --- ADD THESE 3 LINES ---
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  
  addressLine1: { type: String, required: true },
  addressLine2: { type: String },
  city: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true },
};

// This sub-schema stores the details for *each* product in the order
const orderItemSchema = new Schema({
  name: { type: String, required: true },
  cartImageUrl: { type: String, required: false },
  brand: { type: String },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true }, 
  product: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Product",
  },
});

const orderSchema = new Schema({
  // 1. The User
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  
  // 2. The Products
  orderItems: [orderItemSchema],
  
  // 3. The Shipping Address (now includes name)
  shippingAddress: shippingAddressSchema,
  
  // 4. The Price
  totalPrice: {
    type: Number,
    required: true,
    default: 0.0,
  },
  
  // 5. The Payment & Status
  isPaid: {
    type: Boolean,
    required: true,
    default: false,
  },
  paidAt: {
    type: Date,
  },
  
  // 6. The Tracking Status
  status: {
    type: String,
    required: true,
    enum: ["Received", "Accepted", "Dispatched", "Completed"],
    default: "Received",
  },
  deliveredAt: {
    type: Date, // We will store the delivery date here
  },
  
}, {
  timestamps: true,
});

orderSchema.virtual('id').get(function(){
    return this._id.toHexString();
});

orderSchema.set('toJSON', {
    virtuals: true,
});

module.exports = mongoose.model("Order", orderSchema);