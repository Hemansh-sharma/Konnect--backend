const express = require("express");
const { userAuth } = require("../middlewares/auth");
const upload = require("../middlewares/multer");
const { Chat } = require("../models/chat");
const path = require("path");

const chatRouter = express.Router();

// Get individual chat with a user
chatRouter.get("/chat/:targetUserId", userAuth, async (req, res) => {
  const { targetUserId } = req.params;
  const userId = req.user._id;

  try {
    let chat = await Chat.findOne({
      participants: { $all: [userId, targetUserId] },
      isGroupChat: false,
    }).populate({
      path: "messages.senderId",
      select: "firstName lastName",
    });
    if (!chat) {
      chat = new Chat({
        participants: [userId, targetUserId],
        messages: [],
        isGroupChat: false,
      });
      await chat.save();
    }
    res.json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch chat" });
  }
});

// Get group chat by ID
chatRouter.get("/group-chat/:groupChatId", userAuth, async (req, res) => {
  const { groupChatId } = req.params;
  const userId = req.user._id;

  try {
    const chat = await Chat.findById(groupChatId).populate({
      path: "messages.senderId",
      select: "firstName lastName",
    }).populate({
      path: "participants",
      select: "firstName lastName photoUrl",
    }).populate({
      path: "admins",
      select: "firstName lastName",
    }).populate({
      path: "createdBy",
      select: "firstName lastName",
    });

    if (!chat) {
      return res.status(404).json({ error: "Group chat not found" });
    }

    // Check if user is a participant
    if (!chat.participants.some(p => p._id.toString() === userId.toString())) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    res.json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch group chat" });
  }
});

// Create a new group chat
chatRouter.post("/group-chat", userAuth, async (req, res) => {
  const { groupName, participantIds } = req.body;
  const userId = req.user._id;

  try {
    if (!groupName || !participantIds || participantIds.length === 0) {
      return res.status(400).json({ error: "Group name and participants are required" });
    }

    // Add the creator to participants if not already included
    const allParticipants = [...new Set([userId.toString(), ...participantIds])];

    const chat = new Chat({
      groupName,
      participants: allParticipants,
      isGroupChat: true,
      createdBy: userId,
      admins: [userId],
      messages: [],
    });

    await chat.save();
    await chat.populate([
      {
        path: "participants",
        select: "firstName lastName photoUrl",
      },
      {
        path: "admins",
        select: "firstName lastName",
      },
    ]);

    res.json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create group chat" });
  }
});

// Get all group chats for the user
chatRouter.get("/my-group-chats", userAuth, async (req, res) => {
  const userId = req.user._id;

  try {
    const chats = await Chat.find({
      participants: userId,
      isGroupChat: true,
    })
      .populate({
        path: "participants",
        select: "firstName lastName photoUrl",
      })
      .populate({
        path: "createdBy",
        select: "firstName lastName",
      })
      .sort({ updatedAt: -1 });

    res.json(chats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch group chats" });
  }
});

// Upload image endpoint
chatRouter.post("/chat/upload", userAuth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image provided" });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Image upload failed" });
  }
});

// Update group icon
chatRouter.post("/group-chat/:groupChatId/icon", userAuth, upload.single("icon"), async (req, res) => {
  const { groupChatId } = req.params;
  const userId = req.user._id;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image provided" });
    }

    const chat = await Chat.findById(groupChatId);

    if (!chat) {
      return res.status(404).json({ error: "Group chat not found" });
    }

    // Check if user is a participant
    if (!chat.participants.some(p => p.toString() === userId.toString())) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const iconUrl = `/uploads/${req.file.filename}`;
    chat.groupIcon = iconUrl;
    await chat.save();

    res.json({ groupIcon: iconUrl, message: "Group icon updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update group icon" });
  }
});

// Make a member an admin
chatRouter.post("/group-chat/:groupChatId/make-admin/:memberId", userAuth, async (req, res) => {
  const { groupChatId, memberId } = req.params;
  const userId = req.user._id;

  try {
    const chat = await Chat.findById(groupChatId).populate("admins");

    if (!chat) {
      return res.status(404).json({ error: "Group chat not found" });
    }

    // Check if user is an admin
    const isAdmin = chat.admins.some(admin => admin._id.toString() === userId.toString());
    if (!isAdmin) {
      return res.status(403).json({ error: "Only admins can make other members admins" });
    }

    // Check if member exists in the group
    const isMember = chat.participants.some(p => p.toString() === memberId);
    if (!isMember) {
      return res.status(400).json({ error: "User is not a member of this group" });
    }

    // Check if already an admin
    const alreadyAdmin = chat.admins.some(admin => admin._id.toString() === memberId);
    if (alreadyAdmin) {
      return res.status(400).json({ error: "User is already an admin" });
    }

    // Add member to admins
    chat.admins.push(memberId);
    await chat.save();
    await chat.populate([
      { path: "participants", select: "firstName lastName photoUrl" },
      { path: "admins", select: "firstName lastName" },
      { path: "createdBy", select: "firstName lastName" }
    ]);

    res.json({ message: "Member promoted to admin", chat });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to make member admin" });
  }
});

