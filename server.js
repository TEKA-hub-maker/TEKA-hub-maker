const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Create data folder for message history
const dataPath = path.join(__dirname, 'data');
if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: true
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Multer setup for image uploads
const upload = multer({ dest: 'public/assets/' });

// Helper functions for persistent room history
const roomHistory = {};

function loadRoomHistory(room) {
  const file = path.join(dataPath, room + '.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file));
  return [];
}

function saveRoomHistory(room) {
  const file = path.join(dataPath, room + '.json');
  fs.writeFileSync(file, JSON.stringify(roomHistory[room]));
}

// Routes
app.get('/', (req, res) => res.sendFile(__dirname + '/public/login.html'));

app.post('/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.redirect('/');
  req.session.username = username;
  res.redirect('/rooms');
});

app.get('/rooms', (req, res) => {
  if (!req.session.username) return res.redirect('/');
  res.sendFile(__dirname + '/public/rooms.html');
});

app.get('/chat-room', (req, res) => {
  if (!req.session.username) return res.redirect('/');
  res.sendFile(__dirname + '/public/chat.html');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Image upload route
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const imagePath = `/assets/${req.file.filename}`;
  const timestamp = new Date().toLocaleTimeString();

  io.to(req.body.room).emit('chat message', {
    user: req.body.username,
    text: `<img src="${imagePath}" alt="image" style="max-width:150px; max-height:150px;">`,
    time: timestamp
  });

  // Save image message to persistent history
  if (!roomHistory[req.body.room]) roomHistory[req.body.room] = loadRoomHistory(req.body.room);
  roomHistory[req.body.room].push({
    user: req.body.username,
    text: `<img src="${imagePath}" alt="image" style="max-width:150px; max-height:150px;">`,
    time: timestamp
  });
  saveRoomHistory(req.body.room);

  res.sendStatus(200);
});

// Socket.io
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('join room', ({ username, room }) => {
    socket.join(room);
    socket.username = username;
    socket.room = room;

    if (!roomHistory[room]) roomHistory[room] = loadRoomHistory(room);

    // Send previous messages
    roomHistory[room].forEach(msg => socket.emit('chat message', msg));

    // Join message
    const joinMsg = { user: 'System', text: `${username} joined ${room}`, time: new Date().toLocaleTimeString() };
    roomHistory[room].push(joinMsg);
    saveRoomHistory(room);
    io.to(room).emit('chat message', joinMsg);
  });

  socket.on('chat message', (msg) => {
    const messageObj = { user: socket.username, text: msg, time: new Date().toLocaleTimeString() };
    roomHistory[socket.room].push(messageObj);
    saveRoomHistory(socket.room);
    io.to(socket.room).emit('chat message', messageObj);
  });

  socket.on('disconnect', () => {
    if (socket.room && socket.username) {
      const leaveMsg = { user: 'System', text: `${socket.username} left ${socket.room}`, time: new Date().toLocaleTimeString() };
      roomHistory[socket.room].push(leaveMsg);
      saveRoomHistory(socket.room);
      io.to(socket.room).emit('chat message', leaveMsg);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));