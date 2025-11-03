const socket = require("socket.io");
const http = require("http");
const express = require("express");
const app = express();
const server = http.createServer(app);
const io = socket(server);

const PORT = process.env.PORT || 3000;

// Security middleware
app.use(express.static("public"));
app.use(express.json({ limit: "10kb" }));

// Rate limiting (you might want to add a package like express-rate-limit)
const connectedUsers = new Map();

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("User connected: " + socket.id);
  connectedUsers.set(socket.id, { connectedAt: new Date() });

  // Welcome message to the newly connected user
  socket.emit("chat message", {
    user: "System",
    message: "Welcome to the chat!",
    timestamp: new Date().toISOString(),
  });

  // Notify others about new user
  socket.broadcast.emit("chat message", {
    user: "System",
    message: "A new user joined the chat",
    timestamp: new Date().toISOString(),
  });

  socket.on("disconnect", (reason) => {
    console.log(`User disconnected: ${socket.id} - Reason: ${reason}`);
    connectedUsers.delete(socket.id);

    // Notify others about user leaving
    socket.broadcast.emit("chat message", {
      user: "System",
      message: "A user left the chat",
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("chat message", (msg) => {
    // Input validation and sanitization
    if (typeof msg !== "string" || msg.trim().length === 0) {
      return socket.emit("error", "Invalid message");
    }

    // Limit message length
    const sanitizedMsg = msg.trim().substring(0, 500);

    console.log(`Message from ${socket.id}: ${sanitizedMsg}`);

    // Create message object with metadata
    const messageData = {
      id: Date.now() + Math.random(),
      user: `User-${socket.id.substring(0, 6)}`, // Simple user identifier
      message: sanitizedMsg,
      timestamp: new Date().toISOString(),
      socketId: socket.id,
    };

    // Broadcast to all connected clients
    io.emit("chat message", messageData);
  });

  // Handle typing indicators
  socket.on("typing", (isTyping) => {
    socket.broadcast.emit("user typing", {
      socketId: socket.id,
      isTyping: isTyping,
    });
  });

  // Error handling
  socket.on("error", (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Export for testing
module.exports = { app, server, io };
