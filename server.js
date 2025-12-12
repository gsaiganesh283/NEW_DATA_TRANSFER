const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Store file metadata
const fileStore = new Map();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = crypto.randomBytes(16).toString('hex') + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Generate 6-character transfer code
function generateTransferCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Clean up expired files (older than 1 hour)
function cleanupExpiredFiles() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    for (const [code, fileInfo] of fileStore.entries()) {
        if (now - fileInfo.uploadedAt > oneHour) {
            // Delete files from disk
            fileInfo.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
            fileStore.delete(code);
            console.log(`Cleaned up expired transfer: ${code}`);
        }
    }
}

// Run cleanup every 10 minutes
setInterval(cleanupExpiredFiles, 10 * 60 * 1000);

// API Routes

// Upload file(s)
app.post('/api/upload', upload.array('files', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const transferCode = generateTransferCode();
        const files = req.files.map(file => ({
            originalName: file.originalname,
            filename: file.filename,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype
        }));

        fileStore.set(transferCode, {
            files: files,
            uploadedAt: Date.now(),
            downloadCount: 0
        });

        console.log(`Files uploaded with code: ${transferCode}, count: ${files.length}`);
        
        res.json({
            success: true,
            transferCode: transferCode,
            fileCount: files.length,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            expiresIn: '1 hour'
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Get file info by transfer code
app.get('/api/files/:code', (req, res) => {
    const code = req.params.code.toUpperCase();
    const fileInfo = fileStore.get(code);
    
    if (!fileInfo) {
        return res.status(404).json({ error: 'Transfer code not found or expired' });
    }
    
    res.json({
        success: true,
        files: fileInfo.files.map(f => ({
            name: f.originalName,
            size: f.size,
            type: f.mimetype
        })),
        uploadedAt: fileInfo.uploadedAt,
        downloadCount: fileInfo.downloadCount
    });
});

// Download single file
app.get('/api/download/:code/:index', (req, res) => {
    const code = req.params.code.toUpperCase();
    const index = parseInt(req.params.index);
    const fileInfo = fileStore.get(code);
    
    if (!fileInfo) {
        return res.status(404).json({ error: 'Transfer code not found or expired' });
    }
    
    if (index < 0 || index >= fileInfo.files.length) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    const file = fileInfo.files[index];
    
    if (!fs.existsSync(file.path)) {
        return res.status(404).json({ error: 'File no longer available' });
    }
    
    fileInfo.downloadCount++;
    console.log(`File downloaded: ${file.originalName} from transfer ${code}`);
    
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.sendFile(file.path);
});

// Delete transfer (for sender to delete after transfer)
app.delete('/api/files/:code', (req, res) => {
    const code = req.params.code.toUpperCase();
    const fileInfo = fileStore.get(code);
    
    if (!fileInfo) {
        return res.status(404).json({ error: 'Transfer code not found' });
    }
    
    // Delete files from disk
    fileInfo.files.forEach(file => {
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
    });
    
    fileStore.delete(code);
    console.log(`Transfer deleted: ${code}`);
    
    res.json({ success: true, message: 'Files deleted' });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        activeTransfers: fileStore.size
    });
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
