const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Resend } = require("resend");
const User = require("../models/User");
const Otp = require("../models/Otp");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

const resend = new Resend(process.env.RESEND_API_KEY);

// ✅ Send OTP
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists. Please Sign In instead." });
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP in MongoDB
    await Otp.create({
      email,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // ⭐ SEND EMAIL USING RESEND
    await resend.emails.send({
  from: "IRONIC Store <noreply@ironicgym.com>",
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
    const { name, email, password, phone, countryCode, otp } = req.body;
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
      countryCode,
    });

    const token = jwt.sign({ id: newUser._id }, JWT_SECRET, { expiresIn: "1d" });

    res.json({
      message: "Account created successfully",
      user: { id: newUser._id, name: newUser.name, email: newUser.email ,fullPhone: newUser.fullPhone},
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

    // 1. Look for the email directly (this finds your "orphaned" account)
    let user = await User.findOne({ email: email });

    if (user) {
      // 2. Found the user! Now ensure the Google ID is linked correctly.
      if (user.googleId !== googleId) {
        user.googleId = googleId;
        await user.save();
        console.log("Fixed broken Google link for existing user.");
      }

      const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1d" });

      return res.json({
        message: "Google sign-in successful",
        user: { id: user._id, name: user.name, email: user.email },
        token,
        isAdmin: user.isAdmin,
      });
    } 
    
    // 3. If user truly doesn't exist, create them
    else {
      // Generate a random password to satisfy 'required: true' in your schema
      const dummyPassword = await bcrypt.hash(Math.random().toString(36), 10);

      const newUser = await User.create({
        name: name,
        email: email,
        googleId: googleId,
        password: dummyPassword, 
      });

      const token = jwt.sign({ id: newUser._id }, JWT_SECRET, { expiresIn: "1d" });

      return res.status(201).json({
        message: "Google sign-in successful",
        user: { id: newUser._id, name: newUser.name, email: newUser.email },
        token,
        isAdmin: false,
      });
    }

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

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found with this email" });

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.create({
      email,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // ⭐ SEND EMAIL USING RESEND
    await resend.emails.send({
  from: "IRONIC Store <noreply@ironicgym.com>",
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
// --- SMTP TEST ROUTE ---




module.exports = router;
