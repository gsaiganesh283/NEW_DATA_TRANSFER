// State
let selectedFiles = [];
let currentTransferCode = null;
let uploadType = 'files'; // 'files', 'folder', 'zip'
let folderStructure = {}; // Track folder paths
let currentTransferPassword = null; // Password for current transfer being viewed
let currentTransferFiles = []; // Files from current transfer
let selectedDestinationHandle = null; // Selected destination folder handle
let currentCode = null; // Current transfer code being viewed

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
        const response = await fetch('/api/settings');
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

// Advanced options toggle
const toggleAdvancedBtn = document.getElementById('toggleAdvancedBtn');
const advancedOptions = document.getElementById('advancedOptions');
const advancedArrow = document.getElementById('advancedArrow');

if (toggleAdvancedBtn) {
    toggleAdvancedBtn.addEventListener('click', () => {
        const isHidden = advancedOptions.style.display === 'none';
        advancedOptions.style.display = isHidden ? 'block' : 'none';
        advancedArrow.textContent = isHidden ? '▲' : '▼';
    });
}

// Password protection toggle
const passwordProtect = document.getElementById('passwordProtect');
const passwordField = document.getElementById('passwordField');

if (passwordProtect) {
    passwordProtect.addEventListener('change', () => {
        passwordField.style.display = passwordProtect.checked ? 'block' : 'none';
    });
}

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
            sendSection.classList.remove('active');
            receiveSection.classList.add('active');
        }
    });
});

// Upload zone events
uploadZone.addEventListener('click', () => {
    if (uploadType === 'folder') {
        folderInput.click();
    } else {
        fileInput.click();
    }
});

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    
    const items = e.dataTransfer.items;
    const files = e.dataTransfer.files;
    
    // Check if dropping folders using webkitGetAsEntry
    if (items && items[0] && items[0].webkitGetAsEntry) {
        const entries = [];
        for (let i = 0; i < items.length; i++) {
            const entry = items[i].webkitGetAsEntry();
            if (entry) entries.push(entry);
        }
        
        if (entries.some(e => e.isDirectory)) {
            await handleFolderEntries(entries);
            return;
        }
    }
    
    handleFiles(files);
});

// File input change
fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

// Folder input change
folderInput.addEventListener('change', (e) => {
    handleFolderFiles(e.target.files);
});

// Handle folder entries from drag & drop
async function handleFolderEntries(entries) {
    const files = [];
    const paths = {};
    
    async function traverseEntry(entry, path = '') {
        if (entry.isFile) {
            return new Promise((resolve) => {
                entry.file(file => {
                    const fullPath = path + file.name;
                    files.push(file);
                    paths[file.name + '_' + files.length] = fullPath;
                    resolve();
                });
            });
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            return new Promise((resolve) => {
                reader.readEntries(async (entries) => {
                    for (const childEntry of entries) {
                        await traverseEntry(childEntry, path + entry.name + '/');
                    }
                    resolve();
                });
            });
        }
    }
    
    for (const entry of entries) {
        await traverseEntry(entry);
    }
    
    processFilesWithPaths(files, paths);
}

// Handle folder files from input
function handleFolderFiles(files) {
    const paths = {};
    const fileArray = Array.from(files);
    
    fileArray.forEach((file, index) => {
        // webkitRelativePath contains the full path from folder root
        paths[file.name + '_' + (index + 1)] = file.webkitRelativePath || file.name;
    });
    
    processFilesWithPaths(fileArray, paths);
}

// Process files with their paths
function processFilesWithPaths(files, paths) {
    const maxSizeBytes = appSettings.maxFileSize * 1024 * 1024;
    const maxSizeText = appSettings.maxFileSize >= 1000 
        ? `${(appSettings.maxFileSize / 1000).toFixed(1)}GB` 
        : `${appSettings.maxFileSize}MB`;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > maxSizeBytes) {
            showToast(`${file.name} is too large (max ${maxSizeText})`, 'error');
            continue;
        }
        if (selectedFiles.length >= appSettings.maxFiles) {
            showToast(`Maximum ${appSettings.maxFiles} files allowed`, 'error');
            break;
        }
        
        const key = file.name + '_' + (i + 1);
        file._folderPath = paths[key] || file.name;
        
        const exists = selectedFiles.some(f => 
            f.name === file.name && f.size === file.size && f._folderPath === file._folderPath
        );
        if (!exists) {
            selectedFiles.push(file);
        }
    }
    renderSelectedFiles();
}

