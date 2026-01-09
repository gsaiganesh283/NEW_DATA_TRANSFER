// State
let selectedFiles = [];
let currentTransferCode = null;
let uploadType = 'files'; // 'files', 'folder', 'zip'
let folderStructure = {}; // Track folder paths
let currentTransferPassword = null; // Password for current transfer being viewed
let currentTransferFiles = []; // Files from current transfer
let selectedDestinationHandle = null; // Selected destination folder handle
let currentCode = null; // Current transfer code being viewed

const API_BASE = '/php'; // Adjust based on deployment

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const sendSection = document.getElementById('sendSection');
const receiveSection = document.getElementById('receiveSection');
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');
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
const errorMessage = document.getElementById('errorMessage');
const toast = document.getElementById('toast');

// Dynamic settings (will be loaded from server)
let appSettings = {
    maxFileSize: 2000, // MB (2GB default)
    maxFiles: 50
};

// Load settings from server
async function loadAppSettings() {
    try {
        const response = await fetch(API_BASE + '/api/settings');
        if (response.ok) {
            const data = await response.json();
            appSettings = data.settings;
            updateUploadZoneText();
        }
    } catch (error) {
        console.log('Using default settings');
    }
}

function updateUploadZoneText() {
    const uploadSubtitle = document.getElementById('uploadSubtitle');
    if (uploadSubtitle && uploadType === 'files') {
        const maxSizeText = appSettings.maxFileSize >= 1000 
            ? `${(appSettings.maxFileSize / 1000).toFixed(1)}GB` 
            : `${appSettings.maxFileSize}MB`;
        uploadSubtitle.textContent = `Maximum ${maxSizeText} per file, up to ${appSettings.maxFiles} files`;
    }
}

// Load settings on page load
loadAppSettings();

// Tab switching
if (tabBtns.length > 0) {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const tabName = btn.getAttribute('data-tab');
            if (sendSection) sendSection.classList.toggle('active', tabName === 'send');
            if (receiveSection) receiveSection.classList.toggle('active', tabName === 'receive');
        });
    });
}

// Upload type buttons
const uploadTypeBtns = document.querySelectorAll('.upload-type-btn');
uploadTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        uploadTypeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        uploadType = btn.dataset.type;
        updateUploadZoneForType();
    });
});

function updateUploadZoneForType() {
    const uploadIcon = document.getElementById('uploadIcon');
    const uploadTitle = document.getElementById('uploadTitle');
    const uploadSubtitle = document.getElementById('uploadSubtitle');
    
    if (!uploadIcon) return;
    
    switch(uploadType) {
        case 'folder':
            uploadIcon.textContent = '📁';
            uploadTitle.textContent = 'Drop folder here or click to browse';
            uploadSubtitle.textContent = 'Upload entire folder with structure preserved';
            break;
        case 'zip':
            uploadIcon.textContent = '🗜️';
            uploadTitle.textContent = 'Drop files here to compress & upload';
            uploadSubtitle.textContent = 'Files will be automatically compressed into a ZIP';
            break;
        default:
            uploadIcon.textContent = '📄';
            uploadTitle.textContent = 'Drop files here or click to browse';
            const maxSizeText = appSettings.maxFileSize >= 1000 
                ? `${(appSettings.maxFileSize / 1000).toFixed(1)}GB` 
                : `${appSettings.maxFileSize}MB`;
            uploadSubtitle.textContent = `Maximum ${maxSizeText} per file, up to ${appSettings.maxFiles} files`;
    }
}

// File input handling
if (uploadZone) {
    uploadZone.addEventListener('click', () => {
        if (uploadType === 'folder' && folderInput) {
            folderInput.click();
        } else if (fileInput) {
            fileInput.click();
        }
    });

    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.style.background = '#f0f0f0';
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.style.background = '';
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.style.background = '';
        handleFiles(e.dataTransfer.files);
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
}

function handleFiles(files) {
    selectedFiles = Array.from(files);
    displaySelectedFiles();
}

function displaySelectedFiles() {
    if (!selectedFilesDiv) return;
    
    selectedFilesDiv.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const fileElement = document.createElement('div');
        fileElement.className = 'selected-file';
        fileElement.innerHTML = `
            <span>${file.name} (${formatSize(file.size)})</span>
            <button type="button" onclick="removeFile(${index})" class="btn btn-small btn-danger">Remove</button>
        `;
        selectedFilesDiv.appendChild(fileElement);
    });
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    displaySelectedFiles();
}

// Upload function
if (uploadBtn) {
    uploadBtn.addEventListener('click', uploadFiles);
}

async function uploadFiles() {
    if (selectedFiles.length === 0) {
        showToast('No files selected', 'error');
        return;
    }
    
    const password = document.getElementById('transferPassword')?.value || null;
    const message = document.getElementById('transferMessage')?.value || null;
    
    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('files', file);
    });
    
    if (password) formData.append('password', password);
    if (message) formData.append('message', message);
    
    try {
        const token = getToken();
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(API_BASE + '/api/upload', {
            method: 'POST',
            headers: headers,
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            showToast(data.error || 'Upload failed', 'error');
            return;
        }
        
        currentTransferCode = data.transferCode;
        showTransferCode(data.transferCode);
        
        selectedFiles = [];
        displaySelectedFiles();
        
        if (fileInput) fileInput.value = '';
        if (folderInput) folderInput.value = '';
        
        showToast('Files uploaded successfully!', 'success');
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Upload failed', 'error');
    }
}

