const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    completed: {
      type: Boolean,
      default: false,
    },
    // References the User._id from the auth-service's User collection.
    // Since these are separate microservices/bounded contexts, we store
    // this as a plain string ID rather than a Mongoose ref/populate,
    // avoiding a cross-service data dependency.
    ownerId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

TaskSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = mongoose.model("Task", TaskSchema);
