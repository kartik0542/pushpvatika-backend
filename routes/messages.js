import express from "express";
import Message from "../models/Message.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

// Get All Messages
router.get("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.isDuress) {
      return res.status(200).json([]);
    }

    const messages = await Message.find().sort({ createdAt: 1 });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Send Message
router.post("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.isDuress) {
      return res.status(200).json({ message: "Message sent" });
    }

    const { content } = req.body;

    // User ka isAdmin fetch karo
    const userDoc = await User.findOne({ username: req.user.username });

    const message = new Message({
      username: req.user.username,
      content,
      messageType: "text",
      isAdmin: userDoc?.isAdmin || false,
    });

    await message.save();
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
