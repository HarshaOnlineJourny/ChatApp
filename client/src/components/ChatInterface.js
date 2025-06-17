import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  TextField,
  Button,
  Typography,
  Divider,
  Grid,
  AppBar,
  Toolbar,
  IconButton,
  Popover,
  Menu,
  MenuItem,
  Drawer,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import EmojiPicker from 'emoji-picker-react';
import MenuIcon from '@mui/icons-material/Menu';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ImageIcon from '@mui/icons-material/Image';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';

const ChatInterface = ({ socket, currentUser, onSignOut, isMobile }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactionAnchorEl, setReactionAnchorEl] = useState(null);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const selectedUserRef = useRef(selectedUser);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const theme = useTheme();

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    socket.on('update_users', (userList) => {
      console.log('Received update_users:', userList);
      setUsers(userList.filter(user => user.socketId !== currentUser.socketId));
    });

    socket.on('private_message', (messageData) => {
      console.log('Received private_message:', messageData);
      if (selectedUserRef.current && messageData.sender === selectedUserRef.current.username) {
        setMessages(prev => [...prev, messageData]);
      }
    });

    socket.on('chat_history', ({ withUsername, history }) => {
      console.log('Received chat_history:', withUsername, history);
      if (selectedUserRef.current && selectedUserRef.current.username === withUsername) {
        setMessages(history);
      }
    });

    socket.on('unread_counts', (counts) => {
      console.log('Received unread_counts:', counts);
      setUnreadCounts(counts || {});
    });

    return () => {
      socket.off('update_users');
      socket.off('private_message');
      socket.off('chat_history');
      socket.off('unread_counts');
    };
  }, [socket, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedUser) return;
    socket.emit('private_message', {
      recipientId: selectedUser.socketId,
      message: message.trim(),
    });
    setMessages(prev => [...prev, {
      sender: currentUser.username,
      recipient: selectedUser.username,
      message: message.trim(),
      timestamp: new Date().toISOString(),
      reactions: {},
    }]);
    setMessage('');
  };

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    if (isMobile) {
      setDrawerOpen(false);
    }
    setTimeout(() => {
      socket.emit('get_chat_history', { withUsername: user.username });
    }, 10);
  };

  const handleEmojiIconClick = (event) => {
    setEmojiAnchorEl(event.currentTarget);
  };
  const handleEmojiClose = () => {
    setEmojiAnchorEl(null);
  };
  const handleEmojiSelect = (emojiData) => {
    setMessage(prev => prev + emojiData.emoji);
    handleEmojiClose();
  };

  const handleReactionSelect = (emojiData) => {
    if (selectedMessageForReaction) {
      const reactionKey = emojiData.emoji;
      socket.emit('add_reaction', {
        messageId: selectedMessageForReaction.timestamp,
        reaction: reactionKey,
        recipientId: selectedUser.socketId,
      });
      setMessages(prev => prev.map(msg => {
        if (msg.timestamp === selectedMessageForReaction.timestamp) {
          const reactions = { ...msg.reactions };
          reactions[reactionKey] = (reactions[reactionKey] || 0) + 1;
          return { ...msg, reactions };
        }
        return msg;
      }));
    }
    setReactionAnchorEl(null);
  };

  useEffect(() => {
    socket.on('reaction_added', ({ messageId, reaction, sender }) => {
      setMessages(prev => prev.map(msg => {
        if (msg.timestamp === messageId) {
          const reactions = { ...msg.reactions };
          reactions[reaction] = (reactions[reaction] || 0) + 1;
          return { ...msg, reactions };
        }
        return msg;
      }));
    });

    return () => {
      socket.off('reaction_added');
    };
  }, [socket]);

  const handleClearChat = () => {
    if (selectedUser) {
      setMessages([]);
      // No longer emitting 'clear_chat' to the server, as data is not persisted
      // socket.emit('clear_chat', { withUsername: selectedUser.username });
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target.result;
        socket.emit('private_message', {
          recipientId: selectedUser.socketId,
          message: imageData,
          isImage: true
        });
        setMessages(prev => [...prev, {
          sender: currentUser.username,
          recipient: selectedUser.username,
          message: imageData,
          isImage: true,
          timestamp: new Date().toISOString(),
          reactions: {},
        }]);
      };
      reader.readAsDataURL(file);
      setSelectedFile(null);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current.click();
  };

  useEffect(() => {
    socket.on('chat_cleared', ({ withUsername }) => {
      if (selectedUserRef.current && selectedUserRef.current.username === withUsername) {
        setMessages([]);
      }
    });

    return () => {
      socket.off('chat_cleared');
    };
  }, [socket]);

  const UserList = () => (
    <Box sx={{ 
      width: { xs: 250, sm: 320 }, 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: 'background.paper'
    }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">Online Users</Typography>
      </Box>
      <List sx={{ flex: 1, overflow: 'auto' }}>
        {users.map((user) => (
          <ListItem
            key={user.socketId}
            button
            selected={selectedUser?.socketId === user.socketId}
            onClick={() => handleSelectUser(user)}
            sx={{ 
              borderRadius: 2, 
              mb: 1,
              flexDirection: { xs: 'row' },
              alignItems: 'center',
              p: 1
            }}
          >
            <Badge
              color="secondary"
              badgeContent={unreadCounts[user.username] || 0}
              invisible={!unreadCounts[user.username]}
              sx={{ mr: 2 }}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              overlap="circular"
            >
              <Avatar 
                sx={{ 
                  bgcolor: user.username ? stringToColor(user.username) : undefined,
                  width: 40,
                  height: 40,
                  mr: 1
                }}
              >
                {user.username ? user.username[0].toUpperCase() : '?'}
              </Avatar>
            </Badge>
            <ListItemText
              primary={user.username}
              secondary={`${user.age} years${user.country ? ', ' + user.country : ''}`}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {isMobile ? (
        <>
          <Drawer
            variant="temporary"
            anchor="left"
            open={drawerOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': { 
                boxSizing: 'border-box',
                width: 280,
                height: '100%'
              },
            }}
          >
            <UserList />
          </Drawer>
          <AppBar position="static" color="default" elevation={1}>
            <Toolbar>
              {selectedUser ? (
                <>
                  <IconButton
                    edge="start"
                    color="inherit"
                    onClick={() => setSelectedUser(null)}
                    sx={{ mr: 2 }}
                  >
                    <ArrowBackIcon />
                  </IconButton>
                  <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
                    {selectedUser.username}
                  </Typography>
                  <IconButton
                    color="inherit"
                    onClick={handleClearChat}
                    title="Clear chat"
                  >
                    <DeleteSweepIcon />
                  </IconButton>
                </>
              ) : (
                <>
                  <IconButton
                    edge="start"
                    color="inherit"
                    onClick={handleDrawerToggle}
                    sx={{ mr: 2 }}
                  >
                    <MenuIcon />
                  </IconButton>
                  <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
                    Chat
                  </Typography>
                </>
              )}
            </Toolbar>
          </AppBar>
        </>
      ) : (
        <Box sx={{ display: 'flex', height: '100%' }}>
          <Box sx={{ 
            width: 320,
            borderRight: 1,
            borderColor: 'divider',
            display: { xs: 'none', md: 'block' }
          }}>
            <UserList />
          </Box>
        </Box>
      )}

      <Box sx={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        height: '100%'
      }}>
        {selectedUser ? (
          <>
            <Box sx={{ 
              flex: 1,
              overflow: 'auto',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1
            }}>
              {messages.map((msg, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.sender === currentUser.username ? 'flex-end' : 'flex-start',
                    mb: 1,
                  }}
                >
                  <Paper
                    elevation={1}
                    sx={{
                      p: 1.5,
                      maxWidth: '80%',
                      bgcolor: msg.sender === currentUser.username ? 'primary.light' : 'grey.100',
                      position: 'relative',
                      borderRadius: 2,
                    }}
                  >
                    {msg.isImage ? (
                      <img 
                        src={msg.message} 
                        alt="Shared" 
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '300px', 
                          borderRadius: '8px' 
                        }} 
                      />
                    ) : (
                      <Typography variant="body1">{msg.message}</Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </Typography>
                    {Object.entries(msg.reactions || {}).length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                        {Object.entries(msg.reactions).map(([reaction, count]) => (
                          <Typography key={reaction} variant="caption" sx={{ bgcolor: 'background.paper', px: 0.5, borderRadius: 1 }}>
                            {reaction} {count}
                          </Typography>
                        ))}
                      </Box>
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => { setReactionAnchorEl(e.currentTarget); setSelectedMessageForReaction(msg); }}
                      sx={{ position: 'absolute', right: -8, top: -8, bgcolor: 'background.paper' }}
                    >
                      <EmojiEmotionsIcon fontSize="small" />
                    </IconButton>
                  </Paper>
                </Box>
              ))}
              <div ref={messagesEndRef} />
            </Box>
            <Box
              component="form"
              onSubmit={handleSendMessage}
              sx={{ 
                p: 2,
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper'
              }}
            >
              <Box sx={{ display: 'flex', gap: 1, position: 'relative' }}>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                />
                <IconButton
                  onClick={handleImageClick}
                  sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}
                >
                  <PhotoCameraIcon />
                </IconButton>
                <IconButton
                  onClick={handleEmojiIconClick}
                  sx={{ position: 'absolute', left: 48, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}
                >
                  <EmojiEmotionsIcon />
                </IconButton>
                <TextField
                  fullWidth
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  variant="outlined"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      pl: 10,
                      pr: 1,
                      borderRadius: 3,
                    },
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={!message.trim()}
                  sx={{ borderRadius: 3 }}
                >
                  Send
                </Button>
              </Box>
            </Box>
          </>
        ) : (
          <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            p: 3
          }}>
            <Typography variant="h6" color="text.secondary" align="center">
              {isMobile ? 'Select a user to start chatting' : 'Select a user from the list to start chatting'}
            </Typography>
          </Box>
        )}
      </Box>

      <Popover
        open={Boolean(emojiAnchorEl)}
        anchorEl={emojiAnchorEl}
        onClose={handleEmojiClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <EmojiPicker onEmojiClick={handleEmojiSelect} />
      </Popover>

      <Popover
        open={Boolean(reactionAnchorEl)}
        anchorEl={reactionAnchorEl}
        onClose={() => setReactionAnchorEl(null)}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
      >
        <EmojiPicker onEmojiClick={handleReactionSelect} />
      </Popover>
    </Box>
  );
};

function stringToColor(string) {
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ('00' + value.toString(16)).slice(-2);
  }
  return color;
}

export default ChatInterface; 