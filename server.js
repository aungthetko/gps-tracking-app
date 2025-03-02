import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Create HTTP Server for Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

const locationSchema = new mongoose.Schema({
  lat: Number,
  lng: Number,
  timeStamp: { type : Date, default : Date.now }
});
const Location = mongoose.model("Location", locationSchema);

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("locationUpdate", async (data) => {
    console.log("Received location:", data);
    await Location.create(data);
    io.emit("newLocation", data);
  });

  socket.on("getPreviousPath", async (callback) => {
    const locations = await Location.find().sort({ timestamp: 1 }).limit(50);
    callback(locations);
  })

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Sample route
app.get("/", (req, res) => {
  res.send("GPS Tracking API is running...");
});

// Start Server with Socket.IO
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});