

const WebSocket = require('ws');
const dvrService = require('../services/dvrService');

module.exports = (server) => {
    const wss = new WebSocket.Server({ server });

    // --- HEARTBEAT MONITOR ---
    // Every 5 seconds, check the pulse of all connected clients
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                console.log('Client timed out (No heartbeat). Terminating connection.');
                // This forcefully kills the ghost connection and instantly triggers ws.on('close')
                return ws.terminate(); 
            }

            // Assume dead until they respond to the ping
            ws.isAlive = false; 
            ws.ping(); 
        });
    }, 5000); 

    wss.on('close', () => {
        clearInterval(interval);
    });

    wss.on('connection', (ws) => {
        console.log('Client/Device connected to WS');
        let isEspCamera = false;
        
        // Initial state is alive
        ws.isAlive = true; 

        // When the client responds to our ping, mark them as alive
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.on('message', (data, isBinary) => {
            if (isBinary) {
                if (!isEspCamera) {
                    isEspCamera = true;
                    // Start streaming directly to S3 when ESP32 connects
                    dvrService.startRecordingSession();
                }
                
                // Push live frame to FFmpeg -> S3
                dvrService.pushFrame(data);
            }

            // Forward frame to web dashboards
            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(data, { binary: isBinary });
                }
            });
        });

        ws.on('close', () => {
            console.log('Client/Device disconnected');
            if (isEspCamera) {
                // Stop the stream, triggering the rename process in S3 instantly
                dvrService.stopRecordingSession();
            }
        });
    });
};