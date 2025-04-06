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
    if (!roomId) {
        alert("Enter a Room ID!");
        return;
    }

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });

        localVideo.srcObject = localStream;
        localVideo.setAttribute("playsinline", "true");
        localVideo.setAttribute("autoplay", "true");
        localVideo.play().catch(err => logError('Local Video', err));

        socket.emit("join-room", roomId);
    } catch (error) {
        logError('Media Access', error);
        alert('Failed to access camera/microphone');
        return;
    }

    socket.on("user-joined", (peerId) => {
        console.log('User joined, creating initiator peer');
        createPeerConnection(true);
    });

    socket.on("signal", (data) => {
        console.log('Received signal:', data);
        if (!peer) {
            createPeerConnection(false);
        }

        try {
            peer.signal(data.signal);
        } catch (error) {
            logError('Signal Processing', error);
        }
    });

    socket.on("room-full", () => {
        alert("Room is full! Only 2 users allowed.");
    });

    socket.on("chat-message", (data) => {
        const messageElement = document.createElement("div");
        messageElement.classList.add("message");
        messageElement.innerHTML = `<strong>${data.sender}</strong>: ${data.message} <span class="time">${new Date(data.timestamp).toLocaleTimeString()}</span>`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    socket.on("user-disconnected", () => {
        resetPeerConnection();
        remoteVideo.srcObject = null;
    });
}
