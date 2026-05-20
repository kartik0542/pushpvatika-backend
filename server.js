import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.js";
import messageRoutes from "./routes/messages.js";
import documentRoutes from "./routes/documents.js";
import notificationRoutes from "./routes/notifications.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const removedUsers = new Set();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Database Connect
connectDB();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/notifications", notificationRoutes);

// Socket.io
// Online users track karo
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (username) => {
    socket.username = username;
    onlineUsers.set(username, socket.id);
    // Sab ko online users bhejo
    io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    console.log(`${username} joined`);
  });

  socket.on("sendMessage", (message) => {
    io.emit("receiveMessage", message);
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      onlineUsers.delete(socket.username);
      // Sab ko updated online users bhejo
      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    }
    console.log("User disconnected:", socket.id);
  });

  socket.on("deleteMessage", (messageId) => {
    io.emit("messageDeleted", messageId);
  });

  socket.on("messageSeen", (data) => {
    io.emit("messageSeenUpdate", data);
  });

  socket.on("pinMessage", (data) => {
    io.emit("messagePinned", data);
  });

  socket.on("userRemoved", (username) => {
    removedUsers.add(username);
    io.emit("forceLogout", username);
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
