const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

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

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

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

// Socket.io logic
io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('join room', ({ username, room }) => {
    socket.join(room);
    socket.room = room;
    socket.username = username;
    io.to(room).emit('chat message', {
      user: 'System',
      text: `${username} joined ${room}`,
      time: new Date().toLocaleTimeString()
    });
  });

  socket.on('chat message', (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    io.to(socket.room).emit('chat message', {
      user: socket.username,
      text: msg,
      time: timestamp
    });
  });

  socket.on('disconnect', () => {
    if(socket.room && socket.username){
      io.to(socket.room).emit('chat message', {
        user: 'System',
        text: `${socket.username} left ${socket.room}`,
        time: new Date().toLocaleTimeString()
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));