import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';

import { WhatsAppService } from './services/WhatsAppService';
import { MessageQueue } from './services/MessageQueue';
import apiRoutes, { setServices } from './routes/api';
import logger from './utils/logger';

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Create necessary directories
const dirs = ['uploads', 'auth_info_baileys'];
dirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Clean up uploads directory on startup
const uploadsDir = path.join(__dirname, '../uploads');
if (fs.existsSync(uploadsDir)) {
  const files = fs.readdirSync(uploadsDir);
  files.forEach((file) => {
    const filePath = path.join(uploadsDir, file);
    try {
      fs.unlinkSync(filePath);
      logger.info('Cleaned up old upload file', { file });
    } catch (error) {
      logger.warn('Failed to cleanup old upload file', { file, error });
    }
  });
  logger.info('Uploads directory cleaned up on startup');
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api', apiRoutes);

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize services
const whatsappService = new WhatsAppService();
const messageQueue = new MessageQueue();

// Inject services into API routes
setServices(messageQueue, whatsappService);

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id });

  // Send current state to new client
  const currentState = whatsappService.getState();
  socket.emit('stateChange', currentState);

  // Send current queue status
  const queueStatus = messageQueue.getStatus();
  socket.emit('queueStatus', queueStatus);

  socket.on('disconnect', () => {
    logger.info('Client disconnected', { socketId: socket.id });
  });
});

// --- Attach event listeners only ONCE ---
// Remove any existing listeners to avoid duplicates
messageQueue.removeAllListeners('sendMessage');
messageQueue.on('sendMessage', (message) => {
  whatsappService.emit('sendMessage', message);
});

// WhatsApp service event handlers
whatsappService.removeAllListeners('stateChange');
whatsappService.on('stateChange', (state) => {
  logger.info('WhatsApp state changed', typeof state === 'object' ? JSON.stringify(state) : state);
  io.emit('stateChange', state);
});

// Message queue event handlers
messageQueue.removeAllListeners('messageSending');
messageQueue.on('messageSending', (message) => {
  logger.info('Message sending', { messageId: message.id });
  io.emit('messageSending', message);
});

messageQueue.removeAllListeners('messageSent');
messageQueue.on('messageSent', (message) => {
  logger.info('Message sent', { messageId: message.id });
  // The WhatsApp service will emit the actual messageSent event with the WhatsApp ID
});

messageQueue.removeAllListeners('messageFailed');
messageQueue.on('messageFailed', (message) => {
  logger.error('Message failed', { messageId: message.id });
  io.emit('messageFailed', message.id, 'Message failed after retries');
});

// WhatsApp service message events
whatsappService.removeAllListeners('messageSent');
whatsappService.on('messageSent', (messageId, whatsappId) => {
  messageQueue.markAsSent(messageId);
  io.emit('messageSent', messageId, whatsappId);
});

whatsappService.removeAllListeners('messageFailed');
whatsappService.on('messageFailed', (messageId, error) => {
  messageQueue.markAsFailed(messageId, error);
  io.emit('messageFailed', messageId, error);
});

// Periodic queue status updates
setInterval(() => {
  const status = messageQueue.getStatus();
  io.emit('queueStatus', status);
}, 5000); // Update every 5 seconds

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');

  // Cleanup services
  whatsappService.cleanup();
  messageQueue.clear();

  // Close server
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');

  // Cleanup services
  whatsappService.cleanup();
  messageQueue.clear();

  // Close server
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    message: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    error,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', {
    reason: reason instanceof Error ? reason.stack || reason.message : reason,
    promise,
  });
  process.exit(1);
});

// Initialize WhatsApp service
async function initializeApp() {
  try {
    await whatsappService.initialize();
    logger.info('WhatsApp service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize WhatsApp service:', error);
    // Continue running the server even if WhatsApp fails to initialize
  }
}

// Start the server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Open http://localhost:${PORT} in your browser`);

  // Initialize WhatsApp service after server starts
  initializeApp();
});
