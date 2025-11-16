const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const Otp = require("../models/Otp");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ✅ Send OTP
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.create({
      email,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });

    await transporter.sendMail({
      from: '"IRONIC" <' + process.env.EMAIL_USER + '>',
      to: email,
      subject: "Your OTP for IRONIC Store",
      text: `Your verification code is ${code}. It expires in 5 minutes.`,
    });

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("OTP send error:", err.message);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

// ✅ Verify OTP and create user (Sign Up)
router.post("/verify-otp", async (req, res) => {
  try {
    const { name, email, password, phone, otp } = req.body;
    const otpRecord = await Otp.findOne({ email, code: otp });

    if (!otpRecord) return res.status(400).json({ message: "Invalid OTP" });
    if (otpRecord.expiresAt < new Date())
      return res.status(400).json({ message: "OTP expired" });

    // OTP is valid, delete it
    await Otp.deleteMany({ email });
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
    });

    const token = jwt.sign({ id: newUser._id }, JWT_SECRET, { expiresIn: "1d" });

    res.json({
      message: "Account created successfully",
      user: { id: newUser._id, name: newUser.name, email: newUser.email },
      token,
    });
  } catch (err) {
    console.error("OTP verify error:", err.message);
    res.status(500).json({ message: "Verification failed" });
  }
});

// ✅ Sign In
router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    
    // Check if user has a password (they might be a Google-only user)
    if (!user.password) {
        return res.status(400).json({ message: "Please sign in with Google." });
    }

    // 2. Compare the plain-text password with the hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // 3. If match, create a token and send it back
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1d" });

    res.json({
      message: "Logged in successfully",
      user: { id: user._id, name: user.name, email: user.email },
      token,
      isAdmin: user.isAdmin
    });
  } catch (err) {
    console.error("Sign in error:", err.message);
    res.status(500).json({ message: "Server error during sign in" });
  }
});

// ✅ Google Sign In
router.post("/google-signin", async (req, res) => {
  try {
    const { name, email, googleId } = req.body;

    // 1. Find or create the user in your database
    const user = await User.findOneAndUpdate(
      { googleId: googleId }, // Find user by their unique Google ID
      {
        $set: { // Set/update these fields
          name: name,
          email: email,
          googleId: googleId,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 2. Create a token for this user
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1d" });

    // 3. Send back the token and user data
    res.json({
      message: "Google sign-in successful",
      user: { id: user._id, name: user.name, email: user.email },
      token,
    });
  } catch (err) {
    console.error("Google sign-in error:", err.message);
    res.status(500).json({ message: "Server error during Google sign in" });
  }
});

// --- 👇 NEW "FORGOT PASSWORD" ROUTES ---

// @desc    Send OTP for password reset
// @route   POST /api/auth/send-reset-otp
// @access  Public
router.post("/send-reset-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    // 1. Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found with this email" });
    }

    // 2. Create and send OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.create({
      email,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });

    await transporter.sendMail({
      from: '"IRONIC" <' + process.env.EMAIL_USER + '>',
      to: email,
      subject: "Your Password Reset Code",
      text: `Your password reset code is ${code}. It expires in 5 minutes.`,
    });

    res.json({ message: "Password reset OTP sent successfully" });
  } catch (err) {
    console.error("Reset OTP send error:", err.message);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

// @desc    Verify OTP and reset password
// @route   POST /api/auth/reset-password
// @access  Public
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 1. Check if OTP is valid
    const otpRecord = await Otp.findOne({ email, code: otp });
    if (!otpRecord) return res.status(400).json({ message: "Invalid OTP" });
    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    // 2. Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 3. Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 4. Update user's password
    user.password = hashedPassword;
    await user.save();

    // 5. Delete the used OTP
    await Otp.deleteMany({ email });

    res.json({ message: "Password reset successful. You can now sign in." });
  } catch (err) {
    console.error("Password reset error:", err.message);
    res.status(500).json({ message: "Password reset failed" });
  }
});


module.exports = router;