function handleFiles(files) {
    const maxSizeBytes = appSettings.maxFileSize * 1024 * 1024;
    const maxSizeText = appSettings.maxFileSize >= 1000 
        ? `${(appSettings.maxFileSize / 1000).toFixed(1)}GB` 
        : `${appSettings.maxFileSize}MB`;
    
    for (const file of files) {
        if (file.size > maxSizeBytes) {
            showToast(`${file.name} is too large (max ${maxSizeText})`, 'error');
            continue;
        }
        if (selectedFiles.length >= appSettings.maxFiles) {
            showToast(`Maximum ${appSettings.maxFiles} files allowed`, 'error');
            break;
        }
        if (!selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
        }
    }
    renderSelectedFiles();
}

function renderSelectedFiles() {
    if (selectedFiles.length === 0) {
        selectedFilesDiv.innerHTML = '';
        uploadBtn.style.display = 'none';
        updateTotalSizeDisplay();
        return;
    }

    selectedFilesDiv.innerHTML = selectedFiles.map((file, index) => `
        <div class="file-item">
            <span class="file-icon">${getFileIcon(file.type)}</span>
            <div class="file-info">
                <div class="file-name">${file._folderPath || file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <button class="file-remove" onclick="removeFile(${index})">✕</button>
        </div>
    `).join('');

    uploadBtn.style.display = 'flex';
    updateTotalSizeDisplay();
}

function updateTotalSizeDisplay() {
    const totalSizeDisplay = document.getElementById('totalSizeDisplay');
    const fileCountEl = document.getElementById('fileCount');
    const totalSizeEl = document.getElementById('totalSize');
    
    if (!totalSizeDisplay) return;
    
    if (selectedFiles.length === 0) {
        totalSizeDisplay.style.display = 'none';
        return;
    }
    
    const totalBytes = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    fileCountEl.textContent = `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}`;
    totalSizeEl.textContent = formatFileSize(totalBytes);
    totalSizeDisplay.style.display = 'block';
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
    
    // Add files
    selectedFiles.forEach(file => {
        formData.append('files', file);
    });
    
    // Add folder paths if any files have them
    const folderPaths = selectedFiles.map(f => f._folderPath || null);
    formData.append('folderPaths', JSON.stringify(folderPaths));
    
    // Add advanced options
    const passwordProtect = document.getElementById('passwordProtect');
    const transferPassword = document.getElementById('transferPassword');
    const expirySelect = document.getElementById('expirySelect');
    const transferMessage = document.getElementById('transferMessage');
    
    if (passwordProtect && passwordProtect.checked && transferPassword.value) {
        formData.append('password', transferPassword.value);
    }
    
    if (expirySelect) {
        formData.append('expiryTime', expirySelect.value);
    }
    
    if (transferMessage && transferMessage.value.trim()) {
        formData.append('message', transferMessage.value.trim());
    }

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
                
                // Update expiry info text
                const infoText = document.querySelector('.info-text');
                if (infoText) {
                    infoText.textContent = `⏰ Code expires in ${response.expiresIn}`;
                    if (response.hasPassword) {
                        infoText.textContent += ' | 🔒 Password protected';
                    }
                }
                
                uploadProgress.style.display = 'none';
                uploadZone.style.display = 'none';
                selectedFilesDiv.innerHTML = '';
                transferCodeDisplay.style.display = 'block';
                
                // Hide advanced options
                if (advancedOptions) advancedOptions.style.display = 'none';
                document.querySelector('.advanced-options-toggle').style.display = 'none';
                document.querySelector('.upload-type-selector').style.display = 'none';
                
                const totalSizeDisplay = document.getElementById('totalSizeDisplay');
                if (totalSizeDisplay) totalSizeDisplay.style.display = 'none';
                
                showToast('Files uploaded successfully!', 'success');
            } else {
                const error = JSON.parse(xhr.responseText);
                throw new Error(error.error || 'Upload failed');
            }
        };

        xhr.onerror = () => {
            showToast('Upload failed. Please try again.', 'error');
            resetUploadUI();
        };

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
    } catch (error) {
        showToast(error.message || 'Upload failed. Please try again.', 'error');
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
    
    // Reset advanced options
    const passwordProtect = document.getElementById('passwordProtect');
    const transferPassword = document.getElementById('transferPassword');
    const expirySelect = document.getElementById('expirySelect');
    const transferMessage = document.getElementById('transferMessage');
    const passwordField = document.getElementById('passwordField');
    
    if (passwordProtect) passwordProtect.checked = false;
    if (transferPassword) transferPassword.value = '';
    if (expirySelect) expirySelect.value = '24';
    if (transferMessage) transferMessage.value = '';
    if (passwordField) passwordField.style.display = 'none';
    
    // Show hidden elements
    document.querySelector('.advanced-options-toggle').style.display = 'block';
    document.querySelector('.upload-type-selector').style.display = 'flex';
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

    // Reset password state
    currentTransferPassword = null;
    
    try {
        const response = await fetch(`/api/files/${code}`);
        const data = await response.json();

        if (!response.ok) {
            showError(data.error || 'Transfer not found');
            availableFiles.style.display = 'none';
            return;
        }

        errorMessage.style.display = 'none';
        currentTransferFiles = data.files;
        
        // Check if password protected
        if (data.hasPassword) {
            showPasswordPrompt(code, data);
            return;
        }
        
        // Show message if any
        if (data.message) {
            showTransferMessage(data.message);
        } else {
            hideTransferMessage();
        }
        
        renderAvailableFiles(code, data.files);
        availableFiles.style.display = 'block';
    } catch (error) {
        showError('Failed to fetch files. Please try again.');
    }
}