function showTransferCode(code) {
    if (transferCodeDisplay) {
        transferCodeDisplay.style.display = 'block';
    }
    if (generatedCode) {
        generatedCode.textContent = code;
    }
}

if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', () => {
        if (currentTransferCode) {
            navigator.clipboard.writeText(currentTransferCode);
            showToast('Code copied to clipboard!', 'success');
        }
    });
}

if (deleteTransferBtn) {
    deleteTransferBtn.addEventListener('click', async () => {
        if (!currentTransferCode) return;
        
        if (confirm('Are you sure you want to delete this transfer?')) {
            try {
                const response = await fetch(API_BASE + `/api/files/${currentTransferCode}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    showToast('Transfer deleted', 'success');
                    if (transferCodeDisplay) {
                        transferCodeDisplay.style.display = 'none';
                    }
                    currentTransferCode = null;
                } else {
                    showToast('Delete failed', 'error');
                }
            } catch (error) {
                console.error('Delete error:', error);
                showToast('Delete failed', 'error');
            }
        }
    });
}

if (newTransferBtn) {
    newTransferBtn.addEventListener('click', () => {
        if (transferCodeDisplay) {
            transferCodeDisplay.style.display = 'none';
        }
        currentTransferCode = null;
        selectedFiles = [];
        displaySelectedFiles();
    });
}

// Receive files section
if (fetchFilesBtn) {
    fetchFilesBtn.addEventListener('click', fetchFiles);
}

async function fetchFiles() {
    const code = codeInput?.value?.toUpperCase() || '';
    
    if (!code) {
        showToast('Please enter a transfer code', 'error');
        return;
    }
    
    try {
        const response = await fetch(API_BASE + `/api/files/${code}`);
        const data = await response.json();
        
        if (!response.ok) {
            showToast(data.error || 'Transfer not found', 'error');
            return;
        }
        
        currentCode = code;
        currentTransferFiles = data.files;
        currentTransferPassword = null;
        
        // Check if password protected
        if (data.hasPassword) {
            showPasswordPrompt(code, data);
        } else {
            displayTransferFiles(data);
        }
        
        if (availableFiles) {
            availableFiles.style.display = 'block';
        }
    } catch (error) {
        console.error('Fetch error:', error);
        showToast('Connection error', 'error');
    }
}

function showPasswordPrompt(code, data) {
    const password = prompt('This transfer is password protected. Enter password:');
    
    if (password === null) return;
    
    verifyPassword(code, password, data);
}

async function verifyPassword(code, password, data) {
    try {
        const response = await fetch(API_BASE + `/api/files/${code}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        if (!response.ok) {
            showToast('Incorrect password', 'error');
            return;
        }
        
        currentTransferPassword = password;
        displayTransferFiles(data);
    } catch (error) {
        console.error('Verify error:', error);
        showToast('Verification failed', 'error');
    }
}

function displayTransferFiles(data) {
    if (!filesList) return;
    
    filesList.innerHTML = '';
    
    if (data.message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'transfer-message';
        messageDiv.innerHTML = `<strong>Message:</strong> ${data.message}`;
        filesList.appendChild(messageDiv);
    }
    
    const filesContainer = document.createElement('div');
    filesContainer.className = 'files-container';
    
    data.files.forEach((file, index) => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item';
        fileDiv.innerHTML = `
            <div class="file-info">
                <span class="file-name">${file.name}</span>
                <span class="file-size">${formatSize(file.size)}</span>
            </div>
            <button class="btn btn-primary btn-small" onclick="downloadFile('${currentCode}', ${index})">Download</button>
        `;
        filesContainer.appendChild(fileDiv);
    });
    
    filesList.appendChild(filesContainer);
    
    const downloadAllBtn = document.createElement('button');
    downloadAllBtn.className = 'btn btn-primary';
    downloadAllBtn.textContent = '⬇️ Download All as ZIP';
    downloadAllBtn.onclick = () => downloadAllAsZip(currentCode);
    filesList.appendChild(downloadAllBtn);
}

function downloadFile(code, index) {
    let url = API_BASE + `/api/download/${code}/${index}`;
    if (currentTransferPassword) {
        url += `?password=${encodeURIComponent(currentTransferPassword)}`;
    }
    window.location.href = url;
}

function downloadAllAsZip(code) {
    let url = API_BASE + `/api/download-zip/${code}`;
    if (currentTransferPassword) {
        url += `?password=${encodeURIComponent(currentTransferPassword)}`;
    }
    window.location.href = url;
}

// Utility functions
function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function showToast(message, type = 'success') {
    if (toast) {
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}
