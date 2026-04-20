const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const { listRecordings, deleteS3Object } = require('../services/s3Service');

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

// NEW: Delete S3 Recording and DB Log
router.delete('/recordings', async (req, res) => {
    const { fileUrl } = req.body;
    
    try {
        // Extract the raw S3 Key from the full URL
        const urlParts = fileUrl.split('.amazonaws.com/');
        if (urlParts.length !== 2) {
            return res.status(400).json({ success: false, message: 'Invalid S3 URL' });
        }
        
        const s3Key = urlParts[1];
        
        // 1. Permanently delete from AWS S3
        const s3Success = await deleteS3Object(s3Key);
        
        if (s3Success) {
            // 2. Remove the corresponding log from MongoDB Event collection
            await Event.deleteOne({ mediaUrl: fileUrl });
            res.json({ success: true, message: 'Archive deleted successfully' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to delete from AWS S3' });
        }
    } catch (err) {
        console.error("Delete Route Error:", err);
        res.status(500).json({ success: false, message: 'Server error during deletion' });
    }
});


module.exports = router;