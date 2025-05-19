const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));

// Store online users
const onlineUsers = new Map();
// Store chat history: key is sorted pair of usernames, value is array of messages
const chatHistories = new Map();
// Store unread counts: key is recipient username, value is { senderUsername: count }
const unreadCounts = new Map();

function getChatKey(userA, userB) {
  // Always sort usernames to ensure unique key for each pair
  return [userA, userB].sort().join('::');
}

// Debug function to log current users
function logOnlineUsers() {
  console.log('Current online users:');
  for (const [socketId, user] of onlineUsers.entries()) {
    console.log(`Socket: ${socketId}, Username: ${user.username}`);
  }
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Handle user registration
  socket.on('register', (userData) => {
    console.log('Registration attempt:', userData.username);
    const { username, age, gender, country, state } = userData;

    // Clean up any disconnected sockets first
    for (const [sockId, user] of onlineUsers.entries()) {
      const existingSocket = io.sockets.sockets.get(sockId);
      if (!existingSocket || !existingSocket.connected) {
        console.log(`Cleaning up disconnected socket: ${sockId}`);
        onlineUsers.delete(sockId);
      }
    }

    // Check if username is already in use by a connected socket
    let isUsernameTaken = false;
    for (const [sockId, user] of onlineUsers.entries()) {
      if (user.username === username && sockId !== socket.id) {
        const existingSocket = io.sockets.sockets.get(sockId);
        if (existingSocket && existingSocket.connected) {
          console.log(`Username ${username} is taken by socket ${sockId}`);
          isUsernameTaken = true;
          break;
        }
      }
    }

    if (isUsernameTaken) {
      console.log(`Registration failed - username ${username} is taken`);
      socket.emit('registration_error', { message: 'Username is already taken' });
      return;
    }

    // Remove any previous registration for this socket
    if (onlineUsers.has(socket.id)) {
      console.log(`Removing previous registration for socket ${socket.id}`);
      onlineUsers.delete(socket.id);
    }

    // Store user data
    onlineUsers.set(socket.id, {
      username,
      age,
      gender,
      country: country || '',
      state: state || '',
      socketId: socket.id
    });

    console.log(`Registration successful for ${username}`);
    logOnlineUsers();

    // Notify all clients about the new user
    // io.emit('user_list', Array.from(onlineUsers.values()));
    socket.emit('registration_success', { socketId: socket.id });
  });

  // Handle request for chat history
  socket.on('get_chat_history', ({ withUsername }) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    const chatKey = getChatKey(user.username, withUsername);
    const history = chatHistories.get(chatKey) || [];
    socket.emit('chat_history', { withUsername, history });
    // Reset unread count for this chat
    if (unreadCounts.has(user.username)) {
      unreadCounts.get(user.username)[withUsername] = 0;
      socket.emit('unread_counts', unreadCounts.get(user.username));
    }
  });

  // Handle private messages
  socket.on('private_message', ({ recipientId, message }) => {
    const sender = onlineUsers.get(socket.id);
    if (!sender) return;
    const recipient = onlineUsers.get(recipientId);
    if (!recipient) return;
    const chatKey = getChatKey(sender.username, recipient.username);
    const msgObj = {
      sender: sender.username,
      recipient: recipient.username,
      message,
      timestamp: new Date().toISOString(),
    };
    // Store in chat history
    if (!chatHistories.has(chatKey)) chatHistories.set(chatKey, []);
    chatHistories.get(chatKey).push(msgObj);
    // Send to recipient
    const recipientSocket = io.sockets.sockets.get(recipientId);
    if (recipientSocket) {
      recipientSocket.emit('private_message', msgObj);
      // Update unread count
      if (!unreadCounts.has(recipient.username)) unreadCounts.set(recipient.username, {});
      const uc = unreadCounts.get(recipient.username);
      uc[sender.username] = (uc[sender.username] || 0) + 1;
      recipientSocket.emit('unread_counts', uc);
    }
    // Also send to sender (for their chat window)
    socket.emit('private_message', msgObj);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const user = onlineUsers.get(socket.id);
    if (user) {
      console.log(`User ${user.username} disconnected`);
    }
    onlineUsers.delete(socket.id);
    // io.emit('user_list', Array.from(onlineUsers.values()));
    if (user) {
      unreadCounts.delete(user.username);
    }
    logOnlineUsers();
  });
});

// Emit user list every 2 seconds
setInterval(() => {
  io.emit('user_list', Array.from(onlineUsers.values()));
}, 2000);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 