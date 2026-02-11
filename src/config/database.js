const mongoose = require("mongoose");
const dns = require("dns");

dns.setDefaultResultOrder("ipv4first");

const connectDB = async () => {
  try {
    console.log(process.env.DB_CONNECTION_SECRET);
    await mongoose.connect(process.env.DB_CONNECTION_SECRET);
    console.log("Database connected successfully");
  } catch (err) {
    console.error("Database cannot be connected!!", err);
    process.exit(1);
  }
};

module.exports = connectDB;
