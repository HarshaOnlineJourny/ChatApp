import React, { useState, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import { CssBaseline, Container, IconButton, AppBar, Toolbar, Typography, useMediaQuery, Box } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import RegistrationForm from './components/RegistrationForm';
import ChatInterface from './components/ChatInterface';

//const socket = io('http://192.168.1.23:3001', { autoConnect: false });
//const socket = io(process.env.REACT_APP_SOCKET_URL || '/', { autoConnect: false });
const socket = io(); // This will use the same origin as the frontend

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    // Try to load user from sessionStorage
    const stored = sessionStorage.getItem('chatUser');
    return stored ? JSON.parse(stored) : null;
  });
  const [isRegistered, setIsRegistered] = useState(!!currentUser);
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [darkMode, setDarkMode] = useState(prefersDarkMode);
  const isMobile = useMediaQuery('(max-width:600px)');

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
    components: {
      MuiContainer: {
        styleOverrides: {
          root: {
            padding: isMobile ? '8px' : '24px',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1200,
          },
        },
      },
    },
  }), [darkMode, isMobile]);

  const handleToggleDarkMode = () => setDarkMode((prev) => !prev);

  useEffect(() => {
    // Listen for server confirmation of registration
    socket.on('registered', (data) => {
      console.log('Received registered confirmation:', data);
      setIsRegistered(true);
      setCurrentUser((prev) => ({
        ...prev,
        socketId: data.id, // Use 'id' from server as socketId
      }));
      sessionStorage.setItem('chatUser', JSON.stringify({ ...currentUser, socketId: data.id }));
    });

    return () => {
      socket.off('registered');
    };
  }, [currentUser]);

  const handleRegister = (userData) => {
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('register', userData);
    // We now wait for the 'registered' event to set currentUser and isRegistered
    // setCurrentUser(userData);
    // setIsRegistered(true);
    // sessionStorage.setItem('chatUser', JSON.stringify(userData));
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
      <AppBar position="fixed" color="default" elevation={1}>
        <Toolbar sx={{ 
          minHeight: { xs: '48px', sm: '64px' },
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant={isMobile ? "subtitle1" : "h6"} sx={{ flexGrow: 1 }}>
              Real-time Chat
            </Typography>
          </Box>
          <IconButton 
            color="inherit" 
            onClick={handleToggleDarkMode} 
            title="Toggle dark mode"
            size={isMobile ? "small" : "medium"}
            sx={{ 
              ml: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Toolbar>
      </AppBar>
      <Container 
        maxWidth="xl" 
        sx={{ 
          height: '100vh',
          pt: { xs: '56px', sm: '64px' }, // Add padding for fixed AppBar
          px: { xs: 1, sm: 2 },
          py: { xs: 1, sm: 2 },
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {!isRegistered ? (
          <RegistrationForm onRegister={handleRegister} />
        ) : (
          <ChatInterface 
            socket={socket} 
            currentUser={currentUser} 
            onSignOut={handleSignOut} 
            darkMode={darkMode}
            isMobile={isMobile}
          />
        )}
      </Container>
    </ThemeProvider>
  );
}

export default App;
