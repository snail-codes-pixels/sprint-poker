const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/dist')));

const rooms = {};

const SCALES = {
  fibonacci: ['0', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕']
};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function computeStats(votes) {
  const allVotes = Object.values(votes).filter(Boolean);
  if (!allVotes.length) return null;

  const NUMERIC_MAP = { XS:1, S:2, M:3, L:5, XL:8, XXL:13 };
  const numeric = allVotes
    .map(v => NUMERIC_MAP[v] ?? parseFloat(v))
    .filter(v => !isNaN(v));

  const distribution = {};
  allVotes.forEach(v => { distribution[v] = (distribution[v] || 0) + 1; });

  if (!numeric.length) return { distribution, avg: null, median: null, min: null, max: null, agreement: 'N/A', consensus: false };

  const sorted = [...numeric].sort((a, b) => a - b);
  const avg = Math.round((sorted.reduce((a,b)=>a+b,0) / sorted.length) * 10) / 10;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid-1]+sorted[mid])/2 : sorted[mid];
  const min = sorted[0], max = sorted[sorted.length - 1];
  const unique = [...new Set(numeric)];
  const agreement = unique.length === 1 ? 'High' : (max - min <= 2 ? 'Medium' : 'Low');

  return { distribution, avg, median, min, max, agreement, consensus: unique.length === 1 };
}

function sanitizeRoom(room) {
  const currentStory = room.stories[room.currentStoryIndex];
  return {
    id: room.id,
    code: room.code,
    scale: room.scale,
    scaleValues: SCALES[room.scale],
    stories: room.stories.map((s, i) => ({
      ...s,
      votes: (room.phase === 'revealed' && i === room.currentStoryIndex)
        ? s.votes
        : Object.fromEntries(Object.entries(s.votes).map(([pid, v]) => [pid, v ? true : null]))
    })),
    currentStoryIndex: room.currentStoryIndex,
    phase: room.phase,
    players: Object.values(room.players).map(p => ({
      id: p.id, name: p.name, avatar: p.avatar||'🐱', isHost: p.isHost, connected: p.connected,
      hasVoted: !!(currentStory?.votes[p.id])
    }))
  };
}

// Create room
app.post('/api/rooms', (req, res) => {
  const { hostName, scale = 'fibonacci', stories = [] } = req.body;
  if (!hostName) return res.status(400).json({ error: 'hostName required' });

  const id = uuidv4(), code = generateCode(), hostToken = uuidv4(), hostId = uuidv4();
  rooms[code] = {
    id, code, hostToken, scale,
    stories: stories.map(s => ({ id: uuidv4(), title: s.title||'Untitled', storyId: s.storyId||'', link: s.link||'', finalPoint: null, votes: {} })),
    currentStoryIndex: 0, phase: 'waiting',
    players: { [hostId]: { id: hostId, name: hostName, avatar: req.body.hostAvatar||"🐱", socketId: null, isHost: true, connected: false } }
  };
  res.json({ roomCode: code, playerId: hostId, hostToken });
});

// Join room
app.post('/api/rooms/:code/join', (req, res) => {
  const room = rooms[req.params.code.toUpperCase()];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const { playerName, playerId: existing } = req.body;
  if (existing && room.players[existing]) return res.json({ roomCode: room.code, playerId: existing });
  const playerId = uuidv4();
  room.players[playerId] = { id: playerId, name: playerName||"Anonymous", avatar: req.body.playerAvatar||"🐶", socketId: null, isHost: false, connected: false };
  res.json({ roomCode: room.code, playerId });
});

// Add stories
app.post('/api/rooms/:code/stories', (req, res) => {
  const room = rooms[req.params.code.toUpperCase()];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.hostToken !== req.body.hostToken) return res.status(403).json({ error: 'Not host' });
  req.body.stories.forEach(s => room.stories.push({ id: uuidv4(), title: s.title||'Untitled', storyId: s.storyId||'', link: s.link||'', finalPoint: null, votes: {} }));
  io.to(room.code).emit('room_updated', sanitizeRoom(room));
  res.json({ stories: room.stories });
});

// Get room
app.get('/api/rooms/:code', (req, res) => {
  const room = rooms[req.params.code.toUpperCase()];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(sanitizeRoom(room));
});

// Socket.io
io.on('connection', (socket) => {
  socket.on('join_room', ({ roomCode, playerId }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[playerId]) return socket.emit('error', { message: 'Invalid room/player' });
    room.players[playerId].socketId = socket.id;
    room.players[playerId].connected = true;
    socket.join(roomCode);
    socket.data = { roomCode, playerId };
    io.to(roomCode).emit('room_updated', sanitizeRoom(room));
  });

  socket.on('vote', ({ roomCode, playerId, value }) => {
    const room = rooms[roomCode];
    if (!room || room.phase !== 'voting') return;
    const story = room.stories[room.currentStoryIndex];
    if (story) { story.votes[playerId] = value; io.to(roomCode).emit('room_updated', sanitizeRoom(room)); }
  });

  socket.on('start_round', ({ roomCode, hostToken }) => {
    const room = rooms[roomCode];
    if (!room || room.hostToken !== hostToken) return;
    room.phase = 'voting';
    const s = room.stories[room.currentStoryIndex]; if (s) s.votes = {};
    io.to(roomCode).emit('room_updated', sanitizeRoom(room));
    io.to(roomCode).emit('stats', null);
  });

  socket.on('reveal_votes', ({ roomCode, hostToken }) => {
    const room = rooms[roomCode];
    if (!room || room.hostToken !== hostToken) return;
    room.phase = 'revealed';
    const s = room.stories[room.currentStoryIndex];
    const stats = s ? computeStats(s.votes) : null;
    io.to(roomCode).emit('room_updated', sanitizeRoom(room));
    io.to(roomCode).emit('stats', stats);
  });

  socket.on('revote', ({ roomCode, hostToken }) => {
    const room = rooms[roomCode];
    if (!room || room.hostToken !== hostToken) return;
    const s = room.stories[room.currentStoryIndex]; if (s) s.votes = {};
    room.phase = 'voting';
    io.to(roomCode).emit('room_updated', sanitizeRoom(room));
    io.to(roomCode).emit('stats', null);
  });

  socket.on('set_final_point', ({ roomCode, hostToken, storyIndex, value }) => {
    const room = rooms[roomCode];
    if (!room || room.hostToken !== hostToken) return;
    if (room.stories[storyIndex]) room.stories[storyIndex].finalPoint = value;
    io.to(roomCode).emit('room_updated', sanitizeRoom(room));
  });

  socket.on('navigate_story', ({ roomCode, hostToken, index }) => {
    const room = rooms[roomCode];
    if (!room || room.hostToken !== hostToken) return;
    if (index >= 0 && index < room.stories.length) {
      room.currentStoryIndex = index; room.phase = 'voting'; room.stories[index].votes = {};
    }
    io.to(roomCode).emit('room_updated', sanitizeRoom(room));
    io.to(roomCode).emit('stats', null);
  });

  socket.on('disconnect', () => {
    const { roomCode, playerId } = socket.data || {};
    if (roomCode && playerId && rooms[roomCode]?.players[playerId]) {
      rooms[roomCode].players[playerId].connected = false;
      io.to(roomCode).emit('room_updated', sanitizeRoom(rooms[roomCode]));
    }
  });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'client/dist/index.html')));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🃏 Planning Poker → http://localhost:${PORT}`));
