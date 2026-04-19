// const express = require('express');
// const http = require('http');
// const WebSocket = require('ws');
// const path = require('path');

// const app = express();
// const server = http.createServer(app);
// const wss = new WebSocket.Server({ server });

// // Serve the HTML file to anyone who visits the URL
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'index.html'));
// });

// // WebSocket connection handling
// wss.on('connection', (ws) => {
//     console.log('New client connected!');

//     ws.on('message', (message) => {
//         // Broadcast the incoming binary frame to all OTHER connected clients
//         wss.clients.forEach((client) => {
//             if (client !== ws && client.readyState === WebSocket.OPEN) {
//                 client.send(message);
//             }
//         });
//     });

//     ws.on('close', () => {
//         console.log('Client disconnected');
//     });
// });

// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//     console.log(`Server listening on port ${PORT}`);
// }); 






const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Heartbeat function to verify client is still there
function heartbeat() {
    this.isAlive = true;
}

wss.on('connection', (ws) => {
    console.log('New client connected!');
    
    // Initialize heartbeat status
    ws.isAlive = true;
    ws.on('pong', heartbeat);

    ws.on('message', (message, isBinary) => {
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                // Ensure the binary flag is passed
                client.send(message, { binary: isBinary || true });
            }
        });
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Ping all clients every 30 seconds to prevent Render from dropping the connection
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => {
    clearInterval(interval);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});