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
const mongoose = require('mongoose');

// Import Models
const User = require('./models/User');
const Transfer = require('./models/Transfer');
const Settings = require('./models/Settings');

const app = express();
const server = http.createServer(app);

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// MongoDB Connection (password @ is encoded as %40)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://filetransfer:Ganesh05%40GG@cluster0.seiftfg.mongodb.net/filetransfer?retryWrites=true&w=majority';

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

// Database connection status
let dbConnected = false;

// Connect to MongoDB
async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        dbConnected = true;
        console.log('✅ MongoDB Connected Successfully');
        
        // Initialize SuperAdmin after DB connection
        await initializeSuperAdmin();
        
        // Initialize default settings
        await initializeSettings();
        
        return true;
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        console.log('⚠️  Running without database - data will not persist!');
        dbConnected = false;
        return false;
    }
}

// Initialize with superadmin if not exists
async function initializeSuperAdmin() {
    try {
        const superadmin = await User.findOne({ role: 'superadmin' });
        
        if (!superadmin) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                name: 'Super Admin',
                email: 'admin@filetransfer.com',
                password: hashedPassword,
                role: 'superadmin',
                provider: 'local'
            });
            console.log('✅ Super Admin created with email: admin@filetransfer.com and password: admin123');
        }
    } catch (error) {
        console.error('Error initializing superadmin:', error);
    }
}

// Initialize default settings
async function initializeSettings() {
    try {
        let settings = await Settings.findOne({ key: 'global' });
        if (!settings) {
            settings = await Settings.create({ key: 'global' });
            console.log('✅ Default settings initialized');
        }
        return settings;
    } catch (error) {
        console.error('Error initializing settings:', error);
        return null;
    }
}

// Get system settings
async function getSettings() {
    try {
        if (!dbConnected) {
            return {
                maxFileSize: 2000,
                maxFilesPerTransfer: 50,
                defaultExpiryHours: 24,
                storagePath: 'uploads'
            };
        }
        let settings = await Settings.findOne({ key: 'global' });
        if (!settings) {
            settings = await Settings.create({ key: 'global' });
        }
        return settings;
    } catch (error) {
        console.error('Error getting settings:', error);
        return {
            maxFileSize: 2000,
            maxFilesPerTransfer: 50,
            defaultExpiryHours: 24,
            storagePath: 'uploads'
        };
    }
}

// Get current upload directory based on settings
async function getUploadDir() {
    const settings = await getSettings();
    let uploadPath = settings.storagePath || 'uploads';
    
    if (!path.isAbsolute(uploadPath)) {
        uploadPath = path.join(__dirname, uploadPath);
    }
    
    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    return uploadPath;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = await getUploadDir();
        cb(null, uploadDir);
    },
    filename: async (req, file, cb) => {
        const uploadDir = await getUploadDir();
        const date = new Date();
        const dateDir = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const fullDir = path.join(uploadDir, dateDir);
        
        if (!fs.existsSync(fullDir)) {
            fs.mkdirSync(fullDir, { recursive: true });
        }
        
        const uniqueName = crypto.randomBytes(16).toString('hex') + path.extname(file.originalname);
        cb(null, path.join(dateDir, uniqueName));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2147483648 } // 2GB default
});

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
        { id: user._id || user.id, email: user.email, role: user.role },
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

