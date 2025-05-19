# Real-time Chat Application

A real-time chat application that allows users to create temporary profiles and chat with other online users.

## Features

- Temporary user profiles (no sign-up required)
- Real-time private messaging
- Online user list with details
- Modern Material-UI interface

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository
2. Install server dependencies:
   ```bash
   npm install
   ```
3. Install client dependencies:
   ```bash
   cd client
   npm install
   ```

## Running the Application

1. Start the server:
   ```bash
   node server.js
   ```
2. In a new terminal, start the client:
   ```bash
   cd client
   npm start
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Usage

1. Open the application in your browser
2. Fill out the registration form with your details
3. Once registered, you'll see a list of online users
4. Click on a user to start a private chat
5. Type your message and press Enter or click Send to chat

## Technologies Used

- Frontend:
  - React
  - Material-UI
  - Socket.IO Client

- Backend:
  - Node.js
  - Express
  - Socket.IO 