// Remove a member from the group
chatRouter.post("/group-chat/:groupChatId/remove-member/:memberId", userAuth, async (req, res) => {
  const { groupChatId, memberId } = req.params;
  const userId = req.user._id;

  try {
    const chat = await Chat.findById(groupChatId).populate("admins");

    if (!chat) {
      return res.status(404).json({ error: "Group chat not found" });
    }

    // Check if user is an admin
    const isAdmin = chat.admins.some(admin => admin._id.toString() === userId.toString());
    if (!isAdmin) {
      return res.status(403).json({ error: "Only admins can remove members" });
    }

    // Check if member exists in the group
    const isMember = chat.participants.some(p => p.toString() === memberId);
    if (!isMember) {
      return res.status(400).json({ error: "User is not a member of this group" });
    }

    // Cannot remove the creator
    if (chat.createdBy.toString() === memberId) {
      return res.status(400).json({ error: "Cannot remove the group creator" });
    }

    // Remove member from participants
    chat.participants = chat.participants.filter(p => p.toString() !== memberId);
    
    // Remove from admins if they are an admin
    chat.admins = chat.admins.filter(a => a._id.toString() !== memberId && a.toString() !== memberId);
    
    await chat.save();
    await chat.populate([
      { path: "participants", select: "firstName lastName photoUrl" },
      { path: "admins", select: "firstName lastName" },
      { path: "createdBy", select: "firstName lastName" }
    ]);

    res.json({ message: "Member removed from group", chat });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove member" });
  }
});

// Add a member to the group
chatRouter.post("/group-chat/:groupChatId/add-member/:memberId", userAuth, async (req, res) => {
  const { groupChatId, memberId } = req.params;
  const userId = req.user._id;

  try {
    const chat = await Chat.findById(groupChatId).populate("admins");

    if (!chat) {
      return res.status(404).json({ error: "Group chat not found" });
    }

    // Check if user is an admin
    const isAdmin = chat.admins.some(admin => admin._id.toString() === userId.toString());
    if (!isAdmin) {
      return res.status(403).json({ error: "Only admins can add members" });
    }

    // Check if already a member
    const alreadyMember = chat.participants.some(p => p.toString() === memberId);
    if (alreadyMember) {
      return res.status(400).json({ error: "User is already a member of this group" });
    }

    // Add member to participants
    chat.participants.push(memberId);
    await chat.save();
    await chat.populate([
      { path: "participants", select: "firstName lastName photoUrl" },
      { path: "admins", select: "firstName lastName" },
      { path: "createdBy", select: "firstName lastName" }
    ]);

    res.json({ message: "Member added to group", chat });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add member" });
  }
});

// Remove admin status from a member
chatRouter.post("/group-chat/:groupChatId/remove-admin/:memberId", userAuth, async (req, res) => {
  const { groupChatId, memberId } = req.params;
  const userId = req.user._id;

  try {
    const chat = await Chat.findById(groupChatId).populate("admins");

    if (!chat) {
      return res.status(404).json({ error: "Group chat not found" });
    }

    // Check if user is an admin
    const isAdmin = chat.admins.some(admin => admin._id.toString() === userId.toString());
    if (!isAdmin) {
      return res.status(403).json({ error: "Only admins can dismiss other admins" });
    }

    // Check if member is an admin
    const memberIsAdmin = chat.admins.some(admin => admin._id.toString() === memberId);
    if (!memberIsAdmin) {
      return res.status(400).json({ error: "User is not an admin" });
    }

    // Cannot remove the creator's admin status
    if (chat.createdBy.toString() === memberId) {
      return res.status(400).json({ error: "Cannot remove admin status from the group creator" });
    }

    // Remove member from admins
    chat.admins = chat.admins.filter(a => a._id.toString() !== memberId && a.toString() !== memberId);
    
    await chat.save();
    await chat.populate([
      { path: "participants", select: "firstName lastName photoUrl" },
      { path: "admins", select: "firstName lastName" },
      { path: "createdBy", select: "firstName lastName" }
    ]);

    res.json({ message: "Admin status removed from member", chat });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove admin status" });
  }
});

module.exports = chatRouter;
