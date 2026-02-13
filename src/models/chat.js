const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
    },
    imageUrl: {
      type: String,
    },
  },
  { timestamps: true }
);

const chatSchema = new mongoose.Schema({
  participants: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  ],
  messages: [messageSchema],
  isGroupChat: {
    type: Boolean,
    default: false,
  },
  groupName: {
    type: String,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  admins: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  ],
  groupIcon: {
    type: String,
    default: "https://via.placeholder.com/50?text=Group",
  },
}, { timestamps: true });

const Chat = mongoose.model("Chat", chatSchema);

module.exports = { Chat };
