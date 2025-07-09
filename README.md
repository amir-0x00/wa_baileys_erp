# WhatsApp Baileys ERP

A powerful WhatsApp messaging system built with Node.js, TypeScript, and Baileys. Send messages to Saudi and Egyptian phone numbers through a beautiful web interface or REST API with intelligent queue management and media support.

![WhatsApp Bot](https://img.shields.io/badge/WhatsApp-Bot-green)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)

## ✨ Features

- 🔐 **QR Code Authentication** - Easy WhatsApp login via web interface
- 📱 **Multi-Platform Support** - Send to Saudi and Egyptian phone numbers
- 📨 **Message Queue** - Intelligent queuing with random delays (1-5 seconds)
- 📎 **Media Support** - Send images, videos, audio, documents, and PDFs
- 🌐 **Web Interface** - Beautiful, responsive Arabic UI
- 🔌 **REST API** - Programmatic access for integrations
- 📊 **Real-time Updates** - Live status updates via WebSocket
- 🔄 **Auto-retry** - Automatic retry on failures (up to 3 attempts)
- 🛡️ **Duplicate Prevention** - Prevents multiple message submissions
- 📝 **Comprehensive Logging** - Detailed logs for debugging

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** or **yarn**
- **WhatsApp** installed on your phone
- **Git** (for cloning)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/amir-0x00/wa_baileys_erp.git
   cd wa_baileys_erp
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Build the project**

   ```bash
   npm run build
   ```

4. **Start the server**

   ```bash
   npm start
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

## 📱 WhatsApp Setup

### Step 1: Connect WhatsApp

1. Open `http://localhost:3000` in your browser
2. You'll see a QR code on the screen
3. Open WhatsApp on your phone
4. Go to **Settings** → **Linked Devices** → **Link a Device**
5. Scan the QR code with your phone
6. Wait for the connection to be established

### Step 2: Start Sending Messages

Once connected, you'll see a green checkmark and the message form will appear. You can now:

- Send text messages
- Upload and send media files
- Monitor message queue status
- View recent messages

## 🎯 Usage Examples

### Web Interface

1. **Send a Text Message**

   - Enter phone number: `0501234567` or `+966501234567`
   - Type your message
   - Click "إرسال الرسالة" (Send Message)

2. **Send Media**
   - Choose a file (images, videos, documents)
   - Add optional caption
   - Send the message

### REST API

#### Send Text Message

```bash
curl -X POST http://localhost:3000/api/send-message \
  -F "phoneNumber=0501234567" \
  -F "message=Hello from WhatsApp Bot\!"
```

#### Send Media Message

```bash
curl -X POST http://localhost:3000/api/send-message \
  -F "phoneNumber=0501234567" \
  -F "message=Check out this image\!" \
  -F "media=@/path/to/image.jpg"
```

#### Get Queue Status

```bash
curl http://localhost:3000/api/queue-status
```

#### Get WhatsApp Status

```bash
curl http://localhost:3000/api/status
```

### Direct API (No Frontend)

For programmatic access without the web interface:

```bash
curl -X POST http://localhost:3000/api/send-message-direct \
  -F "phoneNumber=0501234567" \
  -F "message=Direct API message" \
  -F "media=@/path/to/file.pdf"
```

## 📞 Supported Phone Number Formats

The system automatically detects and converts phone numbers:

### Saudi Numbers

- `0501234567` → `+966501234567`
- `966501234567` → `+966501234567`
- `+966501234567` → `+966501234567`
- `501234567` → `+966501234567`

### Egyptian Numbers

- `01234567890` → `+201234567890`
- `201234567890` → `+201234567890`
- `+201234567890` → `+201234567890`
- `1234567890` → `+201234567890`

## 📁 Project Structure

```
wa_baileys_erp/
├── src/
│   ├── index.ts              # Main server file
│   ├── routes/
│   │   └── api.ts           # REST API endpoints
│   ├── services/
│   │   ├── WhatsAppService.ts # WhatsApp connection & messaging
│   │   └── MessageQueue.ts   # Message queue management
│   ├── types/
│   │   └── index.ts         # TypeScript definitions
│   └── utils/
│       ├── logger.ts        # Logging configuration
│       └── phoneNumber.ts   # Phone number utilities
├── public/
│   ├── index.html           # Web interface
│   ├── app.js              # Frontend JavaScript
│   └── styles.css          # CSS styles
├── uploads/                 # Temporary media files
├── auth_info_baileys/      # WhatsApp session data
├── package.json
├── tsconfig.json
└── README.md
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file (optional):

```env
PORT=3000
NODE_ENV=production
```

### Available Scripts

```bash
# Development (with auto-reload)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Clean build files
npm run clean
```

## 🔧 API Reference

### Endpoints

| Method | Endpoint                   | Description                    |
| ------ | -------------------------- | ------------------------------ |
| `POST` | `/api/send-message`        | Send message via web interface |
| `POST` | `/api/send-message-direct` | Send message via API only      |
| `GET`  | `/api/queue-status`        | Get message queue status       |
| `GET`  | `/api/status`              | Get WhatsApp connection status |
| `GET`  | `/api/message/:id`         | Get specific message status    |
| `POST` | `/api/logout`              | Logout from WhatsApp           |

### Request Examples

#### Send Message

```javascript
const formData = new FormData();
formData.append('phoneNumber', '0501234567');
formData.append('message', 'Hello World!');
formData.append('media', file); // Optional

fetch('/api/send-message', {
  method: 'POST',
  body: formData,
});
```

#### Response Format

```json
{
  "success": true,
  "messageId": "uuid-here",
  "queuePosition": 1
}
```

## 🛠️ Development

### Prerequisites

```bash
npm install -g typescript ts-node-dev
```

### Development Mode

```bash
npm run dev
```

### Building

```bash
npm run build
```

### Code Structure

- **TypeScript** for type safety
- **Express** for REST API
- **Socket.IO** for real-time updates
- **Baileys** for WhatsApp integration
- **Winston** for logging

## 🐛 Troubleshooting

### Common Issues

#### QR Code Not Appearing

- ✅ Check if server is running on `http://localhost:3000`
- ✅ Ensure no firewall blocking the port
- ✅ Check browser console for errors

#### Messages Not Sending

- ✅ Verify WhatsApp is connected (green checkmark)
- ✅ Check phone number format
- ✅ Ensure message is not empty
- ✅ Check queue status for pending messages

#### Connection Issues

- ✅ Restart the server: `npm start`
- ✅ Clear browser cache
- ✅ Check if WhatsApp session expired
- ✅ Re-scan QR code if needed

#### File Upload Problems

- ✅ File size limit: 16MB
- ✅ Supported formats: images, videos, audio, documents
- ✅ Check file permissions

### Logs

Check the console output for detailed logs:

- **Info**: Normal operations
- **Warn**: Non-critical issues
- **Error**: Critical problems

## 🔒 Security Features

- ✅ File type validation
- ✅ File size limits (16MB)
- ✅ Phone number validation
- ✅ Rate limiting via message queue
- ✅ Session cleanup on logout
- ✅ Duplicate submission prevention

## 📊 Message Queue System

The intelligent queue system prevents WhatsApp blocking:

- **Random Delays**: 1-5 seconds between messages
- **Auto-retry**: Up to 3 attempts on failure
- **Real-time Status**: Live updates via WebSocket
- **Queue Management**: Automatic cleanup and monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/wa_baileys_erp/issues)
- **Documentation**: This README
- **Logs**: Check console output for debugging

## 🙏 Acknowledgments

- [@whiskeysockets/baileys](https://github.com/whiskeysockets/baileys) - WhatsApp Web API
- [Express.js](https://expressjs.com/) - Web framework
- [Socket.IO](https://socket.io/) - Real-time communication

---

**Made with ❤️ for WhatsApp automation**
