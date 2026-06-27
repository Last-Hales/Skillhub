// Messaging functionality

let currentConversationUserId = null;

async function loadConversations() {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch('/api/messages', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const conversations = await response.json();
        displayConversations(conversations);
    } catch (error) {
        console.error('Error loading conversations:', error);
    }
}

function displayConversations(conversations) {
    const list = document.getElementById('conversationsList');

    if (conversations.length === 0) {
        list.innerHTML = '<p>No conversations yet</p>';
        return;
    }

    list.innerHTML = conversations.map(conv => `
        <div class="conversation-item" onclick="openConversation('${conv.otherUser._id}', '${conv.otherUser.fullName}')">
            <div class="conversation-info">
                <h4>${conv.otherUser.fullName}</h4>
                <p>${conv.lastMessage.substring(0, 50)}...</p>
            </div>
            <span class="time">${new Date(conv.lastTimestamp).toLocaleDateString()}</span>
        </div>
    `).join('');
}

async function openConversation(userId, userName) {
    currentConversationUserId = userId;
    document.getElementById('noChatSelected').style.display = 'none';
    document.getElementById('chatWindow').style.display = 'block';
    document.getElementById('chatUserName').textContent = userName;
    
    await loadMessages(userId);
}

async function loadMessages(userId) {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`/api/messages/conversation/${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const messages = await response.json();
        displayMessages(messages);
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function displayMessages(messages) {
    const container = document.getElementById('messagesContainer');
    const currentUser = JSON.parse(localStorage.getItem('user'));

    container.innerHTML = messages.map(msg => `
        <div class="message ${msg.senderId === currentUser.id ? 'sent' : 'received'}">
            <p>${msg.content}</p>
            <span class="timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</span>
        </div>
    `).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const token = localStorage.getItem('token');
    const messageInput = document.getElementById('messageInput');
    const content = messageInput.value.trim();

    if (!content || !currentConversationUserId) return;

    try {
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                receiverId: currentConversationUserId,
                content
            })
        });

        if (response.ok) {
            messageInput.value = '';
            await loadMessages(currentConversationUserId);
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Allow sending message with Enter key
document.addEventListener('DOMContentLoaded', () => {
    loadConversations();

    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    // Refresh conversations every 5 seconds
    setInterval(loadConversations, 5000);
});
