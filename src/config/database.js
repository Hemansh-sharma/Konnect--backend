const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    console.log("Attempting to connect to database...");
    await mongoose.connect(process.env.DB_CONNECTION_SECRET, {
      retryWrites: true,
      w: "majority",
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
      authSource: "admin",
    });
    console.log("✓ Database connected successfully");
  } catch (err) {
    console.error("✗ Database connection failed!!");
    console.error("Error details:", err.message);
    
    if (err.message.includes("ENOTFOUND")) {
      console.error("→ DNS resolution failed. Check your connection string.");
    } else if (err.message.includes("authentication failed")) {
      console.error("→ Authentication failed. Check your username/password.");
    } else if (err.message.includes("getaddrinfo ECONNREFUSED")) {
      console.error("→ Connection refused. Check IP whitelist in Atlas.");
    } else if (err.message.includes("TIMEOUT")) {
      console.error("→ Connection timeout. Check IP whitelist or network.");
    }
    
    process.exit(1);
  }
};

module.exports = connectDB;
