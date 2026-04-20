// --- Theme Logic ---
const htmlEl = document.documentElement;
const themeToggleBtn = document.getElementById('themeToggle');

if (localStorage.getItem('theme') === 'light') {
    htmlEl.classList.remove('dark');
    themeToggleBtn.innerText = '🌙';
}

themeToggleBtn.addEventListener('click', () => {
    htmlEl.classList.toggle('dark');
    const isDark = htmlEl.classList.contains('dark');
    themeToggleBtn.innerText = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// --- Auth Check ---
fetch('/auth/status').then(r => r.json()).then(data => {
    if (!data.isAuthenticated) window.location.href = '/login.html';
    document.getElementById('user-greeting').innerText = `Admin: ${data.username}`;
    if (data.username === 'admin') {
        document.getElementById('admin-panel').classList.remove('hidden');
    }
}).catch(() => window.location.href = '/login.html');

document.getElementById('logoutBtn').addEventListener('click', () => {
    fetch('/auth/logout', { method: 'POST' }).then(() => window.location.href = '/login.html');
});

// --- Modal Logic ---
const addUserModal = document.getElementById('addUserModal');
const addUserForm = document.getElementById('addUserForm');
const addUserMsg = document.getElementById('addUserMsg');

document.getElementById('btn-add-user').addEventListener('click', () => addUserModal.classList.remove('hidden'));
document.getElementById('closeUserModal').addEventListener('click', () => {
    addUserModal.classList.add('hidden');
    addUserMsg.classList.add('hidden');
    addUserForm.reset();
});

addUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch('/auth/adduser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            newUsername: e.target.newUsername.value,
            newPassword: e.target.newPassword.value
        })
    });
    const data = await res.json();
    addUserMsg.classList.remove('hidden', 'text-red-400', 'text-green-400');
    
    if (data.success) {
        addUserMsg.textContent = data.message;
        addUserMsg.classList.add('text-green-400');
        addUserForm.reset();
        setTimeout(() => {
            addUserModal.classList.add('hidden');
            addUserMsg.classList.add('hidden');
        }, 1500);
    } else {
        addUserMsg.textContent = data.message;
        addUserMsg.classList.add('text-red-400');
    }
});
// --- S3 Recordings List ---
async function loadRecordings() {
    const container = document.getElementById('recordings-list');
    try {
        const res = await fetch('/api/recordings');
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            container.innerHTML = json.data.map(rec => {
                const date = new Date(rec.lastModified).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                const parts = rec.filename.split('_|_');
                let displayTitle = parts.length > 1 ? `Session: ${parts[0].split('_')[1]}` : rec.filename;

                return `
                    <div onclick="openVideoModal(this.dataset.url, '${displayTitle}')" data-url="${rec.url}" class="group p-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-cyan-500/50 hover:shadow-lg transition-all flex items-center gap-3 relative overflow-hidden">
                        <div class="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-500 font-bold italic shrink-0">S3</div>
                        <div class="flex-1 min-w-0 pr-8">
                            <p class="text-sm font-semibold truncate">${displayTitle}</p>
                            <p class="text-[11px] text-slate-500">${date}</p>
                        </div>
                        
                        <button onclick="deleteArchive('${rec.url}', event)" class="absolute right-3 p-2 text-slate-400 hover:text-white hover:bg-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100 shadow-sm" title="Delete Archive">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>`;
            }).join('');
        }
    } catch (e) { console.error("Sync failed"); }
}

// --- Video Player Modal ---
function openVideoModal(url, filename) {
    document.getElementById('videoModalTitle').innerText = filename;
    const player = document.getElementById('cloudVideoPlayer');
    
    player.innerHTML = '';
    const source = document.createElement('source');
    source.setAttribute('src', url);
    
    // Auto-detect type based on extension
    const type = url.toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4';
    source.setAttribute('type', type);
    
    player.appendChild(source);
    document.getElementById('videoModal').classList.remove('hidden');
    
    player.load();
    player.play().catch(err => console.log("Playback interaction required"));
}

function closeVideoModal() {
    const player = document.getElementById('cloudVideoPlayer');
    player.pause();
    player.innerHTML = '';
    document.getElementById('videoModal').classList.add('hidden');
}

loadRecordings();
setInterval(loadRecordings, 60000);

