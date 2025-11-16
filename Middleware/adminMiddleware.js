// Middleware/adminMiddleware.js
const { protect } = require("./authMiddleware");

// This middleware runs *after* protect,
// so we already have req.user
const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next(); // User is an admin, proceed
  } else {
    res.status(403); // 403 Forbidden
    throw new Error("Not authorized as an admin");
  }
};

module.exports = { admin, protect }; // We re-export protect for convenience