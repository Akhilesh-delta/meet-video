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
    },
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: true
    }
});

app.use(express.static("public"));

// Track room occupancy
const roomOccupancy = new Map();

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId) => {
        // Validate room ID
        if (!roomId || typeof roomId !== 'string') {
            socket.emit("error", "Invalid room ID");
            return;
        }

        // Join the room
        socket.join(roomId);

        // Update room occupancy
        const currentOccupancy = roomOccupancy.get(roomId) || 0;
        roomOccupancy.set(roomId, currentOccupancy + 1);

        // Check room capacity
        if (currentOccupancy >= 2) {
            socket.emit("room-full");
            socket.leave(roomId);
            return;
        }

        // Notify other users in the room
        socket.to(roomId).emit("user-joined", socket.id);

        // Screen sharing
        socket.on("screen-share", (data) => {
            socket.to(roomId).emit("screen-share", { 
                sender: socket.id, 
                ...data 
            });
        });

        // WebRTC Signaling
        socket.on("signal", (data) => {
            try {
                if (!data || !data.target || !data.signal) {
                    throw new Error("Invalid signal data");
                }
                io.to(data.target).emit("signal", { 
                    sender: socket.id, 
                    signal: data.signal 
                });
            } catch (error) {
                console.error("Signal transmission error:", error);
                socket.emit("signal-error", error.message);
            }
        });

        // Chat Messages
        socket.on("chat-message", (messageData) => {
            try {
                if (!messageData || !messageData.message) {
                    throw new Error("Invalid message data");
                }
                
                io.to(roomId).emit("chat-message", { 
                    sender: socket.id, 
                    message: messageData.message, 
                    timestamp: new Date().toISOString() 
                });
            } catch (error) {
                console.error("Chat message error:", error);
                socket.emit("chat-error", error.message);
            }
        });

        // Typing Indicators
        socket.on("typing", () => {
            socket.to(roomId).emit("typing", socket.id);
        });

        socket.on("stop-typing", () => {
            socket.to(roomId).emit("stop-typing", socket.id);
        });

        // Disconnect Handling
        socket.on("disconnect", () => {
            // Decrement room occupancy
            const currentOccupancy = roomOccupancy.get(roomId) || 0;
            roomOccupancy.set(roomId, Math.max(0, currentOccupancy - 1));

            // Notify room members
            socket.to(roomId).emit("user-disconnected", socket.id);
            console.log(`${socket.id} left room ${roomId}`);

            // Clean up empty rooms
            if (currentOccupancy <= 0) {
                roomOccupancy.delete(roomId);
            }
        });
    });

    // Global error handling
    socket.on("connect_error", (error) => {
        console.error("Connection error:", error);
    });
});

server.listen(3000, () => {
    console.log("Server running on 3000");
    console.log("Allowed origins:", allowedOrigins);
});
