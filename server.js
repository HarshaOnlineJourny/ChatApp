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

io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  socket.on('register', (userData) => {
    console.log('Registration attempt:', userData.username);
    const { username, age, gender, country, state, latitude, longitude } = userData;

    // Store user in memory
    onlineUsers.set(socket.id, { socketId: socket.id, username, age, gender, country, state, latitude, longitude });
    console.log('Registration successful for', username);
    io.emit('update_users', Array.from(onlineUsers.values()));
    socket.emit('registered', { id: socket.id, username });
    console.log('Current online users:');
    onlineUsers.forEach(user => console.log(`Socket: ${user.socketId}, Username: ${user.username}`));
  });

  socket.on('private_message', ({ recipientId, message, isImage }) => {
    const sender = onlineUsers.get(socket.id);
    if (!sender) return;
    const recipient = onlineUsers.get(recipientId);
    if (!recipient) return;

    const messageData = {
      sender: sender.username,
      recipient: recipient.username,
      message,
      isImage: isImage || false,
      timestamp: new Date().toISOString(),
      reactions: {},
    };

    // Store message in memory
    if (!userChats.has(sender.username)) {
      userChats.set(sender.username, new Map());
    }
    if (!userChats.get(sender.username).has(recipient.username)) {
      userChats.get(sender.username).set(recipient.username, []);
    }
    userChats.get(sender.username).get(recipient.username).push(messageData);

    if (!userChats.has(recipient.username)) {
      userChats.set(recipient.username, new Map());
    }
    if (!userChats.get(recipient.username).has(sender.username)) {
      userChats.get(recipient.username).set(sender.username, []);
    }
    userChats.get(recipient.username).get(sender.username).push(messageData);

    io.to(recipientId).emit('private_message', messageData);
    socket.emit('private_message', messageData);
  });

  socket.on('get_chat_history', ({ withUsername }) => {
    const currentUser = onlineUsers.get(socket.id);
    if (!currentUser) return;

    const chatHistory = userChats.has(currentUser.username) && userChats.get(currentUser.username).has(withUsername)
      ? userChats.get(currentUser.username).get(withUsername)
      : [];
    socket.emit('chat_history', chatHistory);
  });

  socket.on('clear_chat', ({ withUsername }) => {
    const sender = onlineUsers.get(socket.id);
    if (!sender) return;

    if (userChats.has(sender.username)) {
      userChats.get(sender.username).delete(withUsername);
    }
    const recipient = onlineUsers.get(Array.from(onlineUsers.keys()).find(key => onlineUsers.get(key).username === withUsername));
    if (recipient && userChats.has(recipient.username)) {
      userChats.get(recipient.username).delete(sender.username);
    }

    // Notify frontend to clear in-memory chat
    socket.emit('chat_cleared', { withUsername });
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

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    const disconnectedUser = onlineUsers.get(socket.id);
    if (disconnectedUser) {
      console.log('User', disconnectedUser.username, 'disconnected');
      onlineUsers.delete(socket.id);
      io.emit('update_users', Array.from(onlineUsers.values()));
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
