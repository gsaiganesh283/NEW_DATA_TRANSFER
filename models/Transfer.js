const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    files: [{
        originalName: String,
        storedName: String,
        path: String,
        size: Number,
        mimeType: String
    }],
    totalSize: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    downloadCount: {
        type: Number,
        default: 0
    },
    maxDownloads: {
        type: Number,
        default: null
    },
    password: {
        type: String,
        default: null
    },
    message: {
        type: String,
        default: ''
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    uploaderEmail: {
        type: String,
        default: null
    },
    isZipped: {
        type: Boolean,
        default: false
    },
    zipPath: {
        type: String,
        default: null
    }
});

// Index for cleanup queries
transferSchema.index({ expiresAt: 1 });
transferSchema.index({ uploaderEmail: 1 });

module.exports = mongoose.model('Transfer', transferSchema);
