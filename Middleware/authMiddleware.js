// Middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const JWT_SECRET = "supersecretkey"; // MUST MATCH authRoutes.js

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);

      // Get user from the token (but don't send the password)
      req.user = await User.findById(decoded.id).select("-password");
      
      if (!req.user) {
         return res.status(401).json({ message: "Not authorized, user not found" });
      }

      next(); // Move to the next function
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

// We also need to export 'admin' for your product routes
const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({ message: "Not authorized as an admin" });
  }
};

module.exports = { protect, admin };