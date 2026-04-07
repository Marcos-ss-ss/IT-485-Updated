const socket = io();

const sender_id = Number(localStorage.getItem("user_id"));
let receiver_id = null;
let currentRoom = null;
let currentListingId = null;
let currentCourseCode = null;
let currentBookTitle = null;
let currentReceiverEmail = null;

if (!sender_id) {
    alert("You must log in first!");
    window.location.href = "login.html";
}

const urlParams = new URLSearchParams(window.location.search);
const receiverFromUrl = Number(urlParams.get("receiver_id"));
const listingFromUrl = Number(urlParams.get("listing_id"));
const courseFromUrl = urlParams.get("course");
const titleFromUrl = urlParams.get("title");

const conversationList = document.getElementById("conversation-list");
const messagesBox = document.getElementById("messages-box");
const chatLabel = document.getElementById("chat-label");
const chatContext = document.getElementById("chat-context");

function makeRoom(userA, userB, listingId) {
    const base = userA < userB
        ? `room_${userA}_${userB}`
        : `room_${userB}_${userA}`;

    return listingId ? `${base}_listing_${listingId}` : `${base}_general`;
}

function formatConversationContext(courseCode, bookTitle) {
    if (courseCode && bookTitle) {
        return `${courseCode} • ${bookTitle}`;
    }
    if (courseCode) {
        return courseCode;
    }
    if (bookTitle) {
        return bookTitle;
    }
    return "General conversation";
}

function formatTimestamp(ts) {
    if (!ts) return "";
    const date = new Date(ts);
    return date.toLocaleString();
}

function renderMessage(msg) {
    const p = document.createElement("p");
    const isMe = Number(msg.sender_id) === sender_id;

    p.classList.add(isMe ? "me" : "other");
    p.innerHTML = `<strong>${isMe ? "You" : "Other"}:</strong> ${msg.message}`;
    messagesBox.appendChild(p);
}

function clearMessages() {
    messagesBox.innerHTML = "";
}

function updateHeader() {
    if (currentReceiverEmail) {
        chatLabel.textContent = `Chat with ${currentReceiverEmail}`;
    } else {
        chatLabel.textContent = "Chat";
    }

    chatContext.textContent = formatConversationContext(currentCourseCode, currentBookTitle);
}

function loadMessages() {
    if (!receiver_id) return;

    let url = `/getMessages?sender_id=${sender_id}&receiver_id=${receiver_id}`;
    if (currentListingId) {
        url += `&listing_id=${currentListingId}`;
    }

    fetch(url)
        .then(res => res.json())
        .then(messages => {
            clearMessages();

            messages.forEach(renderMessage);
            messagesBox.scrollTop = messagesBox.scrollHeight;
        });
}

function selectConversation(conversation, clickedElement = null) {
    receiver_id = Number(conversation.other_user_id);
    currentReceiverEmail = conversation.other_user_email;
    currentListingId = conversation.listing_id ? Number(conversation.listing_id) : null;
    currentCourseCode = conversation.course_code || null;
    currentBookTitle = conversation.book_title || null;

    currentRoom = makeRoom(sender_id, receiver_id, currentListingId);

    socket.emit("joinRoom", currentRoom);
    updateHeader();
    loadMessages();

    document.querySelectorAll(".conversation-item").forEach(item => {
        item.classList.remove("active");
    });

    if (clickedElement) {
        clickedElement.classList.add("active");
    }
}

function renderConversationItem(convo, prepend = false) {
    const div = document.createElement("div");
    div.className = "conversation-item";

    div.innerHTML = `
        <strong>${convo.other_user_email}</strong>
        <div class="conversation-context">${formatConversationContext(convo.course_code, convo.book_title)}</div>
        <div class="conversation-preview">${convo.last_message || "No messages yet"}</div>
        <div class="conversation-time">${formatTimestamp(convo.last_timestamp)}</div>
    `;

    div.addEventListener("click", () => {
        selectConversation(convo, div);
    });

    if (prepend) {
        conversationList.prepend(div);
    } else {
        conversationList.appendChild(div);
    }

    return div;
}

function loadConversations() {
    fetch(`/getConversations?user_id=${sender_id}`)
        .then(res => res.json())
        .then(conversations => {
            conversationList.innerHTML = "";

            if (conversations.length === 0 && !receiverFromUrl) {
                conversationList.innerHTML = "<p>No conversations yet.</p>";
                return;
            }

            let selectedFromUrl = false;

            conversations.forEach(convo => {
                const div = renderConversationItem(convo);

                if (
                    receiverFromUrl &&
                    Number(convo.other_user_id) === receiverFromUrl &&
                    Number(convo.listing_id || 0) === Number(listingFromUrl || 0)
                ) {
                    selectConversation(convo, div);
                    selectedFromUrl = true;
                }
            });

            if (receiverFromUrl && !selectedFromUrl) {
                fetch(`/getUser/${receiverFromUrl}`)
                    .then(res => res.json())
                    .then(data => {
                        const tempConvo = {
                            other_user_id: receiverFromUrl,
                            other_user_email: data.success ? data.user.email : `User ${receiverFromUrl}`,
                            listing_id: listingFromUrl || null,
                            course_code: courseFromUrl || null,
                            book_title: titleFromUrl || null,
                            last_message: "Start the conversation",
                            last_timestamp: null
                        };

                        const tempDiv = renderConversationItem(tempConvo, true);
                        tempDiv.classList.add("active");
                        selectConversation(tempConvo, tempDiv);
                    })
                    .catch(() => {
                        const tempConvo = {
                            other_user_id: receiverFromUrl,
                            other_user_email: `User ${receiverFromUrl}`,
                            listing_id: listingFromUrl || null,
                            course_code: courseFromUrl || null,
                            book_title: titleFromUrl || null,
                            last_message: "Start the conversation",
                            last_timestamp: null
                        };

                        const tempDiv = renderConversationItem(tempConvo, true);
                        tempDiv.classList.add("active");
                        selectConversation(tempConvo, tempDiv);
                    });
            }
        });
}

function sendMessage() {
    const input = document.getElementById("message-input");
    const message = input.value.trim();

    if (!receiver_id) {
        alert("Select a conversation first.");
        return;
    }

    if (!message) return;

    socket.emit("sendMessage", {
        sender_id,
        receiver_id,
        message,
        room: currentRoom,
        listing_id: currentListingId,
        course_code: currentCourseCode,
        book_title: currentBookTitle
    });

    input.value = "";
}

socket.on("receiveMessage", (data) => {
    const incomingRoom = makeRoom(data.sender_id, data.receiver_id, data.listing_id);

    if (incomingRoom === currentRoom) {
        renderMessage(data);
        messagesBox.scrollTop = messagesBox.scrollHeight;
    }

    loadConversations();
});

document.getElementById("message-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        sendMessage();
    }
});

loadConversations();