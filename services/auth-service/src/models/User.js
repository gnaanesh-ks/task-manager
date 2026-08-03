const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email address"],
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ email: 1 }, { unique: true });

UserSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    role: this.role,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("User", UserSchema);
