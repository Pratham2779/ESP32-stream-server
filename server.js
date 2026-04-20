require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const connectDB = require('./config/db');
const setupWebSockets = require('./sockets/wsHandler');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);

connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 2, httpOnly: true } 
}));

const requireAuth = (req, res, next) => {
    if (req.session.isAuthenticated || req.path === '/login.html' || req.path.startsWith('/js/')) {
        next();
    } else {
        res.redirect('/login.html');
    }
};

app.use('/auth', authRoutes);
app.use('/api', requireAuth, apiRoutes);
app.use(requireAuth);
app.use(express.static(path.join(__dirname, 'public')));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(`[Express Error] ${err.stack}`);
    res.status(500).send('Something broke inside the server!');
});

setupWebSockets(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 SecureVision Server running on port ${PORT}`);
});

// Catch-all for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});