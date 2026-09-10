const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const compression = require('compression');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Performance Optimization Middleware: Enable Gzip Compression
app.use(compression());

// Security & Caching Headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    if (req.method === 'GET' && (req.path.startsWith('/uploads') || req.path.endsWith('.png') || req.path.endsWith('.jpg') || req.path.endsWith('.svg'))) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    next();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static('uploads'));

// XML Sitemap Route
app.get('/sitemap.xml', (req, res) => {
    res.header('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://mehfilone.com/</loc>
    <lastmod>2026-09-10</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://mehfilone.com/all-venues</loc>
    <lastmod>2026-09-10</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://mehfilone.com/resources/marriage-halls</loc>
    <lastmod>2026-09-10</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://mehfilone.com/resources/party-halls</loc>
    <lastmod>2026-09-10</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://mehfilone.com/terms</loc>
    <lastmod>2026-09-10</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://mehfilone.com/policy</loc>
    <lastmod>2026-09-10</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`);
});

// Robots.txt Route
app.get('/robots.txt', (req, res) => {
    res.header('Content-Type', 'text/plain');
    res.send(`User-agent: *\nAllow: /\nDisallow: /9fe66b121b3e4c9cabe51b36d5bbcaed/\nDisallow: /vendor/dashboard\nSitemap: https://mehfilone.com/sitemap.xml`);
});

// Routes
app.use('/api', require('./routes/index'));

app.get('/', (req, res) => {
    res.send('MEHFIL ONE API is running...');
});

const PORT = process.env.PORT || 5000;

const http = require('http');
const server = http.createServer(app);

// Initialize Socket.io
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*", // Or specific origin
    methods: ["GET", "POST"]
  }
});

// Socket.io logic
const onlineUsers = new Map(); // userId -> Set of socket.id

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join a personal room based on userId or vendorId
    socket.on('join', (userId) => {
        if(userId) {
            socket.join(userId);
            socket.userId = userId;
            if(!onlineUsers.has(userId)) {
                onlineUsers.set(userId, new Set());
            }
            onlineUsers.get(userId).add(socket.id);
            console.log(`User ${userId} joined their room`);
            
            // Broadcast that this user is online
            io.emit('userStatus', { userId, status: 'online' });
        }
    });

    // Check if a specific user is online
    socket.on('checkUserStatus', (targetUserId, callback) => {
        if (typeof callback === 'function') {
            const isOnline = onlineUsers.has(targetUserId);
            callback({ status: isOnline ? 'online' : 'offline' });
        }
    });

    // Mark a specific message as read
    socket.on('readMessage', async ({ messageId, senderId }) => {
        try {
            const Message = require('./models/Message');
            const msg = await Message.findByIdAndUpdate(messageId, { $set: { read: true, delivered: true } }, { new: true });
            if (msg) {
                io.to(msg.sender).emit('messageStatusUpdate', { messageId, read: true, delivered: true });
                io.to(msg.receiver).emit('messageStatusUpdate', { messageId, read: true, delivered: true });
            }
        } catch (e) {
            console.error("Error updating read status:", e);
        }
    });

    // Mark all messages from a specific sender as read
    socket.on('markAllRead', async ({ senderId, receiverId }) => {
        try {
            const Message = require('./models/Message');
            await Message.updateMany(
                { sender: senderId, receiver: receiverId, read: false },
                { $set: { read: true, delivered: true } }
            );
            io.to(senderId).emit('allMessagesRead', { readerId: receiverId, senderId });
            io.to(receiverId).emit('allMessagesRead', { readerId: receiverId, senderId });
        } catch (e) {
            console.error("Error marking all read:", e);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.userId) {
            const sockets = onlineUsers.get(socket.userId);
            if (sockets) {
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    onlineUsers.delete(socket.userId);
                    // Broadcast that this user went offline
                    io.emit('userStatus', { userId: socket.userId, status: 'offline' });
                }
            }
        }
    });
});

// Make io accessible to our router/controllers
app.set('io', io);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
