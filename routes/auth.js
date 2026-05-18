import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import authMiddleware from "../middleware/auth.js";

import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

const GROUP_NAME = process.env.GROUP_NAME;
const PASSWORD_1 = process.env.PASSWORD_1;
const PASSWORD_2 = process.env.PASSWORD_2;
const UNLOCK_KEY = process.env.UNLOCK_KEY;
const INVITE_PASSWORD = process.env.INVITE_PASSWORD;

let systemLocked = false;

// Login Route
router.post("/login", async (req, res) => {
  try {
    const { groupName, username, password } = req.body;

    // Group name check
    if (groupName !== GROUP_NAME) {
      return res.status(401).json({ message: "Incorrect Details" });
    }

    // Username check
    const user = await User.findOne({ username, groupName });
    if (!user) {
      return res.status(401).json({ message: "Incorrect Details" });
    }

    // Password 1 check
    if (password === PASSWORD_1) {
      if (systemLocked) {
        return res.status(401).json({ message: "Incorrect Details" });
      }

      const token = jwt.sign(
        { username, groupName, isDuress: false, isAdmin: user.isAdmin },
        process.env.JWT_SECRET,
        { expiresIn: "24h" },
      );
      return res.status(200).json({
        token,
        username,
        isAdmin: user.isAdmin,
        isDuress: false,
        message: "Login successful",
      });
    }

    // Password 2 check
    if (password === PASSWORD_2) {
      systemLocked = true;
      const token = jwt.sign(
        { username, groupName, isDuress: true, isAdmin: false },
        process.env.JWT_SECRET,
        { expiresIn: "24h" },
      );
      return res.status(200).json({
        token,
        username,
        isAdmin: false,
        isDuress: true,
        message: "Duress login",
      });
    }

    return res.status(401).json({ message: "Incorrect Details" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Member Add Route
router.post("/add-member", async (req, res) => {
  try {
    const { groupName, username, password } = req.body;

    if (groupName !== GROUP_NAME) {
      return res.status(401).json({ message: "Incorrect Details" });
    }

    if (password !== INVITE_PASSWORD) {
      return res.status(401).json({ message: "Incorrect Details" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // Pehla member = Admin
    const memberCount = await User.countDocuments();
    const isAdmin = memberCount === 0;
    const user = new User({ username, groupName, isAdmin });
    await user.save();

    res
      .status(201)
      .json({ message: "Member added successfully", username, isAdmin });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Unlock Route (Hardcoded)
router.post("/unlock", async (req, res) => {
  try {
    const { unlockKey } = req.body;
    if (unlockKey === UNLOCK_KEY) {
      systemLocked = false;
      return res.status(200).json({ message: "System unlocked successfully" });
    }
    return res.status(401).json({ message: "Invalid unlock key" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// System Status Route
router.get("/status", (req, res) => {
  res.json({ systemLocked });
});

// Get All Members
router.get("/members", authMiddleware, async (req, res) => {
  try {
    if (req.user.isDuress) {
      return res.status(200).json([]);
    }

    const members = await User.find().select("-__v").sort({ createdAt: 1 });
    res.status(200).json(members);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Remove Member (Admin only)
router.delete("/members/:username", authMiddleware, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Sirf admin ye kar sakta hai!" });
    }

    if (req.params.username === req.user.username) {
      return res
        .status(400)
        .json({ message: "Aap khud ko remove nahi kar sakte!" });
    }

    await User.findOneAndDelete({ username: req.params.username });
    res.status(200).json({ message: "Member remove ho gaya" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
