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

// Login Page
app.get('/', (req, res) => {
  if (req.session.username) {
    res.sendFile(__dirname + '/public/chat.html'); // logged in
  } else {
    res.sendFile(__dirname + '/public/login.html'); // login page
  }
});

app.post('/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.redirect('/');
  req.session.username = username;
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Socket.io Chat
io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));