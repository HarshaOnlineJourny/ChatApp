const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store online users and their messages
const onlineUsers = new Map();
const messages = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('register', (userData) => {
    console.log('Registration attempt:', userData.username);
    
    // Remove previous registration for this socket if exists
    if (onlineUsers.has(socket.id)) {
      const oldUsername = onlineUsers.get(socket.id).username;
      console.log('Removing previous registration for socket', socket.id);
      onlineUsers.delete(socket.id);
    }

    // Add new user
    onlineUsers.set(socket.id, { ...userData, socketId: socket.id });
    console.log('Registration successful for', userData.username);
    
    // Broadcast updated user list
    broadcastUserList();
  });

  socket.on('private_message', (data) => {
    const sender = onlineUsers.get(socket.id);
    const recipient = Array.from(onlineUsers.values()).find(u => u.socketId === data.recipientId);
    
    if (sender && recipient) {
      const messageData = {
        sender: sender.username,
        recipient: recipient.username,
        message: data.message,
        timestamp: new Date().toISOString(),
        reactions: {}
      };

      // Store message
      const chatKey = [sender.username, recipient.username].sort().join('_');
      if (!messages.has(chatKey)) {
        messages.set(chatKey, []);
      }
      messages.get(chatKey).push(messageData);

      // Send to recipient
      io.to(data.recipientId).emit('private_message', messageData);
      
      // Send to sender
      socket.emit('private_message', messageData);
    }
  });

  socket.on('get_chat_history', (data) => {
    const sender = onlineUsers.get(socket.id);
    if (sender) {
      const chatKey = [sender.username, data.withUsername].sort().join('_');
      const history = messages.get(chatKey) || [];
      socket.emit('chat_history', {
        withUsername: data.withUsername,
        history: history
      });
    }
  });

  socket.on('add_reaction', (data) => {
    const sender = onlineUsers.get(socket.id);
    const recipient = Array.from(onlineUsers.values()).find(u => u.socketId === data.recipientId);
    
    if (sender && recipient) {
      const chatKey = [sender.username, recipient.username].sort().join('_');
      const chatMessages = messages.get(chatKey) || [];
      
      const messageIndex = chatMessages.findIndex(m => m.timestamp === data.messageId);
      if (messageIndex !== -1) {
        const message = chatMessages[messageIndex];
        message.reactions = message.reactions || {};
        message.reactions[data.reaction] = (message.reactions[data.reaction] || 0) + 1;
        
        // Broadcast reaction to both users
        io.to(data.recipientId).emit('reaction_added', {
          messageId: data.messageId,
          reaction: data.reaction,
          sender: sender.username
        });
        socket.emit('reaction_added', {
          messageId: data.messageId,
          reaction: data.reaction,
          sender: sender.username
        });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (onlineUsers.has(socket.id)) {
      const username = onlineUsers.get(socket.id).username;
      console.log('User', username, 'disconnected');
      onlineUsers.delete(socket.id);
      broadcastUserList();
    }
  });
});

function broadcastUserList() {
  const userList = Array.from(onlineUsers.values());
  console.log('Current online users:');
  userList.forEach(user => {
    console.log('Socket:', user.socketId + ', Username:', user.username);
  });
  io.emit('user_list', userList);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 