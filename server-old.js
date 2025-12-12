const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const archiver = require('archiver');

const app = express();
const server = http.createServer(app);

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Google OAuth Configuration (set these in environment variables)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback';

// Create directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Simple file-based database for users
const usersFile = path.join(dataDir, 'users.json');

function loadUsers() {
    try {
        if (fs.existsSync(usersFile)) {
            return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
    return [];
}

function saveUsers(users) {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// Initialize with superadmin if not exists
function initializeSuperAdmin() {
    let users = loadUsers();
    const superadmin = users.find(u => u.role === 'superadmin');
    
    if (!superadmin) {
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        users.push({
            id: crypto.randomUUID(),
            name: 'Super Admin',
            email: 'admin@filetransfer.com',
            password: hashedPassword,
            role: 'superadmin',
            provider: 'local',
            createdAt: new Date().toISOString()
        });
        saveUsers(users);
        console.log('Super Admin created with email: admin@filetransfer.com and password: admin123');
    }
}

initializeSuperAdmin();

// Transfers file for persistence
const transfersFile = path.join(dataDir, 'transfers.json');

// Load transfers from file
function loadTransfers() {
    try {
        if (fs.existsSync(transfersFile)) {
            const data = JSON.parse(fs.readFileSync(transfersFile, 'utf8'));
            const map = new Map();
            for (const [key, value] of Object.entries(data)) {
                map.set(key, value);
            }
            console.log(`Loaded ${map.size} transfers from storage`);
            return map;
        }
    } catch (error) {
        console.error('Error loading transfers:', error);
    }
    return new Map();
}

// Save transfers to file
function saveTransfers() {
    try {
        const data = {};
        for (const [key, value] of fileStore.entries()) {
            data[key] = value;
        }
        fs.writeFileSync(transfersFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving transfers:', error);
    }
}

// Store file metadata (now persistent)
const fileStore = loadTransfers();

// Settings file for persistence
const settingsFile = path.join(dataDir, 'settings.json');

// Load settings from file or use defaults
function loadSettings() {
    try {
        if (fs.existsSync(settingsFile)) {
            return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
    return {
        maxFileSize: 2000, // MB (2GB)
        maxFiles: 50,
        expiryTime: 24, // hours
        allowAnonymous: true,
        storagePath: 'uploads', // relative to app directory or absolute path
        enableCloudStorage: false,
        cloudProvider: 'local', // local, s3, gcs, azure
        cloudBucket: '',
        cloudRegion: ''
    };
}

function saveSettings(settings) {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

// System settings
let systemSettings = loadSettings();

// Get current upload directory based on settings
function getUploadDir() {
    let uploadPath = systemSettings.storagePath || 'uploads';
    
    // If relative path, make it relative to app directory
    if (!path.isAbsolute(uploadPath)) {
        uploadPath = path.join(__dirname, uploadPath);
    }
    
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    return uploadPath;
}

// Configure multer for file uploads with dynamic settings
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, getUploadDir());
    },
    filename: (req, file, cb) => {
        // Create date-based subdirectory for organization
        const date = new Date();
        const dateDir = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const fullDir = path.join(getUploadDir(), dateDir);
        
        if (!fs.existsSync(fullDir)) {
            fs.mkdirSync(fullDir, { recursive: true });
        }
        
        const uniqueName = crypto.randomBytes(16).toString('hex') + path.extname(file.originalname);
        cb(null, path.join(dateDir, uniqueName));
    }
});

// Create upload middleware with current settings
function createUploadMiddleware() {
    return multer({ 
        storage: storage,
        limits: { fileSize: (systemSettings.maxFileSize || 2000) * 1024 * 1024 }
    });
}

let upload = createUploadMiddleware();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Generate 6-character transfer code
function generateTransferCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Generate JWT token
function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

// Auth Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Admin Middleware
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// SuperAdmin Middleware
function requireSuperAdmin(req, res, next) {
    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Super Admin access required' });
    }
    next();
}

// Optional Auth Middleware (for uploads that can be anonymous)
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err) {
                req.user = user;
            }
        });
    }
    next();
}

