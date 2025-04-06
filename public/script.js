const socket = io("https://meet-video-2.onrender.com", {
    transports: ["websocket", "polling"],  // Fix for Render deployment issues
    withCredentials: true
});

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const chatInput = document.getElementById("chatInput");
const chatButton = document.getElementById("chatButton");
const chatMessages = document.getElementById("chatMessages");

let localStream;
let peer;
let roomId;

// Function to send message - moved outside joinRoom
function sendMessage() {
    if (!roomId) {
        console.error("Room ID not set. Please join a room first.");
        alert("Please join a room before sending a message.");
        return;
    }

    const message = chatInput.value.trim();
    if (!message) {
        console.warn("Attempted to send empty message");
        return;
    }

    try {
        socket.emit("chat-message", { roomId, message }, (error) => {
            if (error) {
                console.error("Message sending error:", error);
                alert("Failed to send message. Please try again.");
            }
        });
        chatInput.value = "";
    } catch (error) {
        console.error("Unexpected error in sendMessage:", error);
        alert("An unexpected error occurred while sending the message.");
    }
}

// Add event listeners outside of joinRoom
chatButton.addEventListener("click", sendMessage);
chatInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
        sendMessage();
    }
});

async function joinRoom() {
    roomId = document.getElementById("roomIdInput").value.trim();
    if (!roomId) return alert("Enter a Room ID!");

    socket.emit("join-room", roomId);

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });

    // Ensure Mobile & Firefox Compatibility
    localVideo.srcObject = localStream;
    localVideo.setAttribute("playsinline", "true");
    localVideo.setAttribute("autoplay", "true");
} catch (error) {
    // Handle specific error types
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        alert('Camera or microphone not found. Please check your device connections.');
    } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('Permission to use camera and microphone was denied. Please allow access to use this app.');
    } else {
        alert(`Error accessing media devices: ${error.message}`);
    }
    console.error('Media access error:', error);
    return;
}
    socket.on("user-joined", (peerId) => {
        if (!peer) {
            peer = new SimplePeer({
                initiator: true,
                trickle: false,
                stream: localStream,
            });

            peer.on("signal", (data) => {
                socket.emit("signal", { target: peerId, signal: data });
            });

            peer.on("stream", (remoteStream) => {
                remoteVideo.srcObject = remoteStream;
                remoteVideo.setAttribute("playsinline", "true");
                remoteVideo.setAttribute("autoplay", "true");
            });
        }
    });

    socket.on("signal", (data) => {
        if (!peer) {
            peer = new SimplePeer({
                initiator: false,
                trickle: false,
                stream: localStream,
            });

            peer.on("signal", (signalData) => {
                socket.emit("signal", { target: data.sender, signal: signalData });
            });

            peer.on("stream", (remoteStream) => {
                remoteVideo.srcObject = remoteStream;
                remoteVideo.setAttribute("playsinline", "true");
                remoteVideo.setAttribute("autoplay", "true");
            });
        }

        // Fix: Ensure correct SDP signaling
        if (peer) {
            peer.signal(data.signal);
        }
    });

    socket.on("room-full", () => {
        alert("Room is full! Only 2 users allowed.");
    });

    // Listen for incoming chat messages
    socket.on("chat-message", (data) => {
        const messageElement = document.createElement("div");
        messageElement.classList.add("message");
        messageElement.innerHTML = `<strong>${data.sender}</strong>: ${data.message} <span class="time">${new Date(data.timestamp).toLocaleTimeString()}</span>`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll to the latest message
    });

    socket.on("user-disconnected", () => {
        if (peer) {
            peer.destroy();
            peer = null;
            remoteVideo.srcObject = null;
        }
    });
}
