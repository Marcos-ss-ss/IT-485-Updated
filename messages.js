const socket = io();

const sender_id = Number(localStorage.getItem("user_id"));

if (!sender_id) {
    alert("You must log in first!");
    window.location.href = "login.html";
}

// Get receiver from URL
const urlParams = new URLSearchParams(window.location.search);
const receiver_id = Number(urlParams.get("receiver_id"));

const room = sender_id < receiver_id
    ? `room_${sender_id}_${receiver_id}`
    : `room_${receiver_id}_${sender_id}`;

socket.emit("joinRoom", room);

// Load previous messages
fetch(`/getMessages?sender_id=${sender_id}&receiver_id=${receiver_id}`)
    .then(res => res.json())
    .then(messages => {
        const box = document.getElementById("messages-box");

        messages.forEach(msg => {
            const p = document.createElement("p");
            const isMe = msg.sender_id == sender_id;

            p.classList.add(isMe ? "me" : "other");
            p.innerHTML = `<strong>${isMe ? "You" : "Other"}:</strong> ${msg.message}`;

            box.appendChild(p);
        });

        box.scrollTop = box.scrollHeight;
    });

// Send message
function sendMessage() {
    const input = document.getElementById("message-input");
    const message = input.value.trim();
    if (!message) return;

    socket.emit("sendMessage", {
        sender_id,
        receiver_id,
        message,
        room
    });

    input.value = "";
}

// Receive message
socket.on("receiveMessage", (data) => {
    const box = document.getElementById("messages-box");
    const p = document.createElement("p");

    const isMe = data.sender_id == sender_id;
    p.classList.add(isMe ? "me" : "other");

    p.innerHTML = `<strong>${isMe ? "You" : "Other"}:</strong> ${data.message}`;
    box.appendChild(p);

    box.scrollTop = box.scrollHeight;
});