// Clean up expired files
function cleanupExpiredFiles() {
    const now = Date.now();
    const expiryMs = systemSettings.expiryTime * 60 * 60 * 1000;
    let cleaned = false;
    
    for (const [code, fileInfo] of fileStore.entries()) {
        if (now - fileInfo.uploadedAt > expiryMs) {
            fileInfo.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
            fileStore.delete(code);
            cleaned = true;
            console.log(`Cleaned up expired transfer: ${code}`);
        }
    }
    
    // Save transfers after cleanup
    if (cleaned) {
        saveTransfers();
    }
}

setInterval(cleanupExpiredFiles, 10 * 60 * 1000);

// ==================== AUTH ROUTES ====================

// Signup
app.post('/auth/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        let users = loadUsers();
        
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: crypto.randomUUID(),
            name: name || email.split('@')[0],
            email: email.toLowerCase(),
            password: hashedPassword,
            role: 'user',
            provider: 'local',
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        saveUsers(users);

        const token = generateToken(newUser);
        const userResponse = { ...newUser };
        delete userResponse.password;

        res.json({ token, user: userResponse });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Signup failed' });
    }
});

// Login
app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const users = loadUsers();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (user.provider === 'google') {
            return res.status(401).json({ error: 'Please login with Google' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = generateToken(user);
        const userResponse = { ...user };
        delete userResponse.password;

        res.json({ token, user: userResponse });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Verify token
app.get('/auth/verify', authenticateToken, (req, res) => {
    const users = loadUsers();
    const user = users.find(u => u.id === req.user.id);
    
    if (!user) {
        return res.status(401).json({ error: 'User not found' });
    }

    const userResponse = { ...user };
    delete userResponse.password;
    
    res.json({ valid: true, user: userResponse });
});

// Logout (client-side handles this, but we can log it)
app.post('/auth/logout', authenticateToken, (req, res) => {
    res.json({ success: true });
});

// ==================== GOOGLE OAUTH ROUTES ====================

// Google OAuth - Redirect to Google
app.get('/auth/google', (req, res) => {
    if (!GOOGLE_CLIENT_ID) {
        return res.status(500).send(`
            <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h2>Google OAuth Not Configured</h2>
                <p>Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.</p>
                <a href="/login.html">Back to Login</a>
            </body>
            </html>
        `);
    }

    const scope = encodeURIComponent('email profile');
    const redirectUri = encodeURIComponent(GOOGLE_CALLBACK_URL);
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline`;
    
    res.redirect(googleAuthUrl);
});

// Google OAuth Callback
app.get('/auth/google/callback', async (req, res) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.redirect('/login.html?error=oauth_failed');
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_CALLBACK_URL,
                grant_type: 'authorization_code'
            })
        });

        const tokens = await tokenResponse.json();

        if (!tokens.access_token) {
            console.error('Token exchange failed:', tokens);
            return res.redirect('/login.html?error=oauth_failed');
        }

        // Get user info
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });

        const googleUser = await userInfoResponse.json();

        if (!googleUser.email) {
            return res.redirect('/login.html?error=oauth_failed');
        }

        let users = loadUsers();
        let user = users.find(u => u.email.toLowerCase() === googleUser.email.toLowerCase());

        if (!user) {
            // Create new user
            user = {
                id: crypto.randomUUID(),
                name: googleUser.name || googleUser.email.split('@')[0],
                email: googleUser.email.toLowerCase(),
                avatar: googleUser.picture,
                role: 'user',
                provider: 'google',
                googleId: googleUser.id,
                createdAt: new Date().toISOString()
            };
            users.push(user);
            saveUsers(users);
        } else if (user.provider !== 'google') {
            // Link Google to existing account
            user.googleId = googleUser.id;
            user.avatar = googleUser.picture;
            user.provider = 'google';
            saveUsers(users);
        }

        const token = generateToken(user);
        const userResponse = { ...user };
        delete userResponse.password;

        // Redirect with token
        const userStr = encodeURIComponent(JSON.stringify(userResponse));
        res.redirect(`/index.html?token=${token}&user=${userStr}`);
    } catch (error) {
        console.error('Google OAuth error:', error);
        res.redirect('/login.html?error=oauth_failed');
    }
});

// ==================== ADMIN API ROUTES ====================

// Get admin stats
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
    const users = loadUsers();
    
    let totalSize = 0;
    let totalDownloads = 0;
    
    for (const [code, info] of fileStore.entries()) {
        info.files.forEach(f => totalSize += f.size);
        totalDownloads += info.downloadCount;
    }

    res.json({
        totalUsers: users.length,
        activeTransfers: fileStore.size,
        totalDownloads,
        storageUsed: totalSize
    });
});

// Get all users
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    const users = loadUsers().map(u => {
        const user = { ...u };
        delete user.password;
        return user;
    });
    res.json({ users });
});

// Get single user
app.get('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
    const users = loadUsers();
    const user = users.find(u => u.id === req.params.id);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const userResponse = { ...user };
    delete userResponse.password;
    res.json(userResponse);
});

// Update user
app.put('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
    let users = loadUsers();
    const userIndex = users.findIndex(u => u.id === req.params.id);
    
    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = users[userIndex];
    
    // Prevent demoting superadmin unless you're superadmin
    if (targetUser.role === 'superadmin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Cannot modify super admin' });
    }

    // Prevent promoting to superadmin unless you're superadmin
    if (req.body.role === 'superadmin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Cannot assign super admin role' });
    }

    const { name, email, role } = req.body;
    
    if (name) users[userIndex].name = name;
    if (email) users[userIndex].email = email.toLowerCase();
    if (role && (req.user.role === 'superadmin' || role !== 'superadmin')) {
        users[userIndex].role = role;
    }

    saveUsers(users);
    
    const userResponse = { ...users[userIndex] };
    delete userResponse.password;
    res.json(userResponse);
});

// Delete user
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
    let users = loadUsers();
    const userIndex = users.findIndex(u => u.id === req.params.id);
    
    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = users[userIndex];
    
    if (targetUser.role === 'superadmin') {
        return res.status(403).json({ error: 'Cannot delete super admin' });
    }

    if (targetUser.id === req.user.id) {
        return res.status(403).json({ error: 'Cannot delete yourself' });
    }

    users.splice(userIndex, 1);
    saveUsers(users);
    
    res.json({ success: true });
});

// Get all transfers
app.get('/api/admin/transfers', authenticateToken, requireAdmin, (req, res) => {
    const transfers = [];
    const expiryMs = systemSettings.expiryTime * 60 * 60 * 1000;
    
    for (const [code, info] of fileStore.entries()) {
        transfers.push({
            code,
            fileCount: info.files.length,
            totalSize: info.files.reduce((sum, f) => sum + f.size, 0),
            downloadCount: info.downloadCount,
            uploadedBy: info.uploadedBy || 'Anonymous',
            uploadedAt: info.uploadedAt,
            expiresAt: new Date(info.uploadedAt + expiryMs).toISOString()
        });
    }
    
    res.json({ transfers });
});

// Delete transfer (admin)
app.delete('/api/admin/transfers/:code', authenticateToken, requireAdmin, (req, res) => {
    const code = req.params.code.toUpperCase();
    const fileInfo = fileStore.get(code);
    
    if (!fileInfo) {
        return res.status(404).json({ error: 'Transfer not found' });
    }

    fileInfo.files.forEach(file => {
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
    });
    
    fileStore.delete(code);
    saveTransfers();
    res.json({ success: true });
});

// Update settings
app.put('/api/admin/settings', authenticateToken, requireSuperAdmin, (req, res) => {
    const { maxFileSize, maxFiles, expiryTime, allowAnonymous, storagePath, enableCloudStorage, cloudProvider, cloudBucket, cloudRegion } = req.body;
    
    if (maxFileSize) systemSettings.maxFileSize = parseInt(maxFileSize);
    if (maxFiles) systemSettings.maxFiles = parseInt(maxFiles);
    if (expiryTime) systemSettings.expiryTime = parseInt(expiryTime);
    if (typeof allowAnonymous === 'boolean') systemSettings.allowAnonymous = allowAnonymous;
    if (storagePath) {
        systemSettings.storagePath = storagePath;
        // Ensure the new storage directory exists
        const fullPath = path.isAbsolute(storagePath) ? storagePath : path.join(__dirname, storagePath);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    }
    if (typeof enableCloudStorage === 'boolean') systemSettings.enableCloudStorage = enableCloudStorage;
    if (cloudProvider) systemSettings.cloudProvider = cloudProvider;
    if (cloudBucket !== undefined) systemSettings.cloudBucket = cloudBucket;
    if (cloudRegion !== undefined) systemSettings.cloudRegion = cloudRegion;
    
    // Persist settings to file
    saveSettings(systemSettings);
    
    // Update upload middleware
    upload = createUploadMiddleware();
    
    res.json({ success: true, settings: systemSettings });
});

// Get current settings
app.get('/api/admin/settings', authenticateToken, requireAdmin, (req, res) => {
    res.json({ settings: systemSettings });
});

// ==================== DATABASE MANAGEMENT API (SuperAdmin Only) ====================

// Get all database files info
app.get('/api/admin/database', authenticateToken, requireSuperAdmin, (req, res) => {
    try {
        const users = loadUsers();
        const settings = loadSettings();
        
        // Get file stats
        const usersFilePath = path.join(dataDir, 'users.json');
        const settingsFilePath = path.join(dataDir, 'settings.json');
        const transfersFilePath = path.join(dataDir, 'transfers.json');
        
        const usersStats = fs.existsSync(usersFilePath) ? fs.statSync(usersFilePath) : null;
        const settingsStats = fs.existsSync(settingsFilePath) ? fs.statSync(settingsFilePath) : null;
        const transfersStats = fs.existsSync(transfersFilePath) ? fs.statSync(transfersFilePath) : null;
        
        // Convert fileStore Map to array for display
        const transfersData = [];
        fileStore.forEach((value, key) => {
            transfersData.push({
                id: key,
                ...value,
                // Hide password in display
                password: value.password ? '[PROTECTED]' : null
            });
        });
        
        res.json({
            success: true,
            databases: {
                users: {
                    name: 'users.json',
                    path: usersFilePath,
                    size: usersStats ? usersStats.size : 0,
                    modified: usersStats ? usersStats.mtime : null,
                    recordCount: users.length,
                    data: users.map(u => ({ ...u, password: '[HIDDEN]' })) // Hide passwords
                },
                settings: {
                    name: 'settings.json',
                    path: settingsFilePath,
                    size: settingsStats ? settingsStats.size : 0,
                    modified: settingsStats ? settingsStats.mtime : null,
                    data: settings
                },
                transfers: {
                    name: 'transfers.json',
                    path: transfersFilePath,
                    size: transfersStats ? transfersStats.size : 0,
                    modified: transfersStats ? transfersStats.mtime : null,
                    recordCount: fileStore.size,
                    data: transfersData
                }
            }
        });
    } catch (error) {
        console.error('Database read error:', error);
        res.status(500).json({ error: 'Failed to read database' });
    }
});

// Download database file
app.get('/api/admin/database/download/:type', authenticateToken, requireSuperAdmin, (req, res) => {
    try {
        const { type } = req.params;
        let filePath, filename;
        
        if (type === 'users') {
            filePath = path.join(dataDir, 'users.json');
            filename = 'users.json';
        } else if (type === 'settings') {
            filePath = path.join(dataDir, 'settings.json');
            filename = 'settings.json';
        } else if (type === 'transfers') {
            filePath = path.join(dataDir, 'transfers.json');
            filename = 'transfers.json';
        } else if (type === 'all') {
            // Create a combined backup
            const transfersData = [];
            fileStore.forEach((value, key) => {
                transfersData.push({ id: key, ...value });
            });
            const backup = {
                exportedAt: new Date().toISOString(),
                users: loadUsers().map(u => ({ ...u, password: '[EXPORTED]' })),
                settings: loadSettings(),
                transfers: transfersData
            };
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="backup-${Date.now()}.json"`);
            return res.json(backup);
        } else {
            return res.status(400).json({ error: 'Invalid database type' });
        }
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Database file not found' });
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.sendFile(filePath);
    } catch (error) {
        console.error('Database download error:', error);
        res.status(500).json({ error: 'Failed to download database' });
    }
});

