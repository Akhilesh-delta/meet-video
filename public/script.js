const socket = io("https://meet-video-2.onrender.com", {
    transports: ["websocket", "polling"],  
    withCredentials: false  
});

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const chatInput = document.getElementById("chatInput");
const chatButton = document.getElementById("chatButton");
const chatMessages = document.getElementById("chatMessages");

let localStream;
let peer;
let roomId;

async function joinRoom() {
    roomId = document.getElementById("roomIdInput").value.trim();
    if (!roomId) return alert("Enter a Room ID!");

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });

        localVideo.srcObject = localStream;
        localVideo.setAttribute("playsinline", "true");
        localVideo.setAttribute("autoplay", "true");

        socket.emit("join-room", roomId);

        socket.on("user-joined", (peerId) => {
            createPeerConnection(true, peerId);
        });

        socket.on("signal", (data) => {
            if (peer) {
                peer.signal(data.signal);
            } else {
                createPeerConnection(false, data.sender);
                peer.signal(data.signal);
            }
        });

    } catch (error) {
        handleMediaError(error);
    }
}

function createPeerConnection(isInitiator, targetId) {
    peer = new SimplePeer({
        initiator: isInitiator,
        trickle: false,
        stream: localStream
    });

    peer.on("signal", (data) => {
        socket.emit("signal", { target: targetId, signal: data });
    });

    peer.on("stream", (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
        remoteVideo.setAttribute("playsinline", "true");
        remoteVideo.setAttribute("autoplay", "true");
    });

    peer.on("error", (err) => {
        console.error("WebRTC Connection Error:", err);
        alert("WebRTC connection failed. Please try again.");
    });
}

function handleMediaError(error) {
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        alert('Camera or microphone not found. Please check your device connections.');
    } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('Permission to use camera and microphone was denied. Please allow access to use this app.');
    } else {
        alert(`Error accessing media devices: ${error.message}`);
    }
    console.error('Media access error:', error);
}

    socket.on("room-full", () => {
        alert("Room is full! Only 2 users allowed.");
    });

        chatButton.addEventListener("click", () => {
        sendMessage();
    });

    chatInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            sendMessage();
        }
    });

    function sendMessage() {
        const message = chatInput.value.trim();
        if (message) {
            socket.emit("chat-message", { roomId, message });
            chatInput.value = "";
        }
    }

    socket.on("chat-message", (data) => {
        const messageElement = document.createElement("div");
        messageElement.classList.add("message");
        messageElement.innerHTML = `<strong>${data.sender}</strong>: ${data.message} <span class="time">${new Date(data.timestamp).toLocaleTimeString()}</span>`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight; 
    });


    socket.on("user-disconnected", () => {
        if (peer) {
            peer.destroy();
            peer = null;
            remoteVideo.srcObject = null;
        }
    });
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
