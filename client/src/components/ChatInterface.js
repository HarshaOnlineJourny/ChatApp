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
    // Request initial user list when component mounts
    socket.emit('get_online_users');

    socket.on('update_users', (userList) => {
      console.log('Received update_users:', userList);
      setUsers(userList.filter(user => user.socketId !== currentUser.socketId));
    });

    socket.on('private_message', (messageData) => {
      console.log('Received private_message:', messageData);
      if (selectedUserRef.current && messageData.sender === selectedUserRef.current.username) {
        setMessages(prev => [...prev, messageData]);
        socket.emit('mark_messages_read', { withUsername: messageData.sender });
        setUnreadCounts(prev => ({ ...prev, [messageData.sender]: 0 }));
      } else {
        setUnreadCounts(prev => ({
          ...prev,
          [messageData.sender]: (prev[messageData.sender] || 0) + 1
        }));
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
      recipientUsername: selectedUser.username,
      message: message.trim(),
      isImage: false,
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
    socket.emit('mark_messages_read', { withUsername: user.username });
    setUnreadCounts(prev => ({ ...prev, [user.username]: 0 }));
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
          recipientUsername: selectedUser.username,
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
      bgcolor: 'background.paper',
      borderRight: '1px solid',
      borderColor: 'divider'
    }}>
      <Box sx={{ 
        p: 2, 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography variant="h6">Online Users</Typography>
        <IconButton onClick={handleSignOut} color="inherit" title="Sign Out">
          <LogoutIcon />
        </IconButton>
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
              p: 1,
              '&:hover': {
                bgcolor: 'action.hover',
              },
              '&.Mui-selected': {
                bgcolor: 'primary.light',
                '&:hover': {
                  bgcolor: 'primary.light',
                },
              },
            }}
          >
            <Badge
              color="error"
              badgeContent={unreadCounts[user.username] || 0}
              invisible={!unreadCounts[user.username]}
              sx={{ mr: 2 }}
            >
              <Avatar sx={{ bgcolor: stringToColor(user.username) }}>
                {user.username[0].toUpperCase()}
              </Avatar>
            </Badge>
            <ListItemText 
              primary={user.username}
              secondary={`${user.age} • ${user.country}`}
              primaryTypographyProps={{
                fontWeight: unreadCounts[user.username] ? 'bold' : 'normal'
              }}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  const handleSignOut = () => {
    // Clear all socket listeners
    socket.off('update_users');
    socket.off('private_message');
    socket.off('chat_history');
    socket.off('unread_counts');
    socket.off('reaction_added');
    socket.off('chat_cleared');

    // Clear all state
    setUsers([]);
    setSelectedUser(null);
    setMessage('');
    setMessages([]);
    setUnreadCounts({});
    setShowEmojiPicker(false);
    setReactionAnchorEl(null);
    setSelectedMessageForReaction(null);
    setDrawerOpen(false);
    setEmojiAnchorEl(null);
    setSelectedFile(null);

    // Disconnect socket
    if (socket.connected) {
      socket.disconnect();
    }

    // Call parent's onSignOut
    onSignOut();
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      height: '100%',
      bgcolor: 'background.default'
    }}>
      {isMobile ? (
        <>
          <Drawer
            variant="temporary"
            anchor="left"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            sx={{
              '& .MuiDrawer-paper': { 
                width: 280,
                boxSizing: 'border-box',
              },
            }}
          >
            <UserList />
          </Drawer>
          <IconButton
            onClick={() => setDrawerOpen(true)}
            sx={{ position: 'absolute', left: 16, top: 16, zIndex: 1 }}
          >
            <MenuIcon />
          </IconButton>
          <ChatArea />
        </>
      ) : (
        <>
          <UserList />
          <ChatArea />
        </>
      )}
      <Popover
        open={Boolean(emojiAnchorEl)}
        anchorEl={emojiAnchorEl}
        onClose={handleEmojiClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <EmojiPicker onEmojiClick={handleEmojiSelect} />
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