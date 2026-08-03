const express = require("express");
const mongoose = require("mongoose");
const Task = require("../models/Task");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// GET /api/tasks/
router.get("/", async (req, res) => {
  try {
    const tasks = await Task.find({ ownerId: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ tasks });
  } catch (err) {
    console.error("[tasks/list] error:", err);
    return res.status(500).json({ message: "Failed to fetch tasks" });
  }
});

// GET /api/tasks/:id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const task = await Task.findOne({ _id: id, ownerId: req.user.id });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    return res.status(200).json({ task });
  } catch (err) {
    console.error("[tasks/get] error:", err);
    return res.status(500).json({ message: "Failed to fetch task" });
  }
});

// POST /api/tasks/
router.post("/", async (req, res) => {
  try {
    const { title, description, priority } = req.body || {};

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Task title is required" });
    }

    if (priority && !["low", "medium", "high"].includes(priority)) {
      return res.status(400).json({ message: "Priority must be one of: low, medium, high" });
    }

    const task = await Task.create({
      title: title.trim(),
      description: (description || "").trim(),
      priority: priority || "medium",
      ownerId: req.user.id,
    });

    return res.status(201).json({ message: "Task created", task });
  } catch (err) {
    console.error("[tasks/create] error:", err);
    return res.status(500).json({ message: "Failed to create task" });
  }
});

// PUT /api/tasks/:id
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const allowedUpdates = ["title", "description", "priority", "completed"];
    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (updates.priority && !["low", "medium", "high"].includes(updates.priority)) {
      return res.status(400).json({ message: "Priority must be one of: low, medium, high" });
    }

    const task = await Task.findOneAndUpdate(
      { _id: id, ownerId: req.user.id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    return res.status(200).json({ message: "Task updated", task });
  } catch (err) {
    console.error("[tasks/update] error:", err);
    return res.status(500).json({ message: "Failed to update task" });
  }
});

// DELETE /api/tasks/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const task = await Task.findOneAndDelete({ _id: id, ownerId: req.user.id });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    return res.status(200).json({ message: "Task deleted" });
  } catch (err) {
    console.error("[tasks/delete] error:", err);
    return res.status(500).json({ message: "Failed to delete task" });
  }
});

module.exports = router;
