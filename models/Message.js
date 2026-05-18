import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  content: {
    type: String,
    required: true,
  },
  messageType: {
    type: String,
    enum: ["text", "file"],
    default: "text",
  },
  fileUrl: {
    type: String,
    default: null,
  },
  fileName: {
    type: String,
    default: null,
  },
  fileSize: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Message", messageSchema);
