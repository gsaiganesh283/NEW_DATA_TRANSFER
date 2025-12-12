# 🚀 P2P Data Transfer Application

An advanced peer-to-peer data transfer application that allows you to transfer files directly between two laptops online without any third-party storage services. Built with WebRTC for secure, fast, and direct file transfers.

## ✨ Features

- **Direct P2P Transfer**: Files transfer directly between devices using WebRTC
- **No File Size Limits**: Transfer files of any size
- **Multiple File Support**: Send multiple files simultaneously
- **Real-time Progress**: Track transfer progress with speed indicators
- **Secure Connection**: End-to-end encrypted transfers
- **No Third-Party Storage**: Files never touch external servers
- **Modern UI**: Beautiful, responsive interface with drag-and-drop support
- **Transfer History**: Keep track of all transferred files
- **Room-based Connection**: Simple 6-digit room codes for pairing devices

## 🏗️ Architecture

### Backend (Node.js + Express + Socket.io)
- **Signaling Server**: Facilitates WebRTC connection establishment
- **Room Management**: Creates and manages transfer rooms
- **Peer Discovery**: Connects two devices using room codes

### Frontend (HTML + CSS + JavaScript)
- **WebRTC Data Channels**: Handles P2P file transfer
- **Socket.io Client**: Manages signaling and room coordination
- **Drag & Drop UI**: Modern interface for file selection
- **Progress Tracking**: Real-time transfer monitoring

### Technology Stack
- **WebRTC**: Peer-to-peer data channel for file transfer
- **Socket.io**: Real-time bidirectional signaling
- **Express.js**: Web server and API
- **STUN Servers**: NAT traversal for connection establishment

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone or navigate to the project directory**:
   ```bash
   cd NEW_DATA_TRANSFER
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
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
├── server.js           # Node.js/Express server with Socket.io
├── package.json        # Project dependencies
├── .gitignore         # Git ignore rules
└── public/            # Frontend files
    ├── index.html     # Main HTML structure
    ├── styles.css     # UI styling and animations
    └── app.js         # WebRTC and file transfer logic
```

## 🔧 Development

### Run in Development Mode
```bash
npm run dev
```

This uses nodemon to automatically restart the server on file changes.

### Testing Locally
1. Start the server
2. Open `http://localhost:3000` in two different browser windows
3. Create a room in one window
4. Join with the room code in the other window
5. Test file transfers between windows

## 🚀 Deployment

### Deploy to Cloud (Heroku, Railway, etc.)
1. Ensure `PORT` is read from environment variable
2. Add start script to package.json (already included)
3. Deploy using platform-specific instructions

### Deploy on Local Network
1. Start the server
2. Find your local IP address
3. Other devices can access via `http://YOUR_IP:3000`

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
