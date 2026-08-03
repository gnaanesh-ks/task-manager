const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { validateSignup, validateLogin } = require("../middleware/validate");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
const SALT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// POST /api/auth/signup
router.post("/signup", validateSignup, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ username, email, passwordHash });

    const token = signToken(user);

    return res.status(201).json({
      message: "Account created successfully",
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    console.error("[auth/signup] error:", err);
    return res.status(500).json({ message: "Internal server error during signup" });
  }
});

// POST /api/auth/login
router.post("/login", validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user);

    return res.status(200).json({
      message: "Logged in successfully",
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error("[auth/login] error:", err);
    return res.status(500).json({ message: "Internal server error during login" });
  }
});

// GET /api/auth/verify
// Used by both the frontend (on load) and by the task-service is NOT
// dependent on this route directly — task-service verifies JWTs locally
// using the shared JWT_SECRET to avoid a network hop per request.
router.get("/verify", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.sub);

    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    return res.status(200).json({ valid: true, user: user.toSafeObject() });
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

module.exports = router;
