const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: function() {
            return this.provider === 'local';
        }
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'superadmin'],
        default: 'user'
    },
    provider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },
    googleId: {
        type: String,
        sparse: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    }
});

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
