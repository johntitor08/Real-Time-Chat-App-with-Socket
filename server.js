const socket = require("socket.io");
const http = require("http");
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;

const app = express();
const server = http.createServer(app);
const io = socket(server);

const PORT = process.env.PORT || 3000;

// Ensure upload directory exists
const uploadsDir = path.join(__dirname, "public", "uploads");
(async () => {
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
  }
})();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp4|mp3/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("File type not allowed"));
    }
  },
});

// Middleware
app.use(express.static("public"));
app.use(express.json({ limit: "10kb" }));

// Data storage
const users = new Map();
const userRooms = new Map();
const rooms = new Map();
const messageHistory = {};
const MESSAGE_HISTORY_FILE = path.join(__dirname, "message-history.json");

// Initialize default rooms
rooms.set("general", {
  id: "general",
  name: "General Chat",
  type: "public",
  created: new Date(),
  users: new Set(),
  creator: "System",
});

rooms.set("random", {
  id: "random",
  name: "Random Talk",
  type: "public",
  created: new Date(),
  users: new Set(),
  creator: "System",
});

// Load message history
async function loadMessageHistory() {
  try {
    const data = await fs.readFile(MESSAGE_HISTORY_FILE, "utf8");
    const history = JSON.parse(data);
    Object.assign(messageHistory, history);
  } catch (error) {
    console.log("No existing message history found");
  }
}

// Save message history
async function saveMessageHistory() {
  try {
    await fs.writeFile(
      MESSAGE_HISTORY_FILE,
      JSON.stringify(messageHistory, null, 2)
    );
  } catch (error) {
    console.error("Error saving message history:", error);
  }
}

// Helper functions
function getUserList() {
  return Array.from(users.values()).map((user) => ({
    id: user.id,
    username: user.username,
    isOnline: true,
  }));
}

function getRoomList() {
  return Array.from(rooms.values()).map((room) => ({
    id: room.id,
    name: room.name,
    type: room.type,
    userCount: room.users.size,
    created: room.created,
    creator: room.creator,
  }));
}

function generateRoomKey() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getFileIcon(mimetype) {
  const fileType = mimetype.split("/")[0];
  if (fileType === "image") return "🖼️";
  if (fileType === "video") return "🎥";
  if (fileType === "audio") return "🎵";
  if (mimetype.includes("pdf")) return "📕";
  if (mimetype.includes("text")) return "📝";
  return "📄";
}

// Room management
function joinRoom(socket, roomId) {
  const user = users.get(socket.id);
  if (!user || !rooms.has(roomId)) return;

  const room = rooms.get(roomId);
  const currentRoom = userRooms.get(socket.id);

  // Leave current room
  if (currentRoom && rooms.has(currentRoom)) {
    leaveRoom(socket, currentRoom);
  }

  // Join new room
  socket.join(roomId);
  userRooms.set(socket.id, roomId);
  room.users.add(socket.id);

  // Send message history
  if (messageHistory[roomId]) {
    socket.emit("message history", messageHistory[roomId]);
  }

  // Notify room
  io.to(roomId).emit("chat message", {
    type: "system",
    message: `${user.username} joined the room`,
    timestamp: new Date().toISOString(),
  });

  // Send room update
  const roomUsers = Array.from(room.users).map(
    (userId) => users.get(userId).username
  );
  socket.emit("room update", {
    room: room,
    users: roomUsers,
  });

  // Update room list
  io.emit("room list", getRoomList());
}

function leaveRoom(socket, roomId) {
  const user = users.get(socket.id);
  if (!user || !rooms.has(roomId)) return;

  const room = rooms.get(roomId);
  room.users.delete(socket.id);
  socket.leave(roomId);

  // Notify room
  io.to(roomId).emit("chat message", {
    type: "system",
    message: `${user.username} left the room`,
    timestamp: new Date().toISOString(),
  });

  // Remove empty non-default rooms
  if (room.users.size === 0 && !["general", "random"].includes(roomId)) {
    rooms.delete(roomId);
    delete messageHistory[roomId];
  }

  io.emit("room list", getRoomList());
  saveMessageHistory();
}

