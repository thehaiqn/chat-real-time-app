import { Server } from "socket.io";
import http from "http";
import express from "express";
import User from "../models/User.js";
import Chat from "../models/Chat.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST"],
  },
});

const userSocketMap = {}; // {userId: Set(socketId)}

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId && userId !== "undefined") {
    if (!userSocketMap[userId]) {
      userSocketMap[userId] = new Set();
    }
    userSocketMap[userId].add(socket.id);
    console.log(
      `User ${userId} socket connected. Total sockets: ${userSocketMap[userId].size}`,
    );
    socket.join(userId);
  }

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.emit("connected");
  });

  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("User Joined Room: " + room);
  });

  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stopTyping", (room) => socket.in(room).emit("stopTyping"));

  socket.on("update-group-name", ({ chatId, newName }) => {
    socket.in(chatId).emit("group-name-updated", { chatId, newName });
  });

  socket.on("call-user", (data) => {
    if (userSocketMap[data.userToCall]) {
      Array.from(userSocketMap[data.userToCall]).forEach((socketId) => {
        io.to(socketId).emit("call-received", {
          signal: data.signalData,
          from: data.from,
          name: data.name,
          type: data.type,
        });
      });
    }
  });

  socket.on("answer-call", (data) => {
    if (userSocketMap[data.to]) {
      Array.from(userSocketMap[data.to]).forEach((socketId) =>
        io.to(socketId).emit("call-accepted", data.signal),
      );
    }
  });

  socket.on("end-call", (data) => {
    if (userSocketMap[data.to]) {
      Array.from(userSocketMap[data.to]).forEach((socketId) =>
        io.to(socketId).emit("call-ended"),
      );
    }
  });

  socket.on("ice-candidate", (data) => {
    if (userSocketMap[data.to]) {
      Array.from(userSocketMap[data.to]).forEach((socketId) =>
        io.to(socketId).emit("ice-candidate", data.candidate),
      );
    }
  });

  // --- Group Call Signaling ---

  socket.on("start-group-call", async (data) => {
    try {
      const chat = await Chat.findById(data.chatId);
      if (chat) {
        chat.participants.forEach((participantId) => {
          const pIdStr = participantId.toString();
          if (pIdStr !== data.from && userSocketMap[pIdStr]) {
            Array.from(userSocketMap[pIdStr]).forEach((socketId) => {
              io.to(socketId).emit("group-call-started", {
                chatId: data.chatId,
                type: data.type,
                from: data.from,
                name: data.name,
              });
            });
          }
        });
      }
    } catch (err) {
      console.error(err);
    }
  });

  socket.on("join-group-call", (data) => {
    socket.in(data.chatId).emit("user-joined-group-call", {
      chatId: data.chatId,
      from: data.from,
      name: data.name,
    });
  });

  socket.on("group-offer", (data) => {
    if (userSocketMap[data.to]) {
      Array.from(userSocketMap[data.to]).forEach((socketId) => {
        io.to(socketId).emit("group-offer-received", {
          from: data.from,
          signal: data.signal,
          type: data.type,
          name: data.name,
          chatId: data.chatId,
        });
      });
    }
  });

  socket.on("group-answer", (data) => {
    if (userSocketMap[data.to]) {
      Array.from(userSocketMap[data.to]).forEach((socketId) => {
        io.to(socketId).emit("group-answer-received", {
          from: data.from,
          signal: data.signal,
        });
      });
    }
  });

  socket.on("group-ice-candidate", (data) => {
    if (userSocketMap[data.to]) {
      Array.from(userSocketMap[data.to]).forEach((socketId) => {
        io.to(socketId).emit("group-ice-candidate-received", {
          from: data.from,
          candidate: data.candidate,
        });
      });
    }
  });

  socket.on("leave-group-call", async (data) => {
    try {
      const chat = await Chat.findById(data.chatId);
      if (chat) {
        chat.participants.forEach((participantId) => {
          const pIdStr = participantId.toString();
          if (pIdStr !== data.from && userSocketMap[pIdStr]) {
            Array.from(userSocketMap[pIdStr]).forEach((socketId) => {
              io.to(socketId).emit("user-left-group-call", {
                chatId: data.chatId,
                from: data.from,
              });
            });
          }
        });
      }
    } catch (err) {
      console.error(err);
    }
  });

  socket.on("disconnect", async () => {
    console.log("user disconnected", socket.id);

    if (userId && userId !== "undefined" && userSocketMap[userId]) {
      userSocketMap[userId].delete(socket.id);
      console.log(
        `User ${userId} socket disconnected. Remaining sockets: ${userSocketMap[userId].size}`,
      );
      if (userSocketMap[userId].size === 0) {
        console.log(`User ${userId} is now entirely offline.`);
        delete userSocketMap[userId];
        try {
          await User.findByIdAndUpdate(userId, { lastActive: Date.now() });
        } catch (error) {
          console.error("Error updating lastActive on disconnect:", error);
        }
      }
    }

    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { app, io, server };
