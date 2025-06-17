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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

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
  socket.on('register', async (userData) => {
    console.log('Registration attempt:', userData.username);
    const { username, age, gender, country, state, latitude, longitude } = userData;

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
      socketId: socket.id,
      latitude,
      longitude
    });

    console.log(`Registration successful for ${username}`);
    logOnlineUsers();

    // Save user to Postgres
    try {
      await pool.query(
        'INSERT INTO users (username, age, gender, country, state, latitude, longitude, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) ON CONFLICT (username) DO NOTHING',
        [username, age, gender, country, state, latitude, longitude]
      );
    } catch (err) {
      console.error('Error saving user to Postgres:', err);
    }

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

  // Handle clear chat
  socket.on('clear_chat', ({ withUsername }) => {
    const sender = onlineUsers.get(socket.id);
    if (!sender) return;
    
    // Clear chat history in database
    pool.query(
      'DELETE FROM messages WHERE (sender = $1 AND recipient = $2) OR (sender = $2 AND recipient = $1)',
      [sender.username, withUsername]
    );

    // Notify both users
    const recipient = Array.from(onlineUsers.values()).find(user => user.username === withUsername);
    if (recipient) {
      io.to(recipient.socketId).emit('chat_cleared', { withUsername: sender.username });
    }
    socket.emit('chat_cleared', { withUsername });
  });

  // Handle private messages
  socket.on('private_message', async ({ recipientId, message, isImage }) => {
    const sender = onlineUsers.get(socket.id);
    if (!sender) return;
    const recipient = onlineUsers.get(recipientId);
    if (!recipient) return;

    const messageData = {
      sender: sender.username,
      recipient: recipient.username,
      message,
      isImage,
      timestamp: new Date().toISOString(),
      reactions: {},
    };

    // Save message to database
    try {
      await pool.query(
        'INSERT INTO messages (sender, recipient, message, timestamp, sender_latitude, sender_longitude, is_image) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          sender.username,
          recipient.username,
          message,
          messageData.timestamp,
          sender.latitude,
          sender.longitude,
          isImage || false
        ]
      );
    } catch (err) {
      console.error('Error saving message to database:', err);
    }

    // Send message to recipient
    io.to(recipientId).emit('private_message', messageData);
    // Send message back to sender
    socket.emit('private_message', messageData);
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