// Optional Auth Middleware
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
async function cleanupExpiredFiles() {
    if (!dbConnected) return;
    
    try {
        const expiredTransfers = await Transfer.find({ expiresAt: { $lt: new Date() } });
        
        for (const transfer of expiredTransfers) {
            // Delete physical files
            for (const file of transfer.files) {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            }
            // Delete from database
            await Transfer.deleteOne({ _id: transfer._id });
            console.log(`Cleaned up expired transfer: ${transfer.code}`);
        }
    } catch (error) {
        console.error('Cleanup error:', error);
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

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            name: name || email.split('@')[0],
            email: email.toLowerCase(),
            password: hashedPassword,
            role: 'user',
            provider: 'local'
        });

        const token = generateToken(newUser);
        const userResponse = newUser.toObject();
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

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (user.provider !== 'local') {
            return res.status(401).json({ error: `Please login with ${user.provider}` });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        const token = generateToken(user);
        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({ token, user: userResponse });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Verify Token
app.get('/auth/verify', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ valid: true, user });
    } catch (error) {
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Logout
app.post('/auth/logout', authenticateToken, (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

// Google OAuth - Initiate
app.get('/auth/google', (req, res) => {
    if (!GOOGLE_CLIENT_ID) {
        return res.status(500).json({ error: 'Google OAuth not configured' });
    }
    
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(GOOGLE_CALLBACK_URL)}` +
        `&response_type=code` +
        `&scope=email%20profile` +
        `&access_type=offline`;
    
    res.redirect(googleAuthUrl);
});

// Google OAuth Callback
app.get('/auth/google/callback', async (req, res) => {
    try {
        const { code } = req.query;
        
        if (!code) {
            return res.redirect('/login.html?error=Google login failed');
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
            return res.redirect('/login.html?error=Failed to get access token');
        }

        // Get user info
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });

        const googleUser = await userInfoResponse.json();

        // Find or create user
        let user = await User.findOne({ email: googleUser.email.toLowerCase() });

        if (!user) {
            user = await User.create({
                name: googleUser.name,
                email: googleUser.email.toLowerCase(),
                role: 'user',
                provider: 'google',
                googleId: googleUser.id
            });
        } else if (user.provider !== 'google') {
            user.provider = 'google';
            user.googleId = googleUser.id;
            await user.save();
        }

        user.lastLogin = new Date();
        await user.save();

        const token = generateToken(user);
        res.redirect(`/?token=${token}`);
    } catch (error) {
        console.error('Google OAuth error:', error);
        res.redirect('/login.html?error=Google login failed');
    }
});

// ==================== ADMIN ROUTES ====================

// Get admin stats
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeTransfers = await Transfer.countDocuments({ expiresAt: { $gt: new Date() } });
        
        const transfers = await Transfer.find();
        const totalDownloads = transfers.reduce((sum, t) => sum + (t.downloadCount || 0), 0);
        const totalStorage = transfers.reduce((sum, t) => sum + (t.totalSize || 0), 0);

        res.json({
            totalUsers,
            activeTransfers,
            totalDownloads,
            storageUsed: totalStorage
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Get all users
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json({ users: users.map(u => ({ ...u.toObject(), id: u._id })) });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Get single user
app.get('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user: { ...user.toObject(), id: user._id } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Update user
app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, email, role } = req.body;
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent modifying superadmin unless you are superadmin
        if (user.role === 'superadmin' && req.user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Cannot modify superadmin' });
        }

        if (name) user.name = name;
        if (email) user.email = email.toLowerCase();
        if (role && req.user.role === 'superadmin') user.role = role;
        
        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;
        res.json({ user: { ...userResponse, id: user._id } });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.role === 'superadmin') {
            return res.status(403).json({ error: 'Cannot delete superadmin' });
        }

        await User.deleteOne({ _id: req.params.id });
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Get all transfers
app.get('/api/admin/transfers', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const transfers = await Transfer.find().sort({ createdAt: -1 });
        const transfersList = transfers.map(t => ({
            code: t.code,
            files: t.files,
            totalSize: t.totalSize,
            uploadedAt: t.createdAt,
            expiresAt: t.expiresAt,
            downloadCount: t.downloadCount,
            uploaderEmail: t.uploaderEmail,
            hasPassword: !!t.password,
            message: t.message
        }));
        res.json({ transfers: transfersList });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get transfers' });
    }
});

// Delete transfer
app.delete('/api/admin/transfers/:code', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const transfer = await Transfer.findOne({ code: req.params.code });
        
        if (!transfer) {
            return res.status(404).json({ error: 'Transfer not found' });
        }

        // Delete physical files
        for (const file of transfer.files) {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        }

        await Transfer.deleteOne({ code: req.params.code });
        res.json({ message: 'Transfer deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete transfer' });
    }
});

// Update settings
app.put('/api/admin/settings', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { maxFileSize, maxFiles, expiryTime, storagePath, enableCloudStorage, cloudProvider, cloudBucket, cloudRegion } = req.body;
        
        let settings = await Settings.findOne({ key: 'global' });
        if (!settings) {
            settings = new Settings({ key: 'global' });
        }

        if (maxFileSize !== undefined) settings.maxFileSize = maxFileSize;
        if (maxFiles !== undefined) settings.maxFilesPerTransfer = maxFiles;
        if (expiryTime !== undefined) settings.defaultExpiryHours = expiryTime;
        if (storagePath !== undefined) settings.storagePath = storagePath;
        if (enableCloudStorage !== undefined) settings.enableCloudStorage = enableCloudStorage;
        if (cloudProvider !== undefined) settings.cloudProvider = cloudProvider;
        if (cloudBucket !== undefined) settings.cloudBucket = cloudBucket;
        if (cloudRegion !== undefined) settings.cloudRegion = cloudRegion;
        settings.updatedAt = new Date();

        await settings.save();
        res.json({ message: 'Settings updated successfully', settings });
    } catch (error) {
        console.error('Settings update error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Get settings
app.get('/api/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const settings = await getSettings();
        res.json({ settings });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

// ==================== DATABASE MANAGEMENT API (SuperAdmin Only) ====================

// Get all database info
app.get('/api/admin/database', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        const settings = await Settings.findOne({ key: 'global' });
        const transfers = await Transfer.find();

        res.json({
            success: true,
            databases: {
                users: {
                    name: 'users',
                    recordCount: users.length,
                    data: users.map(u => ({ ...u.toObject(), id: u._id, password: '[HIDDEN]' }))
                },
                settings: {
                    name: 'settings',
                    data: settings ? settings.toObject() : {}
                },
                transfers: {
                    name: 'transfers',
                    recordCount: transfers.length,
                    data: transfers.map(t => ({
                        ...t.toObject(),
                        id: t.code,
                        password: t.password ? '[PROTECTED]' : null
                    }))
                }
            }
        });
    } catch (error) {
        console.error('Database read error:', error);
        res.status(500).json({ error: 'Failed to read database' });
    }
});

// Download database
app.get('/api/admin/database/download/:type', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { type } = req.params;
        let data;
        let filename;

        if (type === 'users') {
            data = await User.find().select('-password');
            filename = 'users.json';
        } else if (type === 'settings') {
            data = await Settings.findOne({ key: 'global' });
            filename = 'settings.json';
        } else if (type === 'transfers') {
            data = await Transfer.find();
            filename = 'transfers.json';
        } else if (type === 'all') {
            const users = await User.find();
            const settings = await Settings.findOne({ key: 'global' });
            const transfers = await Transfer.find();
            data = {
                exportedAt: new Date().toISOString(),
                users: users.map(u => ({ ...u.toObject(), password: '[EXPORTED]' })),
                settings: settings ? settings.toObject() : {},
                transfers: transfers.map(t => t.toObject())
            };
            filename = `backup-${Date.now()}.json`;
        } else {
            return res.status(400).json({ error: 'Invalid database type' });
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json(data);
    } catch (error) {
        console.error('Database download error:', error);
        res.status(500).json({ error: 'Failed to download database' });
    }
});

// Update database
app.put('/api/admin/database/:type', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { type } = req.params;
        const { data } = req.body;

        if (type === 'settings') {
            await Settings.findOneAndUpdate({ key: 'global' }, data, { upsert: true });
            res.json({ message: 'Settings updated successfully' });
        } else {
            return res.status(400).json({ error: 'Only settings can be directly edited' });
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
            return res.status(400).json({ error: 'Current and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// ==================== FILE TRANSFER ROUTES ====================

// Upload files
app.post('/api/upload', optionalAuth, (req, res, next) => {
    upload.array('files', 50)(req, res, async (err) => {
        if (err) {
            console.error('Upload error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File size exceeds limit' });
            }
            return res.status(500).json({ error: 'Upload failed: ' + err.message });
        }

        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'No files uploaded' });
            }

            const settings = await getSettings();
            const code = generateTransferCode();
            
            // Calculate expiry
            let expiryHours = parseInt(req.body.expiryHours) || settings.defaultExpiryHours || 24;
            expiryHours = Math.min(expiryHours, 168); // Max 7 days
            const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

            const uploadDir = await getUploadDir();
            const files = req.files.map(file => ({
                originalName: file.originalname,
                storedName: file.filename,
                path: path.join(uploadDir, file.filename),
                size: file.size,
                mimeType: file.mimetype
            }));

            const totalSize = files.reduce((sum, f) => sum + f.size, 0);

            // Handle password
            let hashedPassword = null;
            if (req.body.password && req.body.password.trim()) {
                hashedPassword = await bcrypt.hash(req.body.password, 10);
            }

            // Create transfer in database
            console.log('Creating transfer with files:', files.map(f => f.originalName));
            const transfer = await Transfer.create({
                code,
                files,
                totalSize,
                expiresAt,
                password: hashedPassword,
                message: req.body.message || '',
                uploaderEmail: req.user?.email || null
            });

            console.log(`✅ Transfer saved to DB: ${code} with ${files.length} files`);
            console.log('Transfer ID:', transfer._id);

            res.json({
                code,
                files: files.length,
                totalSize,
                expiresAt: transfer.expiresAt,
                hasPassword: !!hashedPassword
            });
        } catch (error) {
            console.error('Upload processing error:', error);
            res.status(500).json({ error: 'Failed to process upload' });
        }
    });
});

// Get files info
app.get('/api/files/:code', async (req, res) => {
    try {
        const transfer = await Transfer.findOne({ code: req.params.code.toUpperCase() });

        if (!transfer) {
            console.log(`Transfer not found: ${req.params.code.toUpperCase()}`);
            return res.status(404).json({ error: 'Transfer not found or expired' });
        }

        console.log(`Found transfer ${transfer.code} with ${transfer.files.length} files`);

        if (transfer.expiresAt < new Date()) {
            await Transfer.deleteOne({ code: transfer.code });
            return res.status(404).json({ error: 'Transfer has expired' });
        }

        const responseData = {
            files: transfer.files.map(f => ({
                name: f.originalName,
                size: f.size,
                type: f.mimeType
            })),
            totalSize: transfer.totalSize,
            uploadedAt: transfer.createdAt,
            expiresAt: transfer.expiresAt,
            downloadCount: transfer.downloadCount,
            hasPassword: !!transfer.password,
            message: transfer.message
        };
        
        console.log('Sending files:', responseData.files.length);
        res.json(responseData);
    } catch (error) {
        console.error('Get files error:', error);
        res.status(500).json({ error: 'Failed to get files' });
    }
});

// Verify password
app.post('/api/files/:code/verify', async (req, res) => {
    try {
        const transfer = await Transfer.findOne({ code: req.params.code.toUpperCase() });

        if (!transfer) {
            return res.status(404).json({ error: 'Transfer not found' });
        }

        if (!transfer.password) {
            return res.json({ valid: true });
        }

        const { password } = req.body;
        const isValid = await bcrypt.compare(password || '', transfer.password);

        res.json({ valid: isValid });
    } catch (error) {
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Download single file
app.get('/api/download/:code/:index', async (req, res) => {
    try {
        const transfer = await Transfer.findOne({ code: req.params.code.toUpperCase() });

        if (!transfer) {
            return res.status(404).json({ error: 'Transfer not found' });
        }

        if (transfer.expiresAt < new Date()) {
            return res.status(404).json({ error: 'Transfer has expired' });
        }

        const index = parseInt(req.params.index);
        if (isNaN(index) || index < 0 || index >= transfer.files.length) {
            return res.status(400).json({ error: 'Invalid file index' });
        }

        const file = transfer.files[index];
        if (!fs.existsSync(file.path)) {
            return res.status(404).json({ error: 'File not found on server' });
        }

        // Increment download count
        transfer.downloadCount += 1;
        await transfer.save();

        res.download(file.path, file.originalName);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
});

// Download as ZIP
app.get('/api/download-zip/:code', async (req, res) => {
    try {
        const transfer = await Transfer.findOne({ code: req.params.code.toUpperCase() });

        if (!transfer) {
            return res.status(404).json({ error: 'Transfer not found' });
        }

        if (transfer.expiresAt < new Date()) {
            return res.status(404).json({ error: 'Transfer has expired' });
        }

        // Increment download count
        transfer.downloadCount += 1;
        await transfer.save();

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="transfer-${transfer.code}.zip"`);

        const archive = archiver('zip', { zlib: { level: 5 } });
        archive.pipe(res);

        for (const file of transfer.files) {
            if (fs.existsSync(file.path)) {
                archive.file(file.path, { name: file.originalName });
            }
        }

        await archive.finalize();
    } catch (error) {
        console.error('ZIP download error:', error);
        res.status(500).json({ error: 'ZIP download failed' });
    }
});

