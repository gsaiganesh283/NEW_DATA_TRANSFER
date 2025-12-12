const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // MongoDB Atlas connection string - set this in environment variable
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/filetransfer';
        
        const conn = await mongoose.connect(mongoURI, {
            // These options are no longer needed in Mongoose 6+ but kept for compatibility
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
        
        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('MongoDB connection closed through app termination');
            process.exit(0);
        });

        return conn;
    } catch (error) {
        console.error('Error connecting to MongoDB:', error.message);
        // Don't exit, allow the app to work with file fallback if needed
        return null;
    }
};

module.exports = connectDB;
