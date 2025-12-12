// State
let selectedFiles = [];
let currentTransferCode = null;

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const sendSection = document.getElementById('sendSection');
const receiveSection = document.getElementById('receiveSection');
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const selectedFilesDiv = document.getElementById('selectedFiles');
const uploadBtn = document.getElementById('uploadBtn');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const transferCodeDisplay = document.getElementById('transferCodeDisplay');
const generatedCode = document.getElementById('generatedCode');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const deleteTransferBtn = document.getElementById('deleteTransferBtn');
const newTransferBtn = document.getElementById('newTransferBtn');
const codeInput = document.getElementById('codeInput');
const fetchFilesBtn = document.getElementById('fetchFilesBtn');
const availableFiles = document.getElementById('availableFiles');
const filesList = document.getElementById('filesList');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const errorMessage = document.getElementById('errorMessage');
const toast = document.getElementById('toast');

// Tab switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const tab = btn.dataset.tab;
        if (tab === 'send') {
            sendSection.classList.add('active');
            receiveSection.classList.remove('active');
        } else {
            receiveSection.classList.add('active');
            sendSection.classList.remove('active');
        }
    });
});

// File upload handling
uploadZone.addEventListener('click', () => fileInput.click());

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
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    for (const file of files) {
        if (file.size > 500 * 1024 * 1024) {
            showToast(`${file.name} is too large (max 500MB)`, 'error');
            continue;
        }
        if (selectedFiles.length >= 10) {
            showToast('Maximum 10 files allowed', 'error');
            break;
        }
        if (!selectedFiles.find(f => f.name === file.name)) {
            selectedFiles.push(file);
        }
    }
    renderSelectedFiles();
}

function renderSelectedFiles() {
    if (selectedFiles.length === 0) {
        selectedFilesDiv.innerHTML = '';
        uploadBtn.style.display = 'none';
        return;
    }

    selectedFilesDiv.innerHTML = selectedFiles.map((file, index) => `
        <div class="file-item">
            <span class="file-icon">${getFileIcon(file.type)}</span>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <button class="file-remove" onclick="removeFile(${index})">✕</button>
        </div>
    `).join('');

    uploadBtn.style.display = 'flex';
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderSelectedFiles();
}

// Upload files
uploadBtn.addEventListener('click', uploadFiles);

async function uploadFiles() {
    if (selectedFiles.length === 0) return;

    uploadBtn.style.display = 'none';
    uploadProgress.style.display = 'block';

    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('files', file);
    });

    try {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                progressFill.style.width = percent + '%';
                progressText.textContent = `Uploading... ${percent}%`;
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                currentTransferCode = response.transferCode;
                generatedCode.textContent = response.transferCode;
                
                uploadProgress.style.display = 'none';
                uploadZone.style.display = 'none';
                selectedFilesDiv.innerHTML = '';
                transferCodeDisplay.style.display = 'block';
                
                showToast('Files uploaded successfully!', 'success');
            } else {
                throw new Error('Upload failed');
            }
        };

        xhr.onerror = () => {
            showToast('Upload failed. Please try again.', 'error');
            resetUploadUI();
        };

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
    } catch (error) {
        showToast('Upload failed. Please try again.', 'error');
        resetUploadUI();
    }
}

function resetUploadUI() {
    uploadProgress.style.display = 'none';
    progressFill.style.width = '0%';
    uploadBtn.style.display = selectedFiles.length > 0 ? 'flex' : 'none';
}

// Copy transfer code
copyCodeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentTransferCode);
    showToast('Code copied to clipboard!', 'success');
});

// Delete transfer
deleteTransferBtn.addEventListener('click', async () => {
    if (!currentTransferCode) return;
    
    try {
        const response = await fetch(`/api/files/${currentTransferCode}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('Transfer deleted', 'success');
            resetToNewTransfer();
        }
    } catch (error) {
        showToast('Failed to delete transfer', 'error');
    }
});

// New transfer
newTransferBtn.addEventListener('click', resetToNewTransfer);

function resetToNewTransfer() {
    selectedFiles = [];
    currentTransferCode = null;
    transferCodeDisplay.style.display = 'none';
    uploadZone.style.display = 'block';
    selectedFilesDiv.innerHTML = '';
    uploadBtn.style.display = 'none';
}

// Receive files
codeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
});

fetchFilesBtn.addEventListener('click', fetchFiles);
codeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') fetchFiles();
});

async function fetchFiles() {
    const code = codeInput.value.trim().toUpperCase();
    
    if (code.length !== 6) {
        showError('Please enter a valid 6-digit code');
        return;
    }

    try {
        const response = await fetch(`/api/files/${code}`);
        const data = await response.json();

        if (!response.ok) {
            showError(data.error || 'Transfer not found');
            availableFiles.style.display = 'none';
            return;
        }

        errorMessage.style.display = 'none';
        renderAvailableFiles(code, data.files);
        availableFiles.style.display = 'block';
    } catch (error) {
        showError('Failed to fetch files. Please try again.');
    }
}

function renderAvailableFiles(code, files) {
    filesList.innerHTML = files.map((file, index) => `
        <div class="download-item">
            <span class="file-icon">${getFileIcon(file.type)}</span>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <button class="download-btn" onclick="downloadFile('${code}', ${index}, '${file.name}')">
                ⬇️ Download
            </button>
        </div>
    `).join('');

    // Store code for download all
    downloadAllBtn.onclick = () => downloadAllFiles(code, files);
}

function downloadFile(code, index, filename) {
    const link = document.createElement('a');
    link.href = `/api/download/${code}/${index}`;
    link.download = filename;
    link.click();
    showToast(`Downloading ${filename}`, 'success');
}

function downloadAllFiles(code, files) {
    files.forEach((file, index) => {
        setTimeout(() => {
            downloadFile(code, index, file.name);
        }, index * 500); // Stagger downloads
    });
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

// Utility functions
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
    if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return '📦';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('sheet')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📽️';
    return '📄';
}

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
