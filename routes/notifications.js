import express from "express";
import webpush from "web-push";
import Subscription from "../models/Subscription.js";
import authMiddleware from "../middleware/auth.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || "mailto:kartikkathrotiya0542.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

// Subscription save karo
router.post("/subscribe", authMiddleware, async (req, res) => {
  try {
    const { subscription } = req.body;
    const username = req.user.username;

    // Pehle se hai toh update karo
    await Subscription.findOneAndUpdate(
      { username },
      { username, subscription },
      { upsert: true, new: true },
    );

    res.status(201).json({ message: "Subscribed!" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Notification bhejo
router.post("/send", authMiddleware, async (req, res) => {
  try {
    const { title, body, senderUsername } = req.body;

    // Sender ko chhod ke sab ko bhejo
    const subscriptions = await Subscription.find({
      username: { $ne: senderUsername },
    });

    const payload = JSON.stringify({ title, body });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(sub.subscription, payload),
      ),
    );

    res
      .status(200)
      .json({ message: "Notifications sent!", count: results.length });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
