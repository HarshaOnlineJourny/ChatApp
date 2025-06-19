import React, { useRef } from 'react';
import { TextField, Button, IconButton } from '@mui/material';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';

const MessageInput = React.memo(function MessageInput({
  message,
  setMessage,
  onSend,
  onEmojiClick,
  onImageClick,
  fileInputRef
}) {
  const inputRef = useRef(null);

  const handleChange = (e) => setMessage(e.target.value);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSend();
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
      <IconButton onClick={onEmojiClick} color="primary">
        <EmojiEmotionsIcon />
      </IconButton>
      <IconButton onClick={onImageClick} color="primary">
        <PhotoCameraIcon />
      </IconButton>
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
      />
      <TextField
        fullWidth
        value={message}
        onChange={handleChange}
        inputRef={inputRef}
        placeholder="Type a message..."
        variant="outlined"
        size="small"
        multiline
        maxRows={4}
      />
      <Button
        type="submit"
        variant="contained"
        color="primary"
        disabled={!message.trim()}
      >
        Send
      </Button>
    </form>
  );
});

export default MessageInput; 