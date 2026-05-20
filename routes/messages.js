import express from "express";
import Message from "../models/Message.js";
import authMiddleware from "../middleware/auth.js";
import User from "../models/User.js";
import multer from "multer";
import { uploadToS3 } from "../utils/s3.js";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Sirf images allowed hain!"), false);
    }
  },
});

// Send Image Message
router.post(
  "/image",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
      if (req.user.isDuress) {
        return res.status(200).json({ message: "Sent" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Image nahi mili" });
      }

      const userDoc = await User.findOne({ username: req.user.username });

      const fileName = `chat-images/${Date.now()}-${req.file.originalname}`;
      const fileUrl = await uploadToS3(req.file, fileName);

      const fileSizeKB = (req.file.size / 1024).toFixed(2);
      const fileSize =
        fileSizeKB > 1024
          ? `${(fileSizeKB / 1024).toFixed(2)} MB`
          : `${fileSizeKB} KB`;

      const message = new Message({
        username: req.user.username,
        content: req.file.originalname,
        messageType: "file",
        fileUrl,
        fileName: req.file.originalname,
        fileSize,
        isAdmin: userDoc?.isAdmin || false,
        seenBy: [],
      });

      await message.save();
      res.status(201).json(message);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Pin / Unpin Message (Admin only)
router.patch("/:id/pin", authMiddleware, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: "Message nahi mila" });
    }

    const isPinned = !message.isPinned;
    await Message.findByIdAndUpdate(req.params.id, {
      isPinned,
      pinnedBy: isPinned ? req.user.username : null,
      pinnedAt: isPinned ? new Date() : null,
    });

    res.status(200).json({
      message: isPinned ? "Message pin ho gaya" : "Message unpin ho gaya",
      id: req.params.id,
      isPinned,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get Pinned Messages
router.get("/pinned", authMiddleware, async (req, res) => {
  try {
    if (req.user.isDuress) return res.status(200).json([]);
    const pinned = await Message.find({ isPinned: true }).sort({
      pinnedAt: -1,
    });
    res.status(200).json(pinned);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

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

// Delete Message
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: "Message nahi mila" });
    }

    // Sirf apna message delete kar sakta hai, ya admin koi bhi
    if (message.username !== req.user.username && !req.user.isAdmin) {
      return res
        .status(403)
        .json({ message: "Aap sirf apna message delete kar sakte hain!" });
    }

    await Message.findByIdAndDelete(req.params.id);

    // Socket se sab ko notify karo
    return res
      .status(200)
      .json({ message: "Message delete ho gaya", id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get All Images
router.get("/gallery", authMiddleware, async (req, res) => {
  try {
    if (req.user.isDuress) return res.status(200).json([]);

    const images = await Message.find({ messageType: "file" }).sort({
      createdAt: -1,
    });
    res.status(200).json(images);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Mark messages as seen
router.post("/seen", authMiddleware, async (req, res) => {
  try {
    if (req.user.isDuress) return res.status(200).json({ message: "OK" });

    const username = req.user.username;

    // Sirf wo messages jisme ye user already seen nahi hai
    const messagesToUpdate = await Message.find({
      username: { $ne: username },
      "seenBy.username": { $ne: username }, // ← Ye duplicate rok raha hai
    });

    const updatedIds = messagesToUpdate.map((m) => String(m._id));

    if (updatedIds.length === 0) {
      return res.status(200).json({ message: "Already seen", updatedIds: [] });
    }

    await Message.updateMany(
      { _id: { $in: updatedIds } },
      { $addToSet: { seenBy: { username, seenAt: new Date() } } }, // ← $push ki jagah $addToSet
    );

    res.status(200).json({ message: "Seen updated", updatedIds });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
