// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  password: { type: String },
  countryCode: { type: String, default: "+1" },
  phone: String,
  
  // --- Profile Fields ---
  addressLine1: { type: String, default: "" },
  addressLine2: { type:String, default: "" },
  city: { type: String, default: "" },
  postalCode: { type: String, default: "" },
  country: { type: String, default: "" },
  
  // --- Google Sign-In ---
  googleId: { type: String, unique: true, sparse: true },


  isAdmin: { type: Boolean, default: false, required: true },

}, { 
  timestamps: true, 
  toJSON: { virtuals: true }, // 👈 IMPORTANT: Ensure virtuals show up in JSON responses
  toObject: { virtuals: true }
});

// 👇 VIRTUAL: automatic combination when fetching
userSchema.virtual('fullPhone').get(function() {
  // Returns combined string like "+919876543210"
  return `${this.countryCode || ''}${this.phone || ''}`;
});

module.exports = mongoose.model("User", userSchema);
