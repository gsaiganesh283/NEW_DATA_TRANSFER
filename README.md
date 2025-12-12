# 🚀 Secure File Transfer Application

A secure file transfer application with user authentication, admin dashboard, and MongoDB database for persistent storage.

## ✨ Features

- **Secure File Upload**: Upload files and get a unique transfer code
- **User Authentication**: Login/Signup with email or Google OAuth
- **Admin Dashboard**: Manage users, transfers, and system settings
- **MongoDB Database**: Persistent storage for all data
- **Password Protection**: Optionally protect transfers with passwords
- **ZIP Downloads**: Download multiple files as a ZIP archive
- **Custom Expiry**: Set custom expiry time (1-168 hours)
- **Folder Upload**: Upload entire folders with structure preserved
- **Real-time Stats**: Track downloads, storage usage, and more

## 🗄️ Database Setup (MongoDB Atlas - FREE)

### Step 1: Create MongoDB Atlas Account
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up for a free account
3. Create a new cluster (Free M0 tier)

### Step 2: Configure Database Access
1. Go to **Database Access** → **Add New Database User**
2. Create a username and password (save these!)
3. Set privileges to "Read and Write to any database"

### Step 3: Configure Network Access
1. Go to **Network Access** → **Add IP Address**
2. Click **"Allow Access from Anywhere"** (0.0.0.0/0)
3. Click **Confirm**

### Step 4: Get Connection String
1. Go to **Database** → **Connect** → **Connect your application**
2. Copy the connection string, it looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
3. Replace `<username>` and `<password>` with your credentials
4. Add database name: `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/filetransfer?retryWrites=true&w=majority`

### Step 5: Set Environment Variable
Set `MONGODB_URI` environment variable with your connection string.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm
- MongoDB Atlas account (free)

### Installation

1. **Clone or navigate to the project directory**:
   ```bash
   cd NEW_DATA_TRANSFER
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set environment variables**:
   ```bash
   # Windows PowerShell
   $env:MONGODB_URI="mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/filetransfer?retryWrites=true&w=majority"
   
   # Linux/Mac
   export MONGODB_URI="mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/filetransfer?retryWrites=true&w=majority"
   ```

4. **Start the server**:
   ```bash
   npm start
   ```

   For development with auto-restart:
   ```bash
   npm run dev
   ```

4. **Access the application**:
   Open your browser and go to `http://localhost:3000`

## 📖 How to Use

### Sending Files (Laptop A)

1. Open the application in your browser
2. Click **"Create Room (Send Files)"**
3. A 6-digit room code will be generated
4. Share this code with the receiving laptop
5. Once connected, drag and drop files or click to browse
6. Files will transfer automatically

### Receiving Files (Laptop B)

1. Open the application in your browser
2. Click **"Join Room (Receive Files)"**
3. Enter the 6-digit room code shared by the sender
4. Click **"Connect"**
5. Once connected, you'll receive files automatically
6. Downloaded files appear in transfer history with download buttons

## 🔒 Security Features

- **End-to-End Encryption**: WebRTC provides built-in encryption (DTLS-SRTP)
- **No Server Storage**: Files transfer directly between peers
- **Temporary Room Codes**: Rooms expire when peers disconnect
- **Private Connections**: Each room supports only two peers

## 🌐 Network Requirements

- **Internet Connection**: Both devices need internet access
- **Firewall**: Allow WebRTC traffic (UDP ports)
- **NAT Traversal**: Uses STUN servers for connection establishment

## 🛠️ Configuration

### Custom Port
Edit `server.js` to change the port:
```javascript
const PORT = process.env.PORT || 3000;
```

Or set environment variable:
```bash
PORT=8080 npm start
```

### Custom STUN Servers
Edit `app.js` to add/modify STUN servers:
```javascript
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};
```

## 📊 Performance

- **Chunk Size**: 16KB chunks for optimal transfer
- **Concurrent Transfers**: Supports multiple files in queue
- **Buffer Management**: Efficient memory handling for large files
- **Progress Updates**: Real-time progress calculation

## 🐛 Troubleshooting

### Connection Issues
- **Check firewall settings**: Ensure WebRTC ports are not blocked
- **Try different network**: Some corporate networks block P2P connections
- **Verify both devices are online**: Both need active internet connection

### Slow Transfer Speeds
- **Network quality**: Transfer speed depends on both connections
- **Reduce network load**: Close bandwidth-heavy applications
- **Check router settings**: QoS settings may affect P2P traffic

### Room Code Not Working
- **Case sensitive**: Ensure code is entered correctly (uppercase)
- **Room full**: Each room supports only 2 peers
- **Expired room**: Create a new room if connection failed

## 📁 Project Structure

```
NEW_DATA_TRANSFER/
├── server.js           # Main Express server with MongoDB
├── package.json        # Project dependencies
├── config/
│   └── database.js     # MongoDB connection config
├── models/
│   ├── User.js         # User model schema
│   ├── Transfer.js     # Transfer model schema
│   └── Settings.js     # Settings model schema
├── index.html          # Main upload/download page
├── login.html          # Login page
├── signup.html         # Signup page
├── admin.html          # Admin dashboard
├── app.js              # Frontend JavaScript
├── auth.js             # Auth frontend JavaScript
├── admin.js            # Admin frontend JavaScript
├── styles.css          # Main styles
├── auth.css            # Auth page styles
├── Dockerfile          # Docker configuration
└── render.yaml         # Render deployment config
```

## 🚀 Deployment on Render (FREE)

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Add MongoDB support"
git push origin main
```

### Step 2: Create Render Service
1. Go to [Render.com](https://render.com)
2. Connect your GitHub repository
3. Select "Web Service"
4. Use the following settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### Step 3: Add Environment Variables on Render
1. Go to your service → **Environment**
2. Add the following variables:
   - `MONGODB_URI` = Your MongoDB Atlas connection string
   - `JWT_SECRET` = (auto-generated or custom)
   - `GOOGLE_CLIENT_ID` = (optional, for Google OAuth)
   - `GOOGLE_CLIENT_SECRET` = (optional, for Google OAuth)

### Step 4: Deploy
Click "Deploy" and wait for the build to complete.

## 🔐 Super Admin Credentials

After first deployment, login with:
- **Email**: admin@filetransfer.com
- **Password**: admin123

⚠️ **Change this password immediately after first login!**

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

## 💡 Future Enhancements

- [ ] Resume interrupted transfers
- [ ] Transfer speed optimization
- [ ] Multiple peer support (group sharing)
- [ ] File encryption option
- [ ] Transfer statistics and analytics
- [ ] Mobile app support
- [ ] TURN server support for restrictive networks
- [ ] Voice/video chat integration

## 📞 Support

For issues or questions, please create an issue in the repository.

---

**Built with ❤️ using WebRTC, Socket.io, and modern web technologies**