// Command handler
function handleCommand(socket, message, user) {
  const args = message.slice(1).split(" ");
  const command = args[0].toLowerCase();

  switch (command) {
    case "help":
      const helpMsg = [
        "Available commands:",
        "/help - Show this help",
        "/users - List online users",
        "/rooms - List all rooms",
        "/create [name] [public|private] - Create room",
        "/join [room] [key] - Join room",
        "/leave - Leave current room",
        "/info - Room information",
        "/pm [user] [message] - Private message",
      ].join("\n");

      socket.emit("chat message", {
        type: "system",
        message: helpMsg,
        timestamp: new Date().toISOString(),
      });
      break;

    case "users":
      const userList = getUserList()
        .map((u) => u.username)
        .join(", ");
      socket.emit("chat message", {
        type: "system",
        message: `Online users: ${userList} (${getUserList().length} total)`,
        timestamp: new Date().toISOString(),
      });
      break;

    case "rooms":
      const roomList = getRoomList()
        .map(
          (room) =>
            `${room.name} (${room.userCount} users) ${
              room.type === "private" ? "🔒" : "🔓"
            }`
        )
        .join("\n");

      socket.emit("chat message", {
        type: "system",
        message: `Available rooms:\n${roomList}`,
        timestamp: new Date().toISOString(),
      });
      break;

    case "create":
      if (args[1]) {
        const roomName = args[1];
        const roomType = args[2] === "private" ? "private" : "public";
        socket.emit("create room", { name: roomName, type: roomType });
      } else {
        socket.emit("error", "Usage: /create [room-name] [public|private]");
      }
      break;

    case "join":
      if (args[1]) {
        const roomName = args[1].toLowerCase().replace(/\s+/g, "-");
        const key = args[2];
        socket.emit("join room", { roomId: roomName, key: key });
      } else {
        socket.emit("error", "Usage: /join [room-name] [key]");
      }
      break;

    case "leave":
      socket.emit("leave room");
      break;

    case "info":
      const currentRoom = userRooms.get(socket.id);
      if (currentRoom) {
        socket.emit("get room info", currentRoom);
      }
      break;

    case "pm":
      if (args.length >= 3) {
        const targetUsername = args[1];
        const pmMessage = args.slice(2).join(" ");

        const targetUser = Array.from(users.values()).find(
          (u) => u.username.toLowerCase() === targetUsername.toLowerCase()
        );

        if (targetUser) {
          socket.emit("private message", {
            toUserId: targetUser.id,
            message: pmMessage,
          });
        } else {
          socket.emit("error", `User '${targetUsername}' not found`);
        }
      } else {
        socket.emit("error", "Usage: /pm [username] [message]");
      }
      break;

    default:
      socket.emit(
        "error",
        `Unknown command: ${command}. Type /help for available commands.`
      );
  }
}

// Routes
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  res.json({
    success: true,
    file: {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: `/uploads/${req.file.filename}`,
    },
  });
});

