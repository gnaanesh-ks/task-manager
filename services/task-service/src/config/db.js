const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI environment variable is not set");
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  mongoose.connection.on("error", (err) => {
    console.error("[MongoDB] connection error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[MongoDB] disconnected");
  });

  console.log("[MongoDB] connected successfully (task-service)");
}

module.exports = connectDB;
