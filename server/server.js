const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidV4 } = require('uuid');
const passport = require('passport');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const { ExpressPeerServer } = require('peer');

// Passport config
require('./config/passport')(passport);

// DB connection
const { connectDB } = require('./config/db');
connectDB();

const app = express();
const server = http.createServer(app);

// ---------- PeerJS Server ----------
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/',
});
app.use('/peerjs', peerServer);

// ---------- Socket.IO ----------
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((u) => u.trim())
  : ['http://localhost:5175'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ---------- Security ----------
app.use(
  helmet({
    contentSecurityPolicy: false, // relaxed so the SPA can load scripts/styles
  })
);
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ---------- Body Parsers ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust first proxy (Render, Railway, etc.)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ---------- Session ----------
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'changeme',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
});
app.use(sessionMiddleware);

// ---------- Passport ----------
app.use(passport.initialize());
app.use(passport.session());

// ---------- API Routes ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/meetings', require('./routes/meetings'));

// ---------- Serve React Client in Production ----------
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientBuild));
  // All non-API routes → index.html (SPA client-side routing)
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

// ---------- Socket.IO Events ----------
io.on('connection', (socket) => {
  socket.on('join-room', (roomId, peerId, userName) => {
    // Prevent duplicate join-room listeners
    if (socket.roomId) {
      // Already joined — skip re-registration
      return;
    }

    socket.join(roomId);
    socket.userName = userName;
    socket.roomId = roomId;

    // Notify others in the room
    socket.to(roomId).emit('user-connected', peerId, userName);

    // Chat messages
    socket.on('message', (message) => {
      io.to(socket.roomId).emit('createMessage', message, socket.userName);
    });

    // Disconnect
    socket.on('disconnect', () => {
      socket.to(roomId).emit('user-disconnected', peerId);
    });
  });
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
