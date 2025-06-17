import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';

const RegistrationForm = ({ onRegister }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [formData, setFormData] = useState({
    username: '',
    age: '',
    gender: '',
    country: '',
    state: '',
    // latitude: null, // No longer storing in DB
    // longitude: null, // No longer storing in DB
  });
  const [locationError, setLocationError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // We still get location, but don't necessarily pass to server for DB save
    // If location is not needed at all, this can be removed.
    getLocation(); 
  }, []);

  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
        setIsLoading(false);
      },
      (error) => {
        setLocationError('Unable to retrieve your location');
        setIsLoading(false);
      }
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // No longer blocking registration on location, as it's not saved to DB
    // if (!formData.latitude || !formData.longitude) {
    //   setLocationError('Please allow location access to continue');
    //   return;
    // }
    onRegister(formData);
  };

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      p: isMobile ? 2 : 4
    }}>
      <Paper 
        elevation={3} 
        sx={{ 
          p: isMobile ? 2 : 4, 
          width: '100%',
          maxWidth: 400,
          borderRadius: 2
        }}
      >
        <Typography 
          variant={isMobile ? "h6" : "h5"} 
          component="h1" 
          gutterBottom
          align="center"
        >
          Join Chat
        </Typography>

        {locationError && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={getLocation}
                disabled={isLoading}
              >
                Retry
              </Button>
            }
          >
            {locationError}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            margin="normal"
            required
            size={isMobile ? "small" : "medium"}
          />
          <TextField
            fullWidth
            label="Age"
            name="age"
            type="number"
            value={formData.age}
            onChange={handleChange}
            margin="normal"
            required
            size={isMobile ? "small" : "medium"}
          />
          <FormControl fullWidth margin="normal" size={isMobile ? "small" : "medium"}>
            <InputLabel>Gender</InputLabel>
            <Select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              label="Gender"
              required
            >
              <MenuItem value="male">Male</MenuItem>
              <MenuItem value="female">Female</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Country"
            name="country"
            value={formData.country}
            onChange={handleChange}
            margin="normal"
            size={isMobile ? "small" : "medium"}
          />
          <TextField
            fullWidth
            label="State"
            name="state"
            value={formData.state}
            onChange={handleChange}
            margin="normal"
            size={isMobile ? "small" : "medium"}
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ 
              mt: 2,
              height: isMobile ? 40 : 48,
              borderRadius: 2
            }}
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <LocationOnIcon />}
          >
            {isLoading ? 'Getting Location...' : 'Join Chat'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default RegistrationForm; 