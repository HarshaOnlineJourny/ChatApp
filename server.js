const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));

const onlineUsers = new Map();
const userChats = new Map(); // Store chats in memory

function emitOnlineUsers() {
  io.emit('update_users', Array.from(onlineUsers.values()));
}

io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  socket.on('register', (userData) => {
    console.log('Registration attempt:', userData.username);
    const { username, age, gender, country, state, latitude, longitude } = userData;

    // Store user in memory
    onlineUsers.set(socket.id, { socketId: socket.id, username, age, gender, country, state, latitude, longitude });
    console.log('Registration successful for', username);
    emitOnlineUsers();
    socket.emit('registered', { id: socket.id, username });
    console.log('Current online users:');
    onlineUsers.forEach(user => console.log(`Socket: ${user.socketId}, Username: ${user.username}`));
  });

  socket.on('get_online_users', () => {
    emitOnlineUsers();
  });

  socket.on('private_message', ({ recipientUsername, message, isImage }) => {
    const sender = onlineUsers.get(socket.id);
    if (!sender) return;

    // Find recipient's socketId by username
    let recipientSocketId = null;
    for (let [socketId, user] of onlineUsers) {
      if (user.username === recipientUsername) {
        recipientSocketId = socketId;
        break;
      }
    }

    if (!recipientSocketId) {
      console.log(`Recipient ${recipientUsername} not found or not online.`);
      return;
    }

    const recipient = onlineUsers.get(recipientSocketId);
    if (!recipient) return;

    const messageData = {
      sender: sender.username,
      recipient: recipient.username,
      message,
      isImage: isImage || false,
      timestamp: new Date().toISOString(),
      reactions: {},
    };

    // Store message in memory with a unique key for each user pair
    const chatKey = [sender.username, recipient.username].sort().join('_');
    if (!userChats.has(chatKey)) {
      userChats.set(chatKey, []);
    }
    userChats.get(chatKey).push(messageData);

    io.to(recipientSocketId).emit('private_message', messageData);
    socket.emit('private_message', messageData);
  });

  socket.on('get_chat_history', ({ withUsername }) => {
    const currentUser = onlineUsers.get(socket.id);
    if (!currentUser) return;

    // Create the same chat key as used in private_message
    const chatKey = [currentUser.username, withUsername].sort().join('_');
    const chatHistory = userChats.has(chatKey) ? userChats.get(chatKey) : [];
    
    socket.emit('chat_history', { withUsername, history: chatHistory });
  });

  socket.on('clear_chat', ({ withUsername }) => {
    const sender = onlineUsers.get(socket.id);
    if (!sender) return;

    const chatKey = [sender.username, withUsername].sort().join('_');
    if (userChats.has(chatKey)) {
      userChats.delete(chatKey);
    }

    socket.emit('chat_cleared', { withUsername });
    const recipient = Array.from(onlineUsers.values()).find(user => user.username === withUsername);
    if (recipient) {
      io.to(recipient.socketId).emit('chat_cleared', { withUsername: sender.username });
    }
  });

  socket.on('reaction', ({ messageId, reaction }) => {
    // Assuming messageId refers to an index or unique identifier for in-memory messages
    // In a real app, you'd find the message by ID and update its reactions.
    // For this in-memory version, we'll just re-emit the reaction to illustrate.
    // This part would need more sophisticated in-memory message tracking or a DB to work perfectly.
    const sender = onlineUsers.get(socket.id);
    if (!sender) return;

    // Find the message in memory (simplified for non-persistent chat)
    // This is a placeholder; real in-memory reaction would need more complex data structure
    // For now, it will just re-emit to show the concept.
    io.emit('update_message_reaction', { messageId, reaction, sender: sender.username });
  });

  socket.on('mark_messages_read', ({ withUsername }) => {
    const currentUser = onlineUsers.get(socket.id);
    if (!currentUser) return;

    // Notify the other user that their messages have been read
    const otherUser = Array.from(onlineUsers.values()).find(user => user.username === withUsername);
    if (otherUser) {
      io.to(otherUser.socketId).emit('messages_read', { byUsername: currentUser.username });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    const disconnectedUser = onlineUsers.get(socket.id);
    if (disconnectedUser) {
      console.log('User', disconnectedUser.username, 'disconnected');
      onlineUsers.delete(socket.id);
      emitOnlineUsers();
    }
    console.log('Current online users:');
    onlineUsers.forEach(user => console.log(`Socket: ${user.socketId}, Username: ${user.username}`));
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
