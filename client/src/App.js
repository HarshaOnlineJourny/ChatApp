import React, { useState, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import { CssBaseline, Container, IconButton, AppBar, Toolbar, Typography } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import useMediaQuery from '@mui/material/useMediaQuery';
import RegistrationForm from './components/RegistrationForm';
import ChatInterface from './components/ChatInterface';

const socket = io('http://192.168.1.23:3001', { autoConnect: false });

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    // Try to load user from sessionStorage
    const stored = sessionStorage.getItem('chatUser');
    return stored ? JSON.parse(stored) : null;
  });
  const [isRegistered, setIsRegistered] = useState(!!currentUser);
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [darkMode, setDarkMode] = useState(prefersDarkMode);

  const theme = useMemo(() => createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: darkMode ? '#90caf9' : '#1976d2',
      },
      background: {
        default: darkMode ? '#121212' : '#f4f6fa',
        paper: darkMode ? '#1e1e1e' : '#fff',
      },
    },
  }), [darkMode]);

  const handleToggleDarkMode = () => setDarkMode((prev) => !prev);

  useEffect(() => {
    if (currentUser && !currentUser.socketId) {
      // Connect and register with the server
      if (!socket.connected) socket.connect();
      socket.emit('register', currentUser);
    }
  }, [currentUser]);

  useEffect(() => {
    socket.on('registration_error', (error) => {
      alert(error.message);
      setCurrentUser(null);
      setIsRegistered(false);
      sessionStorage.removeItem('chatUser');
    });

    socket.on('registration_success', (data) => {
      setIsRegistered(true);
      // Save to sessionStorage
      sessionStorage.setItem('chatUser', JSON.stringify({ ...currentUser, socketId: data.socketId }));
      setCurrentUser((prev) => ({ ...prev, socketId: data.socketId }));
    });

    return () => {
      socket.off('registration_error');
      socket.off('registration_success');
    };
  }, [currentUser]);

  const handleRegister = (userData) => {
    setCurrentUser(userData);
  };

  const handleSignOut = () => {
    sessionStorage.removeItem('chatUser');
    setCurrentUser(null);
    setIsRegistered(false);
    if (socket.connected) socket.disconnect();
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Real-time Chat
          </Typography>
          <IconButton color="inherit" onClick={handleToggleDarkMode} title="Toggle dark mode">
            {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ height: '100vh', p: 0 }}>
        {!isRegistered ? (
          <RegistrationForm onRegister={handleRegister} />
        ) : (
          <ChatInterface socket={socket} currentUser={currentUser} onSignOut={handleSignOut} darkMode={darkMode} />
        )}
      </Container>
    </ThemeProvider>
  );
}

export default App;
