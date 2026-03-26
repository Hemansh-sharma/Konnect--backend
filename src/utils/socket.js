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
    console.log("New socket connected:", socket.id);

    const getUserRoom = (userId) => `user:${userId}`;
    const emitToUser = (userId, eventName, payload) => {
      const userIdStr = userId?.toString();
      if (!userIdStr) return false;

      const roomId = getUserRoom(userIdStr);
      const room = io.sockets.adapter.rooms.get(roomId);
      if (room && room.size > 0) {
        io.to(roomId).emit(eventName, payload);
        return true;
      }

      // Fallback for older sockets not yet joined to user room.
      if (onlineUsers.has(userIdStr)) {
        io.to(onlineUsers.get(userIdStr)).emit(eventName, payload);
        return true;
      }

      return false;
    };

    // Send current list of online users to the newly connected client
    socket.emit("onlineUsersList", { 
      users: Array.from(onlineUsers.keys()) 
    });

    // Track user online status
    socket.on("userOnline", ({ userId }) => {
      const userIdStr = userId.toString();
      onlineUsers.set(userIdStr, socket.id);
      socket.data.userId = userIdStr;
      socket.join(getUserRoom(userIdStr));
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
      console.log(firstName + " (userId: " + userId + ") joined group chat room: " + groupChatId);
      socket.join(groupChatId);
      
      // Verify the room has the socket
      const room = io.sockets.adapter.rooms.get(groupChatId);
      if (room) {
        console.log(`Room ${groupChatId} now has ${room.size} socket(s)`);
      }
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

    // ===== WEBRTC CALL SIGNALING EVENTS =====

    // One-to-one call events
    socket.on("startCall", ({ from, fromName, to, callType }) => {
      const toUserIdStr = to.toString();
      console.log(`${fromName} (${from}) is calling ${to}`);
      
      if (emitToUser(toUserIdStr, "incomingCall", {
          from,
          fromName,
          callType,
        })) {
        return;
      } else {
        // User is offline, send notification
        io.to(socket.id).emit("userOfflineForCall", {
          to,
          message: "User is not available",
        });
      }
    });

    socket.on("acceptCall", ({ from, to }) => {
      // Frontend sends: from = accepter(callee), to = caller
      const callerUserIdStr = to.toString();
      console.log(`${from} accepted call from ${to}`);

      emitToUser(callerUserIdStr, "callAccepted", {
        from,
      });
    });

    socket.on("rejectCall", ({ from, to }) => {
      // Frontend sends: from = rejecter(callee), to = caller
      const callerUserIdStr = to.toString();
      console.log(`${from} rejected call from ${to}`);

      emitToUser(callerUserIdStr, "callRejected", {
        from,
      });
    });

    socket.on("rtcSignal", ({ from, to, signal, groupChatId }) => {
      if (groupChatId) {
        // Group call signaling must be routed to the intended peer only.
        const toUserIdStr = to?.toString();

        if (toUserIdStr) {
          emitToUser(toUserIdStr, "rtcSignal", {
            from,
            to,
            signal,
            groupChatId,
          });
        } else {
          // Fallback only when target is missing.
          const callRoomId = `call_${groupChatId}`;
          socket.to(callRoomId).emit("rtcSignal", {
            from,
            to,
            signal,
            groupChatId,
          });
        }
      } else {
        // One-to-one call signaling
        const toUserIdStr = to.toString();
        emitToUser(toUserIdStr, "rtcSignal", {
          from,
          to,
          signal,
        });
      }
    });

    socket.on("iceCandidate", ({ from, to, candidate, groupChatId }) => {
      if (groupChatId) {
        // Group call ICE candidates must also be target-specific.
        const toUserIdStr = to?.toString();

        if (toUserIdStr) {
          emitToUser(toUserIdStr, "iceCandidate", {
            from,
            to,
            candidate,
            groupChatId,
          });
        } else {
          const callRoomId = `call_${groupChatId}`;
          socket.to(callRoomId).emit("iceCandidate", {
            from,
            to,
            candidate,
            groupChatId,
          });
        }
      } else {
        // One-to-one call ICE candidate
        const toUserIdStr = to.toString();
        emitToUser(toUserIdStr, "iceCandidate", {
          from,
          to,
          candidate,
        });
      }
    });

    socket.on("endCall", ({ from, to }) => {
      const toUserIdStr = to.toString();
      console.log(`${from} ended call with ${to}`);
      
      emitToUser(toUserIdStr, "callEnded", {
        from,
      });
    });

    // Group call events
    socket.on("joinGroupCall", ({ groupChatId, userId, userName }) => {
      console.log(`${userName} (${userId}) joined group call: ${groupChatId}`);
      const callRoomId = `call_${groupChatId}`;
      socket.data.groupCallUserId = userId?.toString();
      socket.data.groupCallUserName = userName;
      socket.data.groupCallRoomId = callRoomId;
      socket.join(callRoomId);

      // Notify other participants
      socket.to(callRoomId).emit("participantJoined", {
        userId,
        userName,
      });

      // Get existing participants
      const socketsInRoom = io.sockets.adapter.rooms.get(callRoomId);
      const participants = [];
      if (socketsInRoom) {
        for (let socketId of socketsInRoom) {
          if (socketId === socket.id) continue;

          const roomSocket = io.sockets.sockets.get(socketId);
          const participantUserId = roomSocket?.data?.groupCallUserId;
          const participantUserName = roomSocket?.data?.groupCallUserName;

          if (participantUserId) {
            participants.push({
              userId: participantUserId,
              userName: participantUserName || "Participant",
            });
          }
        }
      }

      socket.emit("existingParticipants", { participants });
    });

    socket.on("startGroupCall", async ({ groupChatId, initiatorId, initiatorName, callType }) => {
      console.log(`=== START GROUP CALL ===`);
      console.log(`Initiator: ${initiatorName} (${initiatorId})`);
      console.log(`Group Chat ID: ${groupChatId}`);
      
      try {
        // Fetch all participants in this group
        const groupChat = await Chat.findById(groupChatId);
        if (!groupChat) {
          console.log(`Group chat ${groupChatId} not found`);
          return;
        }

        console.log(`Group has ${groupChat.participants.length} participants`);

        // Notify all group members individually via user room routing.
        groupChat.participants.forEach((participantId) => {
          const participantIdStr = participantId.toString();
          
          // Don't send to the initiator (they already started the call)
          if (participantIdStr === initiatorId.toString()) {
            console.log(`Skipping notification to initiator ${participantIdStr}`);
            return;
          }

          const delivered = emitToUser(participantIdStr, "groupCallStarted", {
            initiatorId,
            initiatorName,
            callType,
            groupChatId,
          });

          if (delivered) {
            console.log(`Sent groupCallStarted to participant ${participantIdStr}`);
          } else {
            console.log(`Participant ${participantIdStr} is not online`);
          }
        });
      } catch (error) {
        console.error("Error in startGroupCall:", error);
      }
    });

    socket.on("participantLeft", ({ groupChatId, userId }) => {
      const callRoomId = `call_${groupChatId}`;
      console.log(`${userId} left group call: ${groupChatId}`);
      socket.leave(callRoomId);
      socket.to(callRoomId).emit("participantLeft", {
        userId,
      });

      const remainingRoom = io.sockets.adapter.rooms.get(callRoomId);
      const remainingCount = remainingRoom ? remainingRoom.size : 0;

      // If only one (or zero) participant remains, end the call for the rest.
      if (remainingCount <= 1) {
        io.to(callRoomId).emit("groupCallEnded", {
          endedBy: userId,
        });
        io.of("/").in(callRoomId).socketsLeave(callRoomId);
      }

      if (socket.data.groupCallRoomId === callRoomId) {
        socket.data.groupCallRoomId = null;
      }
      if (socket.data.groupCallUserId === userId?.toString()) {
        socket.data.groupCallUserId = null;
      }
      socket.data.groupCallUserName = null;
    });

    socket.on("endGroupCall", ({ groupChatId, userId }) => {
      const callRoomId = `call_${groupChatId}`;
      console.log(`Group call ended in ${groupChatId}`);
      io.to(callRoomId).emit("groupCallEnded", {
        endedBy: userId,
      });
      io.of("/").in(callRoomId).socketsLeave(callRoomId);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);

      if (socket.data.groupCallRoomId && socket.data.groupCallUserId) {
        const callRoomId = socket.data.groupCallRoomId;

        socket.to(callRoomId).emit("participantLeft", {
          userId: socket.data.groupCallUserId,
        });

        const remainingRoom = io.sockets.adapter.rooms.get(callRoomId);
        const remainingCount = remainingRoom ? remainingRoom.size : 0;

        if (remainingCount <= 1) {
          io.to(callRoomId).emit("groupCallEnded", {
            endedBy: socket.data.groupCallUserId,
          });
          io.of("/").in(callRoomId).socketsLeave(callRoomId);
        }
      }

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
