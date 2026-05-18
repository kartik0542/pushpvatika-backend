import express from "express";
import multer from "multer";
import Document from "../models/Document.js";
import authMiddleware from "../middleware/auth.js";
import { uploadToS3, deleteFromS3 } from "../utils/s3.js";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Get All Documents
router.get("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.isDuress) {
      return res.status(200).json([]);
    }

    const documents = await Document.find().sort({ createdAt: -1 });
    res.status(200).json(documents);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Upload Document
router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      if (req.user.isDuress) {
        return res.status(200).json({ message: "Uploaded" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "File nahi mila" });
      }

      const fileName = `${Date.now()}-${req.file.originalname}`;
      const fileUrl = await uploadToS3(req.file, fileName);

      const fileSizeKB = (req.file.size / 1024).toFixed(2);
      const fileSize =
        fileSizeKB > 1024
          ? `${(fileSizeKB / 1024).toFixed(2)} MB`
          : `${fileSizeKB} KB`;

      const document = new Document({
        fileName,
        originalName: req.file.originalname,
        fileUrl,
        fileSize,
        fileType: req.file.mimetype,
        uploadedBy: req.user.username,
      });

      await document.save();
      res.status(201).json(document);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Delete Document
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.isDuress) {
      return res.status(200).json({ message: "Deleted" });
    }

    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: "Document nahi mila" });
    }

    // Sirf uploader hi delete kar sakta hai
    if (document.uploadedBy !== req.user.username) {
      return res.status(403).json({ message: "Aap sirf apni files delete kar sakte hain!" });
    }

    await deleteFromS3(document.fileName);
    await Document.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "Document delete ho gaya" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
