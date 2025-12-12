// Socket.io connection with reconnection options
const socket = io({
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['websocket', 'polling']
});

// WebRTC configuration with multiple STUN/TURN servers for better connectivity
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.stunprotocol.org:3478' }
    ],
    iceCandidatePoolSize: 10
};

// ICE candidate queue for handling candidates before remote description is set
let pendingIceCandidates = [];

// Application state
let peerConnection = null;
let dataChannel = null;
let roomCode = null;
let isHost = false;
let fileQueue = [];
let activeTransfers = new Map();
let transferHistory = [];

// DOM elements
const setupSection = document.getElementById('setupSection');
const roomCodeSection = document.getElementById('roomCodeSection');
const joinSection = document.getElementById('joinSection');
const transferSection = document.getElementById('transferSection');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const roomCodeInput = document.getElementById('roomCodeInput');
const fileInput = document.getElementById('fileInput');
const uploadZone = document.getElementById('uploadZone');
const fileQueueDiv = document.getElementById('fileQueue');
const activeTransfersDiv = document.getElementById('activeTransfers');
const transferHistoryDiv = document.getElementById('transferHistory');

// Buttons
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const connectBtn = document.getElementById('connectBtn');
const backBtn = document.getElementById('backBtn');
const disconnectBtn = document.getElementById('disconnectBtn');

// Initialize
init();

function init() {
    setupEventListeners();
    setupSocketListeners();
}

// Event Listeners
function setupEventListeners() {
    createRoomBtn.addEventListener('click', createRoom);
    joinRoomBtn.addEventListener('click', showJoinSection);
    copyCodeBtn.addEventListener('click', copyRoomCode);
    connectBtn.addEventListener('click', joinRoom);
    backBtn.addEventListener('click', () => showSection('setupSection'));
    disconnectBtn.addEventListener('click', disconnect);
    
    // File upload
    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        queueFiles(files);
    });

    // Room code input formatting
    roomCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });
}

// Socket.io listeners
function setupSocketListeners() {
    socket.on('connect', () => {
        updateStatus('connected', 'Connected to server');
    });

    socket.on('disconnect', () => {
        updateStatus('disconnected', 'Disconnected from server');
    });

    socket.on('room-created', (data) => {
        roomCode = data.roomCode;
        isHost = true;
        roomCodeDisplay.textContent = roomCode;
        showSection('roomCodeSection');
        updateStatus('connecting', 'Waiting for peer...');
    });

    socket.on('room-joined', (data) => {
        roomCode = data.roomCode;
        isHost = false;
        updateStatus('connecting', 'Establishing connection...');
    });

    socket.on('peer-joined', (data) => {
        showSuccess('Peer joined! Establishing connection...');
        pendingIceCandidates = [];
        createPeerConnection();
        createOffer();
    });

    socket.on('offer', async (data) => {
        try {
            pendingIceCandidates = [];
            createPeerConnection();
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            
            // Process any pending ICE candidates
            for (const candidate of pendingIceCandidates) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
            pendingIceCandidates = [];
            
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('answer', { answer, roomCode });
        } catch (error) {
            console.error('Error handling offer:', error);
            showError('Connection failed. Please try again.');
        }
    });

    socket.on('answer', async (data) => {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            
            // Process any pending ICE candidates
            for (const candidate of pendingIceCandidates) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
            pendingIceCandidates = [];
        } catch (error) {
            console.error('Error handling answer:', error);
            showError('Connection failed. Please try again.');
        }
    });

    socket.on('ice-candidate', async (data) => {
        if (!data.candidate) return;
        
        try {
            if (peerConnection && peerConnection.remoteDescription) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } else {
                // Queue the candidate if remote description isn't set yet
                pendingIceCandidates.push(data.candidate);
            }
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    });

    socket.on('peer-disconnected', () => {
        showError('Peer disconnected');
        disconnect();
    });

    socket.on('error', (data) => {
        showError(data.message);
    });
}

// WebRTC functions
function createPeerConnection() {
    // Clean up existing connection
    if (peerConnection) {
        peerConnection.close();
    }
    
    peerConnection = new RTCPeerConnection(rtcConfig);

    // ICE candidate handling
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                candidate: event.candidate,
                roomCode
            });
        }
    };

    peerConnection.onicecandidateerror = (event) => {
        console.error('ICE candidate error:', event);
    };

    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
        
        if (peerConnection.iceConnectionState === 'failed') {
            console.log('ICE connection failed, attempting restart...');
            peerConnection.restartIce();
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        
        if (peerConnection.connectionState === 'connected') {
            updateStatus('connected', 'Peer connected');
            showSection('transferSection');
            showSuccess('Connected! You can now transfer files.');
        } else if (peerConnection.connectionState === 'disconnected') {
            updateStatus('connecting', 'Reconnecting...');
            showError('Connection interrupted. Attempting to reconnect...');
        } else if (peerConnection.connectionState === 'failed') {
            showError('Connection failed. Please try again.');
            disconnect();
        }
    };

    // Data channel for file transfer
    if (isHost) {
        dataChannel = peerConnection.createDataChannel('fileTransfer', {
            ordered: true
        });
        setupDataChannel();
    } else {
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel();
        };
    }
}

