const mongoose = require('mongoose');
// Placeholder for Phase 2: AI Events, Motion Detects, and Video Logs
const eventSchema = new mongoose.Schema({
    type: { type: String, enum: ['MOTION', 'FACE_KNOWN', 'FACE_UNKNOWN', 'SYSTEM'] },
    description: String,
    timestamp: { type: Date, default: Date.now },
    mediaUrl: String // S3 link placeholder
});
module.exports = mongoose.model('Event', eventSchema);