// Update database (settings only - users require specific endpoints)
app.put('/api/admin/database/:type', authenticateToken, requireSuperAdmin, (req, res) => {
    try {
        const { type } = req.params;
        const { data } = req.body;
        
        if (!data) {
            return res.status(400).json({ error: 'No data provided' });
        }
        
        if (type === 'settings') {
            // Validate and save settings
            const validKeys = ['maxFileSize', 'maxFiles', 'expiryTime', 'allowAnonymous', 'storagePath', 'enableCloudStorage', 'cloudProvider', 'cloudBucket', 'cloudRegion'];
            const newSettings = {};
            
            for (const key of validKeys) {
                if (data[key] !== undefined) {
                    newSettings[key] = data[key];
                }
            }
            
            Object.assign(systemSettings, newSettings);
            saveSettings(systemSettings);
            
            res.json({ success: true, message: 'Settings updated', settings: systemSettings });
        } else if (type === 'users') {
            // For users, only allow editing specific fields (not password directly)
            if (!Array.isArray(data)) {
                return res.status(400).json({ error: 'Users data must be an array' });
            }
            
            let users = loadUsers();
            
            // Update existing users (don't allow adding new users or changing passwords this way)
            for (const userData of data) {
                const userIndex = users.findIndex(u => u.id === userData.id);
                if (userIndex !== -1) {
                    // Only update allowed fields
                    if (userData.name) users[userIndex].name = userData.name;
                    if (userData.email) users[userIndex].email = userData.email.toLowerCase();
                    if (userData.role && ['user', 'admin', 'superadmin'].includes(userData.role)) {
                        // Don't allow demoting the last superadmin
                        const superadminCount = users.filter(u => u.role === 'superadmin').length;
                        if (users[userIndex].role === 'superadmin' && userData.role !== 'superadmin' && superadminCount <= 1) {
                            continue; // Skip this update
                        }
                        users[userIndex].role = userData.role;
                    }
                }
            }
            
            saveUsers(users);
            res.json({ success: true, message: 'Users updated', count: users.length });
        } else {
            return res.status(400).json({ error: 'Invalid database type' });
        }
    } catch (error) {
        console.error('Database update error:', error);
        res.status(500).json({ error: 'Failed to update database' });
    }
});

