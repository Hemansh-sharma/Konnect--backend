const socket = require("socket.io");
const crypto = require("crypto");
const { Chat } = require("../models/chat");
const ConnectionRequest = require("../models/connectionRequest");

const getSecretRoomId = (userId, targetUserId) => {
  return crypto
    .createHash("sha256")
    .update([userId, targetUserId].sort().join("$"))
    .digest("hex");
};

// Store online users: { userId: socketId }
const onlineUsers = new Map();

const initializeSocket = (server) => {
  const io = socket(server, {
    cors: {
      origin: "http://localhost:5173",
    },
  });

  io.on("connection", (socket) => {
    // Send current list of online users to the newly connected client
    socket.emit("onlineUsersList", { 
      users: Array.from(onlineUsers.keys()) 
    });

    // Track user online status
    socket.on("userOnline", ({ userId }) => {
      const userIdStr = userId.toString();
      onlineUsers.set(userIdStr, socket.id);
      console.log(`User ${userIdStr} is online with socket ${socket.id}`);
      
      // Broadcast to all clients that a user is online
      io.emit("userOnline", { userId: userIdStr });
    });

    socket.on("joinChat", ({ firstName, userId, targetUserId }) => {
      const roomId = getSecretRoomId(userId, targetUserId);
      console.log(firstName + " joined Room : " + roomId);
      socket.join(roomId);
    });

    socket.on("joinGroupChat", ({ groupChatId, firstName, userId }) => {
      console.log(firstName + " joined group chat : " + groupChatId);
      socket.join(groupChatId);
    });

    socket.on(
      "sendMessage",
      async ({ firstName, lastName, userId, targetUserId, text, imageUrl }) => {
        // Save messages to the database
        try {
          const roomId = getSecretRoomId(userId, targetUserId);
          console.log(firstName + " " + (text || "sent an image"));

          // TODO: Check if userId & targetUserId are friends

          let chat = await Chat.findOne({
            participants: { $all: [userId, targetUserId] },
            isGroupChat: false,
          });

          if (!chat) {
            chat = new Chat({
              participants: [userId, targetUserId],
              messages: [],
              isGroupChat: false,
            });
          }

          const messageData = {
            senderId: userId,
          };
          
          if (text) {
            messageData.text = text;
          }
          
          if (imageUrl) {
            messageData.imageUrl = imageUrl;
          }

          chat.messages.push(messageData);

          await chat.save();
          io.to(roomId).emit("messageReceived", { firstName, lastName, text, imageUrl });

          // Notify the recipient if they're online but not in the chat room
          const targetUserIdStr = targetUserId.toString();
          if (onlineUsers.has(targetUserIdStr)) {
            const targetSocketId = onlineUsers.get(targetUserIdStr);
            io.to(targetSocketId).emit("newMessage", { senderId: userId });
          }
        } catch (err) {

          console.log(err);
        }
      }
    );

    socket.on(
      "sendGroupMessage",
      async ({ groupChatId, firstName, lastName, userId, text, imageUrl }) => {
        try {
          console.log(firstName + " sent message to group : " + groupChatId);

          const chat = await Chat.findById(groupChatId);

          if (!chat) {
            console.error("Group chat not found");
            return;
          }

          // Check if user is a participant
          if (!chat.participants.includes(userId)) {
            console.error("User is not a participant of this group");
            return;
          }

          const messageData = {
            senderId: userId,
          };
          
          if (text) {
            messageData.text = text;
          }
          
          if (imageUrl) {
            messageData.imageUrl = imageUrl;
          }

          chat.messages.push(messageData);
          await chat.save();

          io.to(groupChatId).emit("groupMessageReceived", { 
            firstName, 
            lastName, 
            text, 
            imageUrl,
            senderId: userId,
          });
        } catch (err) {
          console.log(err);
        }
      }
    );

    socket.on("disconnect", () => {
      // Remove user from online users when they disconnect
      for (let [userIdStr, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          onlineUsers.delete(userIdStr);
          console.log(`User ${userIdStr} is offline`);
          
          // Broadcast to all clients that a user is offline
          io.emit("userOffline", { userId: userIdStr });
          break;
        }
      }
    });
  });

  // Store io instance for use in routes
  server.io = io;
  // Store onlineUsers map for use in routes
  server.onlineUsers = onlineUsers;
};

module.exports = initializeSocket;