// Delete transfer (by uploader or admin)
app.delete('/api/files/:code', async (req, res) => {
    try {
        const transfer = await Transfer.findOne({ code: req.params.code.toUpperCase() });

        if (!transfer) {
            return res.status(404).json({ error: 'Transfer not found' });
        }

        // Delete physical files
        for (const file of transfer.files) {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        }

        await Transfer.deleteOne({ code: transfer.code });
        res.json({ message: 'Transfer deleted successfully' });
    } catch (error) {
        console.error('Delete transfer error:', error);
        res.status(500).json({ error: 'Failed to delete transfer' });
    }
});

// Get public settings
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await getSettings();
        res.json({
            maxFileSize: settings.maxFileSize || 2000,
            maxFiles: settings.maxFilesPerTransfer || 50,
            expiryTime: settings.defaultExpiryHours || 24
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

// Health check
app.get('/health', async (req, res) => {
    const transferCount = dbConnected ? await Transfer.countDocuments() : 0;
    res.json({ 
        status: 'ok', 
        database: dbConnected ? 'connected' : 'disconnected',
        activeTransfers: transferCount
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

// Connect to database then start server
connectDB().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🚀 Server running on port ${PORT}`);
        console.log(`   Open http://localhost:${PORT} in your browser`);
        console.log('');
        console.log('=== Super Admin Credentials ===');
        console.log('Email: admin@filetransfer.com');
        console.log('Password: admin123');
        console.log('===============================');
        console.log('');
        if (!dbConnected) {
            console.log('⚠️  WARNING: Database not connected!');
            console.log('   Set MONGODB_URI environment variable to connect to MongoDB Atlas');
            console.log('');
        }
    });
});
