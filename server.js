const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

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

// Store message history per room
const roomHistory = {};

// Socket.io
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('join room', ({ username, room }) => {
    socket.join(room);
    socket.username = username;
    socket.room = room;

    if (!roomHistory[room]) roomHistory[room] = [];

    // Send previous messages to user
    roomHistory[room].forEach(msg => socket.emit('chat message', msg));

    // Join notification
    const joinMsg = { user: 'System', text: `${username} joined ${room}`, time: new Date().toLocaleTimeString() };
    roomHistory[room].push(joinMsg);
    io.to(room).emit('chat message', joinMsg);
  });

  socket.on('chat message', (msg) => {
    const messageObj = { user: socket.username, text: msg, time: new Date().toLocaleTimeString() };
    roomHistory[socket.room].push(messageObj);
    io.to(socket.room).emit('chat message', messageObj);
  });

  socket.on('disconnect', () => {
    if (socket.room && socket.username) {
      const leaveMsg = { user: 'System', text: `${socket.username} left ${socket.room}`, time: new Date().toLocaleTimeString() };
      roomHistory[socket.room].push(leaveMsg);
      io.to(socket.room).emit('chat message', leaveMsg);
    }
  });
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

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));