// Socket.io events
io.on("connection", (socket) => {
  console.log("User connected: " + socket.id);

  socket.on("user join", (username) => {
    if (!username || username.trim().length === 0) {
      socket.emit("error", "Invalid username");
      return;
    }

    const userData = {
      id: socket.id,
      username: username.trim().substring(0, 20),
      joinedAt: new Date(),
    };

    users.set(socket.id, userData);
    joinRoom(socket, "general");

    socket.emit("room list", getRoomList());
    io.emit("user list", getUserList());

    socket.emit("chat message", {
      type: "system",
      message:
        "Welcome to the chat! Create rooms with /create or join with /join",
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (user) {
      const currentRoom = userRooms.get(socket.id);
      if (currentRoom) {
        leaveRoom(socket, currentRoom);
      }

      users.delete(socket.id);
      userRooms.delete(socket.id);
      io.emit("user list", getUserList());
    }
  });

  socket.on("chat message", (data) => {
    const user = users.get(socket.id);
    if (!user) {
      socket.emit("error", "Please join first");
      return;
    }

    if (!data.message || data.message.trim().length === 0) return;

    const message = data.message.trim().substring(0, 500);

    if (message.startsWith("/")) {
      handleCommand(socket, message, user);
      return;
    }

    const currentRoom = userRooms.get(socket.id);
    if (!currentRoom || !rooms.has(currentRoom)) return;

    const messageData = {
      type: "public",
      id: Date.now() + Math.random(),
      user: user.username,
      userId: socket.id,
      message: message,
      timestamp: new Date().toISOString(),
      room: currentRoom,
    };

    // Save to history
    if (!messageHistory[currentRoom]) {
      messageHistory[currentRoom] = [];
    }
    messageHistory[currentRoom].push(messageData);

    if (messageHistory[currentRoom].length > 100) {
      messageHistory[currentRoom] = messageHistory[currentRoom].slice(-100);
    }

    saveMessageHistory();

    io.to(currentRoom).emit("chat message", messageData);
  });

  socket.on("private message", (data) => {
    const fromUser = users.get(socket.id);
    if (!fromUser) return;

    if (!data.toUserId || !data.message) {
      socket.emit("error", "Invalid private message");
      return;
    }

    const toUser = users.get(data.toUserId);
    if (!toUser) {
      socket.emit("error", "User not found");
      return;
    }

    const message = data.message.trim().substring(0, 500);
    const messageData = {
      type: "private",
      id: Date.now() + Math.random(),
      from: fromUser.username,
      fromId: socket.id,
      to: toUser.username,
      toId: data.toUserId,
      message: message,
      timestamp: new Date().toISOString(),
    };

    socket.emit("private message", messageData);
    io.to(data.toUserId).emit("private message", messageData);
  });

  socket.on("create room", (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const roomName = data.name.trim().substring(0, 20);
    const roomType = data.type || "public";

    if (!roomName) {
      socket.emit("error", "Room name cannot be empty");
      return;
    }

    let roomId = roomName.toLowerCase().replace(/\s+/g, "-");

    if (rooms.has(roomId)) {
      roomId = roomId + "-" + generateRoomKey();
    }

    const roomData = {
      id: roomId,
      name: roomName,
      type: roomType,
      key: roomType === "private" ? generateRoomKey() : null,
      created: new Date(),
      creator: user.username,
      users: new Set(),
    };

    rooms.set(roomId, roomData);
    joinRoom(socket, roomId);

    io.emit("room list", getRoomList());

    socket.emit("chat message", {
      type: "system",
      message: `Room "${roomName}" created! ${
        roomType === "private" ? `Key: ${roomData.key}` : ""
      }`,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("join room", (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const roomId = data.roomId;
    const key = data.key;

    if (!rooms.has(roomId)) {
      socket.emit("error", "Room not found");
      return;
    }

    const room = rooms.get(roomId);

    if (room.type === "private" && room.key !== key) {
      socket.emit("error", "Invalid room key");
      return;
    }

    joinRoom(socket, roomId);
  });

  socket.on("leave room", () => {
    const user = users.get(socket.id);
    if (!user) return;

    const currentRoom = userRooms.get(socket.id);
    if (currentRoom && currentRoom !== "general") {
      leaveRoom(socket, currentRoom);
      joinRoom(socket, "general");
    }
  });

  socket.on("get room info", (roomId) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const roomUsers = Array.from(room.users).map(
        (userId) => users.get(userId).username
      );

      socket.emit("room info", {
        id: room.id,
        name: room.name,
        type: room.type,
        userCount: room.users.size,
        users: roomUsers,
        created: room.created,
        creator: room.creator,
      });
    }
  });

  socket.on("file message", (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const currentRoom = userRooms.get(socket.id);
    if (!currentRoom) return;

    const messageData = {
      type: "file",
      id: Date.now() + Math.random(),
      user: user.username,
      userId: socket.id,
      file: data.file,
      timestamp: new Date().toISOString(),
      room: currentRoom,
    };

    // Save to history
    if (!messageHistory[currentRoom]) {
      messageHistory[currentRoom] = [];
    }
    messageHistory[currentRoom].push(messageData);
    saveMessageHistory();

    io.to(currentRoom).emit("chat message", messageData);
  });

  socket.on("message reaction", (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const { messageId, emoji, roomId } = data;

    if (messageHistory[roomId]) {
      const message = messageHistory[roomId].find(
        (msg) => msg.id === messageId
      );
      if (message) {
        if (!message.reactions) {
          message.reactions = {};
        }
        if (!message.reactions[emoji]) {
          message.reactions[emoji] = [];
        }

        const userIndex = message.reactions[emoji].indexOf(user.username);
        if (userIndex > -1) {
          message.reactions[emoji].splice(userIndex, 1);
          if (message.reactions[emoji].length === 0) {
            delete message.reactions[emoji];
          }
        } else {
          message.reactions[emoji].push(user.username);
        }

        saveMessageHistory();

        io.to(roomId).emit("message reaction", {
          messageId: messageId,
          reactions: message.reactions,
        });
      }
    }
  });

  socket.on("typing", (isTyping) => {
    const user = users.get(socket.id);
    const currentRoom = userRooms.get(socket.id);

    if (user && currentRoom) {
      socket.to(currentRoom).emit("user typing", {
        username: user.username,
        isTyping: isTyping,
      });
    }
  });
});

// Initialize and start server
loadMessageHistory().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Default rooms: ${Array.from(rooms.keys()).join(", ")}`);
  });
});

module.exports = { app, server, io };
