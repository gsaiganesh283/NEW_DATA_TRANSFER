const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e8 // 100 MB
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store active rooms and peers
const rooms = new Map();
const peers = new Map();

// Generate unique room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Create a new room
  socket.on('create-room', () => {
    const roomCode = generateRoomCode();
    rooms.set(roomCode, {
      host: socket.id,
      guest: null,
      createdAt: Date.now()
    });
    peers.set(socket.id, { roomCode, role: 'host' });
    socket.join(roomCode);
    
    console.log(`Room created: ${roomCode} by ${socket.id}`);
    socket.emit('room-created', { roomCode });
  });

  // Join an existing room
  socket.on('join-room', (roomCode) => {
    const room = rooms.get(roomCode);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.guest) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    room.guest = socket.id;
    peers.set(socket.id, { roomCode, role: 'guest' });
    socket.join(roomCode);

    console.log(`Client ${socket.id} joined room: ${roomCode}`);
    
    // Notify both peers
    socket.emit('room-joined', { roomCode });
    io.to(room.host).emit('peer-joined', { peerId: socket.id });
  });

  // WebRTC signaling
  socket.on('offer', ({ offer, roomCode }) => {
    const room = rooms.get(roomCode);
    if (room && room.guest) {
      io.to(room.guest).emit('offer', { offer, peerId: socket.id });
    }
  });

  socket.on('answer', ({ answer, roomCode }) => {
    const room = rooms.get(roomCode);
    if (room && room.host) {
      io.to(room.host).emit('answer', { answer, peerId: socket.id });
    }
  });

  socket.on('ice-candidate', ({ candidate, roomCode }) => {
    const room = rooms.get(roomCode);
    if (room) {
      // Send to the other peer
      const targetId = room.host === socket.id ? room.guest : room.host;
      if (targetId) {
        io.to(targetId).emit('ice-candidate', { candidate, peerId: socket.id });
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    const peerInfo = peers.get(socket.id);
    if (peerInfo) {
      const room = rooms.get(peerInfo.roomCode);
      if (room) {
        // Notify the other peer
        const otherPeerId = room.host === socket.id ? room.guest : room.host;
        if (otherPeerId) {
          io.to(otherPeerId).emit('peer-disconnected');
        }
        
        // Clean up room if both peers are gone
        if (room.host === socket.id) {
          rooms.delete(peerInfo.roomCode);
        } else {
          room.guest = null;
        }
      }
      peers.delete(socket.id);
    }
  });
});

// API endpoints
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    activeRooms: rooms.size,
    activePeers: peers.size
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
