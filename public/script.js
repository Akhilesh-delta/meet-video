const socket = io("https://meet-video-2.onrender.com", {
    transports: ["websocket", "polling"],  // ✅ Fix for Render deployment issues
    withCredentials: true
});

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const chatInput = document.getElementById("chatInput");
const chatButton = document.getElementById("chatButton");
const chatMessages = document.getElementById("chatMessages");

let localStream;
let peer = null;
let roomId;

// Improved error logging function
function logError(context, error) {
    console.error(`[${context}] Error:`, error);
    // Optional: Send error to server or analytics
}

// Function to reset peer connection
function resetPeerConnection() {
    if (peer) {
        try {
            peer.destroy();
        } catch (error) {
            logError('Peer Destroy', error);
        }
        peer = null;
    }
}

// Function to create a new peer connection
function createPeerConnection(initiator) {
    resetPeerConnection();

    try {
        peer = new SimplePeer({
            initiator: initiator,
            trickle: false,
            stream: localStream,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });

        peer.on('error', (err) => {
            logError('Peer Connection', err);
            alert('WebRTC connection error. Please try again.');
            resetPeerConnection();
        });

        peer.on('signal', (data) => {
            socket.emit('signal', { 
                target: initiator ? 'remote' : socket.id, 
                signal: data 
            });
        });

        peer.on('stream', (remoteStream) => {
            console.log('Remote stream received');
            remoteVideo.srcObject = remoteStream;
            remoteVideo.setAttribute('playsinline', 'true');
            remoteVideo.setAttribute('autoplay', 'true');
            remoteVideo.play().catch(err => logError('Video Play', err));
        });

        return peer;
    } catch (error) {
        logError('Create Peer', error);
        alert('Failed to create WebRTC connection');
        return null;
    }
}

function sendMessage() {
    if (!roomId) {
        alert("Please join a room first.");
        return;
    }

    const message = chatInput.value.trim();
    if (!message) return;

    try {
        socket.emit("chat-message", { roomId, message });
        chatInput.value = "";
    } catch (error) {
        logError('Send Message', error);
        alert("Failed to send message.");
    }
}

chatButton.addEventListener("click", sendMessage);
chatInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") sendMessage();
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

    // ✅ Ensure Mobile & Firefox Compatibility
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

        // ✅ Fix: Ensure correct SDP signaling
        if (peer) {
            peer.signal(data.signal);
        }
    });

    socket.on("room-full", () => {
        alert("Room is full! Only 2 users allowed.");
    });

        // ✅ Send message when button is clicked
    chatButton.addEventListener("click", () => {
        sendMessage();
    });

    // ✅ Send message when "Enter" key is pressed
    chatInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            sendMessage();
        }
    });

    // ✅ Function to send message
    function sendMessage() {
        const message = chatInput.value.trim();
        if (message) {
            socket.emit("chat-message", { roomId, message });
            chatInput.value = "";
        }
    }

    // ✅ Listen for incoming chat messages
    socket.on("chat-message", (data) => {
        const messageElement = document.createElement("div");
        messageElement.classList.add("message");
        messageElement.innerHTML = `<strong>${data.sender}</strong>: ${data.message} <span class="time">${new Date(data.timestamp).toLocaleTimeString()}</span>`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll to the latest message
    });

    socket.on("user-disconnected", () => {
        resetPeerConnection();
        remoteVideo.srcObject = null;
    });
}
// function leaveRoom() {
//     if (peer) {
//         peer.destroy();
//         peer = null;
//         remoteVideo.srcObject = null;
//     }

//     if (localStream) {
//         localStream.getTracks().forEach((track) => track.stop());
//         localVideo.srcObject = null;
//     }

//     socket.emit("disconnect");
// }

