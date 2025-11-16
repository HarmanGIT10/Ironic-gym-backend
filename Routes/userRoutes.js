// Routes/userRoutes.js
const express = require("express");
const User = require("../models/User");
const { protect } = require("../Middleware/authMiddleware");

const router = express.Router();

// @desc    Get user profile
// @route   GET /api/users/me
// @access  Private (Needs token)
router.get("/me", protect, async (req, res) => {
  // 'req.user' is attached by the 'protect' middleware
  if (req.user) {
    res.json(req.user);
  } else {
    res.status(404).json({ message: "User not found" });
  }
});

// @desc    Update user profile
// @route   PUT /api/users/me
// @access  Private (Needs token)
router.put("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      // Update fields if they are provided in the request body
      user.name = req.body.name || user.name;
      user.phone = req.body.phone || user.phone;
      user.addressLine1 = req.body.addressLine1 || user.addressLine1;
      user.addressLine2 = req.body.addressLine2 || user.addressLine2;
      user.city = req.body.city || user.city;
      user.postalCode = req.body.postalCode || user.postalCode;
      user.country = req.body.country || user.country;

      // Note: We are not allowing email/password changes here
      // That would require more complex logic

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        addressLine1: updatedUser.addressLine1,
        addressLine2: updatedUser.addressLine2,
        city: updatedUser.city,
        postalCode: updatedUser.postalCode,
        country: updatedUser.country,
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error updating profile" });
  }
});

module.exports = router;