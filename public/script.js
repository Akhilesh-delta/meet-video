const socket = io("https://meet-video-2.onrender.com", {
    transports: ["websocket", "polling"],  // ✅ Fix for Render deployment issues
    withCredentials: true
});

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let localStream;
let peer;
let roomId;

async function joinRoom() {
    roomId = document.getElementById("roomIdInput").value.trim();
    if (!roomId) return alert("Enter a Room ID!");

    socket.emit("join-room", roomId);
      
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

    // ✅ Ensure Mobile & Firefox Compatibility
    localVideo.srcObject = localStream;
    localVideo.setAttribute("playsinline", "true");
    localVideo.setAttribute("autoplay", "true");

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

    socket.on("user-disconnected", () => {
        if (peer) {
            peer.destroy();
            peer = null;
            remoteVideo.srcObject = null;
        }
    });
}

function leaveRoom() {
    if (peer) {
        peer.destroy();
        peer = null;
        remoteVideo.srcObject = null;
    }

    if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        localVideo.srcObject = null;
    }

    socket.emit("disconnect");
}
