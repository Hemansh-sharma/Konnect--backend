const express = require("express");
const requestRouter = express.Router();

const { userAuth } = require("../middlewares/auth");
const ConnectionRequest = require("../models/connectionRequest");
const User = require("../models/user");

const sendEmail = require("../utils/sendEmail");

requestRouter.post(
  "/request/send/:status/:toUserId",
  userAuth,
  async (req, res) => {
    try {
      const fromUserId = req.user._id;
      const toUserId = req.params.toUserId;
      const status = req.params.status;

      const allowedStatus = ["ignored", "interested"];
      if (!allowedStatus.includes(status)) {
        return res
          .status(400)
          .json({ message: "Invalid status type: " + status });
      }

      const toUser = await User.findById(toUserId);
      if (!toUser) {
        return res.status(404).json({ message: "User not found!" });
      }

      const existingConnectionRequest = await ConnectionRequest.findOne({
        $or: [
          { fromUserId, toUserId },
          { fromUserId: toUserId, toUserId: fromUserId },
        ],
      });
      if (existingConnectionRequest) {
        return res
          .status(400)
          .send({ message: "Connection Request Already Exists!!" });
      }

      const connectionRequest = new ConnectionRequest({
        fromUserId,
        toUserId,
        status,
      });

      const data = await connectionRequest.save();

      // Send email notification when connection request is sent with "interested" status
      if (status === "interested") {
        try {
          await sendEmail.run(
            "New Connection Request from " + req.user.firstName,
            `Hello ${toUser.firstName},\n\n${req.user.firstName} has sent you a connection request on Konnect. Please login to your account to accept or reject this request.\n\nBest regards,\nKonnect Team`
          , toUser.emailId);
          console.log("Connection request notification email sent to", toUser.emailId);
        } catch (err) {
          console.log("Error sending email:", err);
        }
      }

      res.json({
        message:
          req.user.firstName + " is " + status + " in " + toUser.firstName,
        data,
      });
    } catch (err) {
      res.status(400).send("ERROR: " + err.message);
    }
  }
);

requestRouter.post(
  "/request/review/:status/:requestId",
  userAuth,
  async (req, res) => {
    try {
      const loggedInUser = req.user;
      const { status, requestId } = req.params;

      const allowedStatus = ["accepted", "rejected"];
      if (!allowedStatus.includes(status)) {
        return res.status(400).json({ messaage: "Status not allowed!" });
      }

      const connectionRequest = await ConnectionRequest.findOne({
        _id: requestId,
        toUserId: loggedInUser._id,
        status: "interested",
      });
      if (!connectionRequest) {
        return res
          .status(404)
          .json({ message: "Connection request not found" });
      }

      connectionRequest.status = status;

      const data = await connectionRequest.save();

      // Send email notification when connection request is accepted
      if (status === "accepted") {
        try {
          const fromUser = await User.findById(connectionRequest.fromUserId);
          if (fromUser) {
            await sendEmail.run(
              loggedInUser.firstName + " has accepted your connection request!",
              `Hello ${fromUser.firstName},\n\nGreat news! ${loggedInUser.firstName} has accepted your connection request on Konnect. You can now start chatting and building your professional network.\n\nBest regards,\nKonnect Team`,
              fromUser.emailId
            );
            console.log("Connection request acceptance notification email sent to", fromUser.emailId);
          }
        } catch (err) {
          console.log("Error sending acceptance email:", err);
        }
      }

      res.json({ message: "Connection request " + status, data });
    } catch (err) {
      res.status(400).send("ERROR: " + err.message);
    }
  }
);

module.exports = requestRouter;
