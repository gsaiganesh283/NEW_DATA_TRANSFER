const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    key: {
        type: String,
        default: 'global',
        unique: true
    },
    maxFileSize: {
        type: Number,
        default: 2147483648 // 2GB
    },
    maxFilesPerTransfer: {
        type: Number,
        default: 50
    },
    defaultExpiryHours: {
        type: Number,
        default: 24
    },
    allowedFileTypes: {
        type: [String],
        default: ['*']
    },
    maintenanceMode: {
        type: Boolean,
        default: false
    },
    storagePath: {
        type: String,
        default: 'uploads'
    },
    enableCloudStorage: {
        type: Boolean,
        default: false
    },
    cloudProvider: {
        type: String,
        default: 'local'
    },
    cloudBucket: {
        type: String,
        default: ''
    },
    cloudRegion: {
        type: String,
        default: ''
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Settings', settingsSchema);
