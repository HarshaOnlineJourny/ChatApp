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
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import EmojiPicker from 'emoji-picker-react';

const ChatInterface = ({ socket, currentUser, onSignOut }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactionAnchorEl, setReactionAnchorEl] = useState(null);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState(null);
  const messagesEndRef = useRef(null);
  const selectedUserRef = useRef(selectedUser);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    socket.on('user_list', (userList) => {
      console.log('Received user_list:', userList);
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
      socket.off('user_list');
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

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setTimeout(() => {
      socket.emit('get_chat_history', { withUsername: user.username });
    }, 10); // 1 seconds delay
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

  return (
    <Box sx={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'row', overflowX: 'auto' }}>
      <Box sx={{ width: { xs: 80, sm: 120, md: 320 }, minWidth: 60, maxWidth: 400, bgcolor: 'background.paper', p: 1, borderRight: 1, borderColor: 'divider', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography variant="h6" gutterBottom sx={{ display: { xs: 'none', md: 'block' } }}>
          Online Users
        </Typography>
        <List sx={{ width: '100%' }}>
          {users.map((user) => (
            <ListItem
              key={user.socketId}
              button
              selected={selectedUser?.socketId === user.socketId}
              onClick={() => handleSelectUser(user)}
              sx={{ borderRadius: 2, mb: 1, flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', justifyContent: 'center', p: { xs: 0.5, md: 1 } }}
            >
              <Badge
                color="secondary"
                badgeContent={unreadCounts[user.username] || 0}
                invisible={!unreadCounts[user.username]}
                sx={{ mr: { xs: 0, md: 2 }, mb: { xs: 0.5, md: 0 } }}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                overlap="circular"
              >
                <Avatar sx={{ bgcolor: user.username ? stringToColor(user.username) : undefined, width: 36, height: 36, mb: { xs: 0.5, md: 0 }, mr: { xs: 0, md: 1 } }}>
                  {user.username ? user.username[0].toUpperCase() : '?'}
                </Avatar>
              </Badge>
              <ListItemText
                primary={user.username}
                secondary={`${user.age} years${user.country ? ', ' + user.country : ''}`}
                sx={{ display: { xs: 'none', md: 'block' } }}
              />
            </ListItem>
          ))}
        </List>
      </Box>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', p: 2, minWidth: 0 }}>
        {selectedUser ? (
          <>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6">
                Chat with {selectedUser.username}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
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
                      p: 1,
                      maxWidth: '70%',
                      bgcolor: msg.sender === currentUser.username ? 'primary.light' : 'grey.100',
                      position: 'relative',
                    }}
                  >
                    <Typography variant="body1">{msg.message}</Typography>
                    <Typography variant="caption" color="text.secondary">
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
              sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}
            >
              <Box sx={{ display: 'flex', gap: 1, position: 'relative' }}>
                <IconButton
                  onClick={handleEmojiIconClick}
                  sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}
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
                  sx={{ pl: 5 }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!message.trim()}
                >
                  Send
                </Button>
              </Box>
              <Popover
                open={Boolean(emojiAnchorEl)}
                anchorEl={emojiAnchorEl}
                onClose={handleEmojiClose}
                anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiSelect}
                  theme="light"
                />
              </Popover>
            </Box>
          </>
        ) : (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="h6" color="text.secondary">
              Select a user to start chatting
            </Typography>
          </Box>
        )}
      </Box>
      <Menu
        anchorEl={reactionAnchorEl}
        open={Boolean(reactionAnchorEl)}
        onClose={() => setReactionAnchorEl(null)}
      >
        <Box sx={{ p: 1 }}>
          <EmojiPicker
            onEmojiClick={handleReactionSelect}
            theme="light"
          />
        </Box>
      </Menu>
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