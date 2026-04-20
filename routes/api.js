const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const { listRecordings } = require('../services/s3Service');

router.get('/events', async (req, res) => {
    try {
        const events = await Event.find()
            .sort({ timestamp: -1 })
            .limit(50);
        res.json({ success: true, data: events });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch timeline.' });
    }
});

router.post('/log-event', async (req, res) => {
    const { type, description, mediaUrl } = req.body;
    try {
        const newEvent = await Event.create({ type, description, mediaUrl });
        res.json({ success: true, data: newEvent });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// NEW: Fetch S3 Recordings
router.get('/recordings', async (req, res) => {
    try {
        const recordings = await listRecordings();
        res.json({ success: true, data: recordings });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch S3 recordings.' });
    }
});

module.exports = router;