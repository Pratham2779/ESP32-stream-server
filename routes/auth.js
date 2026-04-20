

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.isAuthenticated = true;
            req.session.user = user.username;
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

router.get('/status', (req, res) => {
    res.json({ 
        isAuthenticated: !!req.session.isAuthenticated, 
        username: req.session.user || null 
    });
});

router.post('/adduser', async (req, res) => {
    if (req.session.user !== 'admin') {
        return res.status(403).json({ success: false, message: 'Unauthorized: Admin access required.' });
    }

    const { newUsername, newPassword } = req.body;
    
    if (!newUsername || !newPassword) {
        return res.status(400).json({ success: false, message: 'Username and password required.' });
    }

    try {
        const existingUser = await User.findOne({ username: newUsername });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.create({ username: newUsername, password: hashedPassword });
        
        res.json({ success: true, message: 'User successfully created!' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error while creating user.' });
    }
});

module.exports = router;