// Change password
app.post('/api/admin/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        let users = loadUsers();
        const userIndex = users.findIndex(u => u.id === req.user.id);
        
        if (userIndex === -1) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[userIndex];
        
        if (user.provider === 'google') {
            return res.status(400).json({ error: 'Cannot change password for Google accounts' });
        }

        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        users[userIndex].password = await bcrypt.hash(newPassword, 10);
        saveUsers(users);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// ==================== FILE TRANSFER API ROUTES ====================

// Upload file(s) - using dynamic middleware for current settings
app.post('/api/upload', optionalAuth, (req, res, next) => {
    // Recreate upload middleware with current settings
    const currentUpload = multer({
        storage: storage,
        limits: { fileSize: (systemSettings.maxFileSize || 2000) * 1024 * 1024 }
    });
    currentUpload.array('files', systemSettings.maxFiles || 50)(req, res, next);
}, (req, res) => {
    try {
        if (!systemSettings.allowAnonymous && !req.user) {
            return res.status(401).json({ error: 'Login required to upload files' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const transferCode = generateTransferCode();
        
        // Get advanced options from request body or query params
        const password = req.body.password || req.query.password || null;
        const expiryHours = parseInt(req.body.expiryTime || req.query.expiryTime) || systemSettings.expiryTime;
        const message = req.body.message || req.query.message || null;
        const folderPaths = req.body.folderPaths ? JSON.parse(req.body.folderPaths) : null;
        
        const files = req.files.map((file, index) => ({
            originalName: file.originalname,
            filename: file.filename,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype,
            folderPath: folderPaths && folderPaths[index] ? folderPaths[index] : null
        }));

        // Hash password if provided
        const hashedPassword = password ? bcrypt.hashSync(password, 10) : null;

        fileStore.set(transferCode, {
            files: files,
            uploadedAt: Date.now(),
            expiresAt: Date.now() + (expiryHours * 60 * 60 * 1000),
            downloadCount: 0,
            uploadedBy: req.user ? req.user.email : null,
            password: hashedPassword,
            message: message,
            hasPassword: !!password
        });
        
        // Persist transfers to file
        saveTransfers();

        console.log(`Files uploaded with code: ${transferCode}, count: ${files.length}, password protected: ${!!password}`);
        
        res.json({
            success: true,
            transferCode: transferCode,
            fileCount: files.length,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            expiresIn: `${expiryHours} hour(s)`,
            hasPassword: !!password,
            hasMessage: !!message
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
    
    // Check if transfer has expired
    if (fileInfo.expiresAt && Date.now() > fileInfo.expiresAt) {
        fileStore.delete(code);
        saveTransfers();
        return res.status(404).json({ error: 'Transfer has expired' });
    }
    
    res.json({
        success: true,
        files: fileInfo.files.map(f => ({
            name: f.originalName,
            size: f.size,
            type: f.mimetype,
            folderPath: f.folderPath
        })),
        uploadedAt: fileInfo.uploadedAt,
        expiresAt: fileInfo.expiresAt,
        downloadCount: fileInfo.downloadCount,
        hasPassword: fileInfo.hasPassword || false,
        message: fileInfo.message
    });
});

// Verify password for protected transfer
app.post('/api/files/:code/verify', (req, res) => {
    const code = req.params.code.toUpperCase();
    const { password } = req.body;
    const fileInfo = fileStore.get(code);
    
    if (!fileInfo) {
        return res.status(404).json({ error: 'Transfer code not found or expired' });
    }
    
    if (!fileInfo.password) {
        return res.json({ success: true, verified: true });
    }
    
    const isValid = bcrypt.compareSync(password || '', fileInfo.password);
    
    if (!isValid) {
        return res.status(401).json({ error: 'Incorrect password' });
    }
    
    res.json({ success: true, verified: true });
});

// Download single file
app.get('/api/download/:code/:index', (req, res) => {
    const code = req.params.code.toUpperCase();
    const index = parseInt(req.params.index);
    const password = req.query.password;
    const fileInfo = fileStore.get(code);
    
    if (!fileInfo) {
        return res.status(404).json({ error: 'Transfer code not found or expired' });
    }
    
    // Check password if protected
    if (fileInfo.password) {
        if (!password || !bcrypt.compareSync(password, fileInfo.password)) {
            return res.status(401).json({ error: 'Password required' });
        }
    }
    
    if (index < 0 || index >= fileInfo.files.length) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    const file = fileInfo.files[index];
    
    if (!fs.existsSync(file.path)) {
        return res.status(404).json({ error: 'File no longer available' });
    }
    
    fileInfo.downloadCount++;
    saveTransfers();
    console.log(`File downloaded: ${file.originalName} from transfer ${code}`);
    
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.sendFile(file.path);
});

// Download all files as ZIP
app.get('/api/download-zip/:code', (req, res) => {
    const code = req.params.code.toUpperCase();
    const password = req.query.password;
    const selectedIndexes = req.query.indexes ? req.query.indexes.split(',').map(Number) : null;
    const fileInfo = fileStore.get(code);
    
    if (!fileInfo) {
        return res.status(404).json({ error: 'Transfer code not found or expired' });
    }
    
    // Check password if protected
    if (fileInfo.password) {
        if (!password || !bcrypt.compareSync(password, fileInfo.password)) {
            return res.status(401).json({ error: 'Password required' });
        }
    }
    
    // Determine which files to include
    const filesToZip = selectedIndexes 
        ? fileInfo.files.filter((_, idx) => selectedIndexes.includes(idx))
        : fileInfo.files;
    
    if (filesToZip.length === 0) {
        return res.status(404).json({ error: 'No files to download' });
    }
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="transfer-${code}.zip"`);
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err) => {
        console.error('Archive error:', err);
        res.status(500).json({ error: 'Failed to create ZIP file' });
    });
    
    archive.pipe(res);
    
    filesToZip.forEach(file => {
        if (fs.existsSync(file.path)) {
            // If file has folder path, preserve folder structure
            const archivePath = file.folderPath || file.originalName;
            archive.file(file.path, { name: archivePath });
        }
    });
    
    archive.finalize();
    
    fileInfo.downloadCount++;
    saveTransfers();
    console.log(`ZIP download: ${filesToZip.length} files from transfer ${code}`);
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
    saveTransfers();
    console.log(`Transfer deleted: ${code}`);
    
    res.json({ success: true, message: 'Files deleted' });
});

// Public settings endpoint (limited info for frontend)
app.get('/api/settings', (req, res) => {
    res.json({
        settings: {
            maxFileSize: systemSettings.maxFileSize,
            maxFiles: systemSettings.maxFiles,
            expiryTime: systemSettings.expiryTime,
            allowAnonymous: systemSettings.allowAnonymous
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        activeTransfers: fileStore.size
    });
});

// Serve pages
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'signup.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
    console.log('');
    console.log('=== Super Admin Credentials ===');
    console.log('Email: admin@filetransfer.com');
    console.log('Password: admin123');
    console.log('===============================');
});