// --- WebSocket Live Stream Setup ---
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}`;
const ws = new WebSocket(wsUrl);

const imgEl = document.getElementById('video-stream');
const waitingUi = document.getElementById('waiting-ui');
const connDot = document.getElementById('conn-dot');
const connPing = document.getElementById('conn-ping');
const liveBadge = document.getElementById('live-badge');

let framesThisSecond = 0;
let flashState = false;
let isPlaying = true;
let recording = false;
let mediaRecorder;
let recordedChunks = [];
let lastPingTime = 0;

setInterval(() => {
    document.getElementById('met-fps').innerText = framesThisSecond;
    framesThisSecond = 0;
}, 1000);

ws.onopen = () => {
    connDot.className = 'relative inline-flex rounded-full h-3 w-3 bg-green-500 shadow-[0_0_10px_#22c55e]';
    connPing.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75';
    lastPingTime = performance.now();
    ws.send(JSON.stringify({ cmd: 'ping' }));
};

ws.onmessage = async (event) => {
    if (typeof event.data === 'string') {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'telemetry') {
                document.getElementById('met-wifi').innerText = data.rssi + ' dBm';
                document.getElementById('met-ram').innerText = data.heap;
                document.getElementById('met-uptime').innerText = Math.floor(data.uptime / 60000);
                document.getElementById('met-reconn').innerText = data.reconnects;
                document.getElementById('met-temp').innerText = data.temp.toFixed(1) + '°C';
                document.getElementById('met-ip').innerText = data.ip;
            }
            if (data.cmd === 'pong') {
                const latencySec = (performance.now() - lastPingTime) / 1000;
                document.getElementById('met-ping').innerText = latencySec.toFixed(3);
                setTimeout(() => { 
                    lastPingTime = performance.now();
                    ws.send(JSON.stringify({ cmd: 'ping' })); 
                }, 2000); 
            }
        } catch (e) { /* silent parse fail */ }
    } 
    else if (event.data instanceof Blob) {
        if (!isPlaying) return;
        
        framesThisSecond++;
        if (imgEl.classList.contains('hidden')) {
            imgEl.classList.remove('hidden');
            waitingUi.style.display = 'none';
            liveBadge.classList.remove('hidden');
        }
        
        if (imgEl.src) URL.revokeObjectURL(imgEl.src);
        imgEl.src = URL.createObjectURL(event.data);
        
        if(recording) {
            const canvas = document.getElementById('record-canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
            };
            img.src = imgEl.src;
        }
    }
};

ws.onclose = () => {
    connDot.className = 'relative inline-flex rounded-full h-3 w-3 bg-red-500 shadow-[0_0_10px_#ef4444]';
    connPing.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75';
    imgEl.classList.add('hidden');
    liveBadge.classList.add('hidden');
    waitingUi.style.display = 'flex';
};

// --- View Controls ---
document.getElementById('btn-stream').addEventListener('click', (e) => {
    isPlaying = !isPlaying;
    e.target.innerText = isPlaying ? "⏸ Pause Stream" : "▶ Resume Stream";
    if(!isPlaying) liveBadge.classList.add('hidden');
    else liveBadge.classList.remove('hidden');
});

document.getElementById('btn-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) imgEl.parentElement.requestFullscreen();
    else document.exitFullscreen();
});

document.getElementById('btn-zoom').addEventListener('click', () => {
    imgEl.classList.toggle('zoomed');
});

document.getElementById('btn-snapshot').addEventListener('click', () => {
    if(!imgEl.src) return;
    const a = document.createElement('a');
    a.href = imgEl.src;
    a.download = `SecureVision_Snap_${new Date().getTime()}.jpg`;
    a.click();
});

document.getElementById('btn-flashlight').addEventListener('click', (e) => {
    flashState = !flashState;
    ws.send(JSON.stringify({ cmd: 'flash', val: flashState ? 1 : 0 }));
    e.target.innerHTML = `Night Flash <span class="${flashState ? 'bg-cyan-500 text-white' : 'bg-slate-200 dark:bg-slate-900'} px-2 py-0.5 rounded text-xs transition-colors">${flashState ? 'ON' : 'OFF'}</span>`;
});

document.getElementById('select-res').addEventListener('change', (e) => {
    ws.send(JSON.stringify({ cmd: 'resolution', val: parseInt(e.target.value) }));
});

// Local Dashboard Recording Fallback
document.getElementById('btn-record').addEventListener('click', (e) => {
    const canvas = document.getElementById('record-canvas');
    const btn = e.target;
    
    if(!recording) {
        recording = true;
        btn.innerHTML = "⏹ <span class='animate-pulse text-red-500'>Recording...</span>";
        btn.classList.add('ring-2', 'ring-red-500');
        
        const stream = canvas.captureStream(15);
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        mediaRecorder.ondataavailable = ev => { if(ev.data.size > 0) recordedChunks.push(ev.data); };
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Local_Record_${new Date().getTime()}.webm`;
            a.click();
            recordedChunks = [];
        };
        mediaRecorder.start();
    } else {
        recording = false;
        btn.innerText = "Local Record";
        btn.classList.remove('ring-2', 'ring-red-500');
        mediaRecorder.stop();
    }
});



// --- S3 Deletion Logic ---
async function deleteArchive(fileUrl, event) {
    // Prevent the parent div's onclick from triggering (stops the video modal from opening)
    event.stopPropagation(); 
    
    if (!confirm("Are you sure you want to permanently delete this video from AWS and the database?")) {
        return;
    }
    
    const btn = event.currentTarget;
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '⏳'; 
    btn.disabled = true;

    try {
        const res = await fetch('/api/recordings', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileUrl })
        });
        const data = await res.json();
        
        if (data.success) {
            // Refresh the S3 list immediately to remove the deleted item
            loadRecordings(); 
        } else {
            alert("Deletion failed: " + data.message);
            btn.innerHTML = originalIcon;
            btn.disabled = false;
        }
    } catch (e) {
        console.error("Delete request failed:", e);
        alert("Error connecting to server.");
        btn.innerHTML = originalIcon;
        btn.disabled = false;
    }
}