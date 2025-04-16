const socket = io("https://meet-video-2.onrender.com", {
    transports: ["websocket", "polling"],
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
let remotePeerId = null; // Track the other user's socket ID

function logError(context, error) {
    console.error(`[${context}] Error:`, error);
}

function resetPeerConnection() {
    if (peer) {
        try { peer.destroy(); } catch (error) { logError('Peer Destroy', error); }
        peer = null;
    }
    remoteVideo.srcObject = null;
}

function createPeer(initiator, targetPeerId) {
    resetPeerConnection();
    peer = new SimplePeer({
        initiator,
        trickle: false,
        stream: localStream,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        }
    });

    peer.on('signal', data => {
        if (targetPeerId) {
            socket.emit('signal', { target: targetPeerId, signal: data });
        }
    });

    peer.on('stream', remoteStream => {
        remoteVideo.srcObject = remoteStream;
        remoteVideo.setAttribute('playsinline', 'true');
        remoteVideo.setAttribute('autoplay', 'true');
        remoteVideo.play().catch(err => logError('Video Play', err));
    });

    peer.on('error', err => {
        logError('Peer Connection', err);
        alert('WebRTC connection error. Please try again.');
        resetPeerConnection();
    });
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

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        localVideo.setAttribute("playsinline", "true");
        localVideo.setAttribute("autoplay", "true");
    } catch (error) {
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

    socket.emit("join-room", roomId);
}

// --- Socket Event Handlers ---
socket.on("user-joined", (peerId) => {
    if (!peer) {
        remotePeerId = peerId;
        createPeer(true, peerId); // You are the initiator
    }
});

socket.on("signal", (data) => {
    if (!peer) {
        remotePeerId = data.sender;
        createPeer(false, data.sender); // You are the responder
    }
    if (peer) {
        peer.signal(data.signal);
    }
});

socket.on("room-full", () => {
    alert("Room is full! Only 2 users allowed.");
});

socket.on("user-disconnected", () => {
    resetPeerConnection();
});

socket.on("chat-message", (data) => {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");
    messageElement.innerHTML = `<strong>${data.sender}</strong>: ${data.message} <span class="time">${new Date(data.timestamp).toLocaleTimeString()}</span>`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Optionally, expose joinRoom to a button
window.joinRoom = joinRoom;
