require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const connectDB = require("./src/config/db");
const authRoutes = require("./src/routes/auth");

const app = express();
const PORT = process.env.PORT || 4000;

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required. Exiting.");
  process.exit(1);
}

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10kb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
});
app.use("/api/auth", authLimiter);

app.get("/healthz", (req, res) => res.status(200).json({ status: "ok", service: "auth-service" }));
app.get("/readyz", (req, res) => {
  const mongoose = require("mongoose");
  const isReady = mongoose.connection.readyState === 1;
  return res.status(isReady ? 200 : 503).json({ ready: isReady });
});

app.use("/api/auth", authRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("[auth-service] Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Auth service listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start auth-service:", err.message);
    process.exit(1);
  }
}

start();

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down auth-service gracefully");
  process.exit(0);
});
