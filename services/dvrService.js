const { spawn } = require('child_process');
const { streamToS3, renameS3Object } = require('./s3Service');
const Event = require('../models/Event');

let ffmpeg = null;
let isRecording = false;
let currentTempKey = '';

const formatDateStr = (date) => date.toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19);

const startRecordingSession = () => {
    if (isRecording) return;

    const startTime = new Date();
    const startStr = formatDateStr(startTime);
    const folderDate = startTime.toISOString().split('T')[0];
    
    // Using .webm for prototype stability
    currentTempKey = `recordings/${folderDate}/Streaming_${startStr}.webm`;

    console.log(`[DVR] Starting WebM Stream: ${currentTempKey}`);

    // ffmpeg = spawn('ffmpeg', [
    //     '-y',
    //     '-f', 'image2pipe',
    //     '-vcodec', 'mjpeg',
    //     '-r', '15', 
    //     '-i', '-',
    //     '-c:v', 'libvpx',    // VP8 Codec for WebM
    //     '-b:v', '1M',        // Bitrate
    //     '-deadline', 'realtime', 
    //     '-cpu-used', '4',
    //     '-f', 'webm',
    //     '-'
    // ]);
    // Change these lines in dvrService.js
ffmpeg = spawn('ffmpeg', [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', '15', 
    '-i', '-',
    '-c:v', 'libvpx',
    '-b:v', '500k',        // Lowered bitrate for cloud stability
    '-deadline', 'realtime', 
    '-cpu-used', '5',       // Increased from 4 to 5 to reduce CPU load
    '-f', 'webm',
    '-'
]);

    isRecording = true;

    streamToS3(ffmpeg.stdout, currentTempKey, 'video/webm')
        .then(async (success) => {
            if (success) {
                const endTime = new Date();
                const finalKey = `recordings/${folderDate}/${startStr}_|_${formatDateStr(endTime)}.webm`;
                
                // Force correct MIME type in S3
                const finalUrl = await renameS3Object(currentTempKey, finalKey, 'video/webm');
                
                if (finalUrl) {
                    await Event.create({
                        type: 'SYSTEM',
                        description: `CCTV Saved: ${startStr.split('_')[1]}`,
                        mediaUrl: finalUrl
                    });
                }
            }
        }).catch(err => console.error("[DVR] S3 Pipe Error:", err));

    ffmpeg.on('close', () => { isRecording = false; ffmpeg = null; });
};

const stopRecordingSession = () => {
    if (ffmpeg && isRecording) {
        ffmpeg.stdin.end();
    }
};

const pushFrame = (jpegBuffer) => {
    if (isRecording && ffmpeg?.stdin?.writable) {
        try {
            ffmpeg.stdin.write(jpegBuffer);
        } catch (e) {}
    }
};

module.exports = { startRecordingSession, stopRecordingSession, pushFrame };