function showPasswordPrompt(code, data) {
    const passwordRequired = document.getElementById('passwordRequired');
    const unlockBtn = document.getElementById('unlockBtn');
    const accessPassword = document.getElementById('accessPassword');
    
    availableFiles.style.display = 'none';
    passwordRequired.style.display = 'block';
    
    unlockBtn.onclick = async () => {
        const password = accessPassword.value;
        
        try {
            const response = await fetch(`/api/files/${code}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            
            if (response.ok) {
                currentTransferPassword = password;
                passwordRequired.style.display = 'none';
                accessPassword.value = '';
                
                // Show message if any
                if (data.message) {
                    showTransferMessage(data.message);
                } else {
                    hideTransferMessage();
                }
                
                renderAvailableFiles(code, data.files);
                availableFiles.style.display = 'block';
            } else {
                showToast('Incorrect password', 'error');
            }
        } catch (error) {
            showToast('Failed to verify password', 'error');
        }
    };
}

function showTransferMessage(message) {
    const messageDisplay = document.getElementById('transferMessageDisplay');
    const messageContent = document.getElementById('messageContent');
    
    if (messageDisplay && messageContent) {
        messageContent.textContent = message;
        messageDisplay.style.display = 'flex';
    }
}

function hideTransferMessage() {
    const messageDisplay = document.getElementById('transferMessageDisplay');
    if (messageDisplay) {
        messageDisplay.style.display = 'none';
    }
}

function renderAvailableFiles(code, files) {
    // Update file count and total size
    const transferFileCount = document.getElementById('transferFileCount');
    const transferTotalSize = document.getElementById('transferTotalSize');
    
    if (transferFileCount) {
        transferFileCount.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;
    }
    if (transferTotalSize) {
        const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
        transferTotalSize.textContent = formatFileSize(totalBytes);
    }
    
    filesList.innerHTML = files.map((file, index) => `
        <div class="download-item" data-index="${index}">
            <label class="file-checkbox">
                <input type="checkbox" class="file-select" data-index="${index}" checked>
            </label>
            <span class="file-icon">${getFileIcon(file.type)}</span>
            <div class="file-info">
                <div class="file-name">${file.folderPath || file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <button class="preview-btn" onclick="previewFile('${code}', ${index}, '${file.name}', '${file.type}')" title="Preview">
                👁️
            </button>
            <button class="download-btn" onclick="downloadFile('${code}', ${index}, '${file.name}')">
                ⬇️ Download
            </button>
        </div>
    `).join('');

    // Setup download buttons
    setupDownloadButtons(code, files);
}

function setupDownloadButtons(code, files) {
    currentCode = code;
    currentTransferFiles = files;
    
    // Select all checkbox
    const selectAllFiles = document.getElementById('selectAllFiles');
    const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
    const downloadAsZipBtn = document.getElementById('downloadAsZipBtn');
    const downloadToFolderBtn = document.getElementById('downloadToFolderBtn');
    const selectDestinationBtn = document.getElementById('selectDestinationBtn');
    
    // Check if File System Access API is supported
    const fsApiSupported = 'showDirectoryPicker' in window;
    
    // Update UI based on API support
    if (!fsApiSupported) {
        if (downloadToFolderBtn) downloadToFolderBtn.style.display = 'none';
        if (selectDestinationBtn) selectDestinationBtn.style.display = 'none';
        const destinationHint = document.getElementById('destinationHint');
        if (destinationHint) destinationHint.textContent = 'Files will be saved to your browser\'s default download location';
    }
    
    if (selectAllFiles) {
        selectAllFiles.checked = true;
        selectAllFiles.onchange = () => {
            document.querySelectorAll('.file-select').forEach(cb => {
                cb.checked = selectAllFiles.checked;
            });
        };
    }
    
    if (selectDestinationBtn && fsApiSupported) {
        selectDestinationBtn.onclick = selectDestinationFolder;
    }
    
    if (downloadSelectedBtn) {
        downloadSelectedBtn.onclick = () => {
            const selected = getSelectedIndexes();
            if (selected.length === 0) {
                showToast('No files selected', 'error');
                return;
            }
            selected.forEach((idx, i) => {
                setTimeout(() => {
                    downloadFile(code, idx, files[idx].name);
                }, i * 500);
            });
        };
    }
    
    if (downloadAsZipBtn) {
        downloadAsZipBtn.onclick = () => {
            const selected = getSelectedIndexes();
            if (selected.length === 0) {
                showToast('No files selected', 'error');
                return;
            }
            downloadAsZip(code, selected);
        };
    }
    
    if (downloadToFolderBtn && fsApiSupported) {
        downloadToFolderBtn.onclick = () => {
            const selected = getSelectedIndexes();
            if (selected.length === 0) {
                showToast('No files selected', 'error');
                return;
            }
            downloadToSelectedFolder(code, files, selected);
        };
    }
}

function getSelectedIndexes() {
    const checkboxes = document.querySelectorAll('.file-select:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
}

function downloadFile(code, index, filename) {
    let url = `/api/download/${code}/${index}`;
    if (currentTransferPassword) {
        url += `?password=${encodeURIComponent(currentTransferPassword)}`;
    }
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    showToast(`Downloading ${filename}`, 'success');
}

function downloadAsZip(code, indexes) {
    let url = `/api/download-zip/${code}?indexes=${indexes.join(',')}`;
    if (currentTransferPassword) {
        url += `&password=${encodeURIComponent(currentTransferPassword)}`;
    }
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `transfer-${code}.zip`;
    link.click();
    showToast('Downloading as ZIP...', 'success');
}

// Select destination folder using File System Access API
async function selectDestinationFolder() {
    try {
        selectedDestinationHandle = await window.showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'downloads'
        });
        
        const selectedPathEl = document.getElementById('selectedPath');
        const destinationHint = document.getElementById('destinationHint');
        
        if (selectedPathEl) {
            selectedPathEl.textContent = selectedDestinationHandle.name;
        }
        if (destinationHint) {
            destinationHint.textContent = '✓ Custom folder selected - click "Save to Folder" to download';
            destinationHint.style.color = 'var(--success-color)';
        }
        
        showToast(`Folder selected: ${selectedDestinationHandle.name}`, 'success');
    } catch (error) {
        if (error.name !== 'AbortError') {
            showToast('Failed to select folder', 'error');
            console.error('Folder selection error:', error);
        }
    }
}

// Download files directly to selected folder
async function downloadToSelectedFolder(code, files, selectedIndexes) {
    if (!selectedDestinationHandle) {
        // Prompt to select folder first
        await selectDestinationFolder();
        if (!selectedDestinationHandle) {
            return;
        }
    }
    
    showToast(`Saving ${selectedIndexes.length} file(s) to ${selectedDestinationHandle.name}...`, 'success');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const idx of selectedIndexes) {
        const file = files[idx];
        let url = `/api/download/${code}/${idx}`;
        if (currentTransferPassword) {
            url += `?password=${encodeURIComponent(currentTransferPassword)}`;
        }
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Download failed');
            
            const blob = await response.blob();
            const filename = file.folderPath || file.name;
            
            // Handle folder structure
            const pathParts = filename.split('/');
            let currentDir = selectedDestinationHandle;
            
            // Create nested folders if needed
            if (pathParts.length > 1) {
                for (let i = 0; i < pathParts.length - 1; i++) {
                    currentDir = await currentDir.getDirectoryHandle(pathParts[i], { create: true });
                }
            }
            
            // Create and write file
            const finalFilename = pathParts[pathParts.length - 1];
            const fileHandle = await currentDir.getFileHandle(finalFilename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            
            successCount++;
        } catch (error) {
            console.error(`Failed to save ${file.name}:`, error);
            failCount++;
        }
    }
    
    if (failCount === 0) {
        showToast(`✓ ${successCount} file(s) saved to ${selectedDestinationHandle.name}`, 'success');
    } else {
        showToast(`Saved ${successCount} file(s), ${failCount} failed`, 'error');
    }
}

// Download ZIP to selected folder
async function downloadZipToFolder(code, indexes) {
    if (!selectedDestinationHandle) {
        await selectDestinationFolder();
        if (!selectedDestinationHandle) return;
    }
    
    let url = `/api/download-zip/${code}?indexes=${indexes.join(',')}`;
    if (currentTransferPassword) {
        url += `&password=${encodeURIComponent(currentTransferPassword)}`;
    }
    
    try {
        showToast('Downloading ZIP...', 'success');
        const response = await fetch(url);
        if (!response.ok) throw new Error('Download failed');
        
        const blob = await response.blob();
        const fileHandle = await selectedDestinationHandle.getFileHandle(`transfer-${code}.zip`, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        showToast(`✓ ZIP saved to ${selectedDestinationHandle.name}`, 'success');
    } catch (error) {
        console.error('ZIP download error:', error);
        showToast('Failed to save ZIP', 'error');
    }
}

function previewFile(code, index, filename, type) {
    const previewPanel = document.getElementById('previewPanel');
    const previewContent = document.getElementById('previewContent');
    const closePreview = document.getElementById('closePreview');
    
    if (!previewPanel || !previewContent) return;
    
    let url = `/api/download/${code}/${index}`;
    if (currentTransferPassword) {
        url += `?password=${encodeURIComponent(currentTransferPassword)}`;
    }
    
    // Determine preview type
    if (type && type.startsWith('image/')) {
        previewContent.innerHTML = `<img src="${url}" alt="${filename}" style="max-width: 100%; max-height: 400px;">`;
    } else if (type && type.startsWith('video/')) {
        previewContent.innerHTML = `<video controls style="max-width: 100%; max-height: 400px;"><source src="${url}" type="${type}">Your browser does not support video preview.</video>`;
    } else if (type && type.startsWith('audio/')) {
        previewContent.innerHTML = `<audio controls style="width: 100%;"><source src="${url}" type="${type}">Your browser does not support audio preview.</audio>`;
    } else if (type === 'application/pdf') {
        previewContent.innerHTML = `<iframe src="${url}" style="width: 100%; height: 400px; border: none;"></iframe>`;
    } else if (type && (type.startsWith('text/') || type === 'application/json' || type === 'application/javascript')) {
        fetch(url)
            .then(r => r.text())
            .then(text => {
                previewContent.innerHTML = `<pre style="white-space: pre-wrap; max-height: 400px; overflow: auto; padding: 1rem; background: #1a1a2e; border-radius: 8px;">${escapeHtml(text)}</pre>`;
            })
            .catch(() => {
                previewContent.innerHTML = '<p>Unable to preview this file.</p>';
            });
    } else {
        previewContent.innerHTML = `<p>Preview not available for this file type.</p><p><a href="${url}" download="${filename}" class="btn btn-primary">Download to view</a></p>`;
    }
    
    previewPanel.style.display = 'block';
    
    if (closePreview) {
        closePreview.onclick = () => {
            previewPanel.style.display = 'none';
            previewContent.innerHTML = '';
        };
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