function setupDataChannel() {
    dataChannel.binaryType = 'arraybuffer';

    dataChannel.onopen = () => {
        console.log('Data channel opened');
        processFileQueue();
    };

    dataChannel.onclose = () => {
        console.log('Data channel closed');
    };

    dataChannel.onmessage = (event) => {
        handleIncomingData(event.data);
    };

    dataChannel.onerror = (error) => {
        console.error('Data channel error:', error);
        showError('Data channel error occurred');
    };
}

async function createOffer() {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', { offer, roomCode });
}

// File handling
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    queueFiles(files);
    event.target.value = '';
}

function queueFiles(files) {
    files.forEach(file => {
        const fileId = generateId();
        const fileData = {
            id: fileId,
            file: file,
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'queued'
        };
        fileQueue.push(fileData);
        renderFileQueue();
    });

    if (dataChannel && dataChannel.readyState === 'open') {
        processFileQueue();
    }
}

function renderFileQueue() {
    fileQueueDiv.innerHTML = '';
    
    fileQueue.forEach(fileData => {
        const fileItem = createFileElement(fileData);
        fileQueueDiv.appendChild(fileItem);
    });
}

function createFileElement(fileData, isReceiving = false) {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.id = `file-${fileData.id}`;

    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = getFileIcon(fileData.type || fileData.name);

    const info = document.createElement('div');
    info.className = 'file-info';

    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = fileData.name;

    const size = document.createElement('div');
    size.className = 'file-size';
    size.textContent = formatFileSize(fileData.size);

    info.appendChild(name);
    info.appendChild(size);

    if (fileData.status === 'sending' || fileData.status === 'receiving') {
        const progress = document.createElement('div');
        progress.className = 'file-progress';
        const bar = document.createElement('div');
        bar.className = 'progress-bar';
        bar.style.width = '0%';
        progress.appendChild(bar);
        info.appendChild(progress);

        const status = document.createElement('div');
        status.className = 'file-status';
        status.innerHTML = `<span>${fileData.status === 'sending' ? '📤' : '📥'}</span> <span id="status-${fileData.id}">0%</span>`;
        info.appendChild(status);
    }

    const actions = document.createElement('div');
    actions.className = 'file-actions';

    if (fileData.status === 'queued' && !isReceiving) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove';
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = () => removeFromQueue(fileData.id);
        actions.appendChild(removeBtn);
    }

    div.appendChild(icon);
    div.appendChild(info);
    div.appendChild(actions);

    return div;
}

function processFileQueue() {
    if (fileQueue.length === 0 || !dataChannel || dataChannel.readyState !== 'open') {
        return;
    }

    const fileData = fileQueue.shift();
    sendFile(fileData);
    renderFileQueue();
}

// File transfer
const CHUNK_SIZE = 16384; // 16KB chunks
let currentReceive = null;

async function sendFile(fileData) {
    fileData.status = 'sending';
    
    const fileElement = createFileElement(fileData);
    activeTransfersDiv.appendChild(fileElement);

    // Send file metadata
    const metadata = {
        type: 'metadata',
        id: fileData.id,
        name: fileData.name,
        size: fileData.size,
        fileType: fileData.type
    };
    
    dataChannel.send(JSON.stringify(metadata));

    // Read and send file in chunks
    const file = fileData.file;
    let offset = 0;
    const reader = new FileReader();

    reader.onload = (e) => {
        if (dataChannel.readyState === 'open') {
            dataChannel.send(e.target.result);
            offset += e.target.result.byteLength;

            const progress = (offset / file.size) * 100;
            updateFileProgress(fileData.id, progress);

            if (offset < file.size) {
                readSlice(offset);
            } else {
                // File send complete
                const completeMsg = {
                    type: 'complete',
                    id: fileData.id
                };
                dataChannel.send(JSON.stringify(completeMsg));
                
                fileData.status = 'completed';
                transferHistory.push(fileData);
                
                setTimeout(() => {
                    document.getElementById(`file-${fileData.id}`)?.remove();
                    renderTransferHistory();
                    processFileQueue(); // Process next file
                }, 1000);
                
                showSuccess(`${fileData.name} sent successfully!`);
            }
        }
    };

    const readSlice = (o) => {
        const slice = file.slice(o, o + CHUNK_SIZE);
        reader.readAsArrayBuffer(slice);
    };

    readSlice(0);
}

