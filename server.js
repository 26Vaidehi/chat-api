require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(express.json());
app.use(express.static('public'));

// ── MongoDB ─────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch((err) => console.log('MongoDB connection error:', err));

// ── User Schema ─────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ── Message Schema ──────────────────────────────────────────────
const messageSchema = new mongoose.Schema({
    room:     { type: String, required: true },
    username: { type: String, required: true },
    message:  { type: String, required: true },
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

// ── Middleware ──────────────────────────────────────────────────
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

// ── HTTP Routes ─────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({ message: 'Chat API is running!' });
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ error: 'Username and password required' });
    const userExists = await User.findOne({ username });
    if (userExists)
        return res.status(400).json({ error: 'Username already taken' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: `User ${username} registered successfully` });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ error: 'Username and password required' });
    const user = await User.findOne({ username });
    if (!user)
        return res.status(400).json({ error: 'User not found' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
        return res.status(400).json({ error: 'Invalid password' });
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ message: 'Login successful', token });
});

app.get('/profile', authenticateToken, (req, res) => {
    res.json({ message: `Welcome ${req.user.username}!`, user: req.user });
});

// ── Get message history for a room ─────────────────────────────
app.get('/messages/:room', authenticateToken, async (req, res) => {
    const messages = await Message.find({ room: req.params.room })
        .sort({ createdAt: 1 })
        .limit(50);
    res.json({ messages });
});

// ── Socket.io ───────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // User joins a room
    socket.on('joinRoom', ({ username, room }) => {
        socket.join(room);
        socket.username = username;
        socket.room = room;
        console.log(`${username} joined room: ${room}`);

        // Notify everyone in room
        io.to(room).emit('message', {
            username: 'System',
            message: `${username} has joined the room`,
            room,
        });
    });

    // User sends a message
    socket.on('sendMessage', async ({ message }) => {
        const { username, room } = socket;

        // Save to MongoDB
        const newMessage = new Message({ room, username, message });
        await newMessage.save();

        // Broadcast to everyone in the room
        io.to(room).emit('message', { username, message, room });
    });

    // User disconnects
    socket.on('disconnect', () => {
        if (socket.username && socket.room) {
            io.to(socket.room).emit('message', {
                username: 'System',
                message: `${socket.username} has left the room`,
                room: socket.room,
            });
        }
        console.log(`User disconnected: ${socket.id}`);
    });
});

// ── Start Server ────────────────────────────────────────────────
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});