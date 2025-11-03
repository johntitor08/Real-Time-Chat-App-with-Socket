const socket = require("socket.io");
const http = require("http");
const express = require("express");
const app = express();
const server = http.createServer(app);
const io = socket(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json({ limit: "10kb" }));

// Store connected users and rooms
const users = new Map();
const userRooms = new Map();
const rooms = new Map();

// Initialize default rooms
rooms.set("general", {
  id: "general",
  name: "General Chat",
  type: "public",
  created: new Date(),
  users: new Set(),
});

rooms.set("random", {
  id: "random",
  name: "Random Talk",
  type: "public",
  created: new Date(),
  users: new Set(),
});

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

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
  }));
}

function generateRoomKey() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

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

    // Join general room by default
    joinRoom(socket, "general");

    // Send room list and user list
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
      if (currentRoom && rooms.has(currentRoom)) {
        leaveRoom(socket, currentRoom);
      }

      users.delete(socket.id);
      userRooms.delete(socket.id);
      io.emit("user list", getUserList());
    }
  });

  // Chat messages
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
      message: message,
      timestamp: new Date().toISOString(),
      room: currentRoom,
    };

    io.to(currentRoom).emit("chat message", messageData);
  });

  // Private message
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

  // Create room
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

    // Generate unique room ID if already exists
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

    // Join the newly created room
    joinRoom(socket, roomId);

    // Notify everyone about new room
    io.emit("room list", getRoomList());

    socket.emit("chat message", {
      type: "system",
      message: `Room "${roomName}" created! ${
        roomType === "private" ? `Key: ${roomData.key}` : ""
      }`,
      timestamp: new Date().toISOString(),
    });
  });

  // Join room with optional key
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

    // Check if room is private and key is required
    if (room.type === "private" && room.key !== key) {
      socket.emit("error", "Invalid room key");
      return;
    }

    const currentRoom = userRooms.get(socket.id);
    if (currentRoom === roomId) return;

    if (currentRoom) {
      leaveRoom(socket, currentRoom);
    }

    joinRoom(socket, roomId);
  });

  // Leave current room
  socket.on("leave room", () => {
    const user = users.get(socket.id);
    if (!user) return;

    const currentRoom = userRooms.get(socket.id);
    if (currentRoom && currentRoom !== "general") {
      leaveRoom(socket, currentRoom);
      joinRoom(socket, "general");
    }
  });

  // Get room info
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

  // Handle commands
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

  // Room management functions
  function joinRoom(socket, roomId) {
    const user = users.get(socket.id);
    if (!user || !rooms.has(roomId)) return;

    const room = rooms.get(roomId);

    // Leave current room if any
    const currentRoom = userRooms.get(socket.id);
    if (currentRoom && rooms.has(currentRoom)) {
      leaveRoom(socket, currentRoom);
    }

    // Join new room
    socket.join(roomId);
    userRooms.set(socket.id, roomId);
    room.users.add(socket.id);

    // Notify room
    io.to(roomId).emit("chat message", {
      type: "system",
      message: `${user.username} joined the room`,
      timestamp: new Date().toISOString(),
    });

    // Send room update to user
    const roomUsers = Array.from(room.users).map(
      (userId) => users.get(userId).username
    );

    socket.emit("room update", {
      room: room,
      users: roomUsers,
    });

    // Update room list for everyone
    io.emit("room list", getRoomList());

    console.log(`${user.username} joined room: ${roomId}`);
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

    // Remove room if empty and not default
    if (room.users.size === 0 && !["general", "random"].includes(roomId)) {
      rooms.delete(roomId);
      io.emit("room list", getRoomList());
    }

    console.log(`${user.username} left room: ${roomId}`);
  }

  // Typing indicators
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

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Default rooms created: ${Array.from(rooms.keys()).join(", ")}`);
});
