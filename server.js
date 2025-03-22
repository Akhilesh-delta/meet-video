const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const app = express();

// ✅ Allow CORS for all origins
const allowedOrigins = ["https://meet-video-2.onrender.com", "http://localhost:3000"];
app.use(cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    }
});

app.use(express.static("public"));

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId) => {
        socket.join(roomId);
        const users = io.sockets.adapter.rooms.get(roomId);

        if (users.size > 2) {
            socket.emit("room-full");
            socket.leave(roomId);
            return;
        }

        socket.to(roomId).emit("user-joined", socket.id);

        socket.on("screen-share", (data) => {
            socket.to(roomId).emit("screen-share", data);
        });

        socket.on("signal", (data) => {
            io.to(data.target).emit("signal", { sender: socket.id, signal: data.signal });
        });

        socket.on("disconnect", () => {
            socket.to(roomId).emit("user-disconnected", socket.id);
            console.log(`${socket.id} left room ${roomId}`);
        });
    });
});

server.listen(3000, () => console.log("Server running on 3000"));

