require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");

const connectDB = require("./src/config/db");
const taskRoutes = require("./src/routes/tasks");

const app = express();
const PORT = process.env.PORT || 4001;

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required. Exiting.");
  process.exit(1);
}

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "50kb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/healthz", (req, res) => res.status(200).json({ status: "ok", service: "task-service" }));
app.get("/readyz", (req, res) => {
  const isReady = mongoose.connection.readyState === 1;
  return res.status(isReady ? 200 : 503).json({ ready: isReady });
});

app.use("/api/tasks", taskRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("[task-service] Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Task service listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start task-service:", err.message);
    process.exit(1);
  }
}

start();

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down task-service gracefully");
  process.exit(0);
});