function handleIncomingData(data) {
    if (typeof data === 'string') {
        const message = JSON.parse(data);
        
        if (message.type === 'metadata') {
            // New file incoming
            currentReceive = {
                id: message.id,
                name: message.name,
                size: message.size,
                type: message.fileType,
                data: [],
                receivedSize: 0,
                status: 'receiving'
            };
            
            const fileElement = createFileElement(currentReceive, true);
            activeTransfersDiv.appendChild(fileElement);
            
        } else if (message.type === 'complete') {
            // File receive complete
            if (currentReceive && currentReceive.id === message.id) {
                const blob = new Blob(currentReceive.data, { type: currentReceive.type });
                const url = URL.createObjectURL(blob);
                
                currentReceive.status = 'completed';
                currentReceive.url = url;
                transferHistory.push(currentReceive);
                
                setTimeout(() => {
                    document.getElementById(`file-${currentReceive.id}`)?.remove();
                    renderTransferHistory();
                }, 1000);
                
                showSuccess(`${currentReceive.name} received successfully!`);
                currentReceive = null;
            }
        }
    } else {
        // Binary data (file chunk)
        if (currentReceive) {
            currentReceive.data.push(data);
            currentReceive.receivedSize += data.byteLength;
            
            const progress = (currentReceive.receivedSize / currentReceive.size) * 100;
            updateFileProgress(currentReceive.id, progress);
        }
    }
}

function updateFileProgress(fileId, progress) {
    const progressBar = document.querySelector(`#file-${fileId} .progress-bar`);
    const statusText = document.getElementById(`status-${fileId}`);
    
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
    
    if (statusText) {
        statusText.textContent = `${Math.round(progress)}%`;
    }
}

function renderTransferHistory() {
    if (transferHistory.length === 0) return;

    transferHistoryDiv.innerHTML = '<h3 style="margin-bottom: 15px; color: var(--text-secondary);">Transfer History</h3>';
    
    transferHistory.forEach(fileData => {
        const div = document.createElement('div');
        div.className = 'file-item';

        const icon = document.createElement('span');
        icon.className = 'file-icon';
        icon.textContent = getFileIcon(fileData.type || fileData.name);

        const info = document.createElement('div');
        info.className = 'file-info';

        const name = document.createElement('div');
        name.className = 'file-name';
        name.textContent = fileData.name;

        const size = document.createElement('div');
        size.className = 'file-size';
        size.textContent = formatFileSize(fileData.size);

        info.appendChild(name);
        info.appendChild(size);

        const actions = document.createElement('div');
        actions.className = 'file-actions';

        if (fileData.url) {
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'btn-download';
            downloadBtn.textContent = '⬇ Download';
            downloadBtn.onclick = () => downloadFile(fileData);
            actions.appendChild(downloadBtn);
        } else {
            const status = document.createElement('span');
            status.style.color = 'var(--success-color)';
            status.textContent = '✓ Sent';
            actions.appendChild(status);
        }

        div.appendChild(icon);
        div.appendChild(info);
        div.appendChild(actions);

        transferHistoryDiv.appendChild(div);
    });
}

function downloadFile(fileData) {
    const a = document.createElement('a');
    a.href = fileData.url;
    a.download = fileData.name;
    a.click();
}

function removeFromQueue(fileId) {
    fileQueue = fileQueue.filter(f => f.id !== fileId);
    renderFileQueue();
}

// UI functions
function createRoom() {
    socket.emit('create-room');
}

function showJoinSection() {
    showSection('joinSection');
}

function joinRoom() {
    const code = roomCodeInput.value.trim().toUpperCase();
    
    if (code.length !== 6) {
        showError('Please enter a valid 6-digit room code');
        return;
    }
    
    socket.emit('join-room', code);
}

function disconnect() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    if (dataChannel) {
        dataChannel.close();
        dataChannel = null;
    }
    
    roomCode = null;
    isHost = false;
    fileQueue = [];
    activeTransfers.clear();
    transferHistory = [];
    
    fileQueueDiv.innerHTML = '';
    activeTransfersDiv.innerHTML = '';
    transferHistoryDiv.innerHTML = '';
    roomCodeInput.value = '';
    
    showSection('setupSection');
    updateStatus('connected', 'Connected to server');
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

function updateStatus(status, text) {
    statusIndicator.className = `status-indicator ${status}`;
    statusText.textContent = text;
}

function copyRoomCode() {
    navigator.clipboard.writeText(roomCode).then(() => {
        showSuccess('Room code copied to clipboard!');
    });
}

function showError(message) {
    const toast = document.getElementById('errorToast');
    const messageEl = document.getElementById('errorMessage');
    messageEl.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showSuccess(message) {
    const toast = document.getElementById('successToast');
    const messageEl = document.getElementById('successMessage');
    messageEl.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Utility functions
function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function getFileIcon(type) {
    if (!type) return '📄';
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎥';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📕';
    if (type.includes('zip') || type.includes('rar')) return '📦';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('sheet')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📽️';
    return '📄';
}
