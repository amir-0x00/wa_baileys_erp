import {
  default as makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import { EventEmitter } from 'events';
import { WhatsAppState, MessageQueueItem } from '../types';
import logger from '../utils/logger';
import { PhoneNumberUtil } from '../utils/phoneNumber';

export class WhatsAppService extends EventEmitter {
  private sock?: WASocket;
  private state: WhatsAppState = {
    isConnected: false,
    isAuthenticated: false,
    lastActivity: Date.now(),
  };
  private qrCodeTimeout?: NodeJS.Timeout;
  private reconnectTimeout?: NodeJS.Timeout;
  private authFolder = './auth_info_baileys';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private processingMessages = new Set<string>(); // Track messages currently being processed

  constructor() {
    super();
  }

  /**
   * Initialize WhatsApp connection
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing WhatsApp connection...');

      const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);

      // Create a custom logger wrapper for Baileys to prevent [object Object] logs
      const baileysLogger = {
        level: 'info',
        trace: (...args: any[]) => {
          const message = args
            .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
            .join(' ');
          (logger as any).trace(message);
        },
        debug: (...args: any[]) => {
          const message = args
            .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
            .join(' ');
          logger.debug(message);
        },
        info: (...args: any[]) => {
          const message = args
            .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
            .join(' ');
          logger.info(message);
        },
        warn: (...args: any[]) => {
          const message = args
            .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
            .join(' ');
          logger.warn(message);
        },
        error: (...args: any[]) => {
          const message = args
            .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
            .join(' ');
          logger.error(message);
        },
        fatal: (...args: any[]) => {
          const message = args
            .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
            .join(' ');
          logger.error(message);
        },
        child: () => baileysLogger, // Return the same logger instance
      };

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: baileysLogger,
      });

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          await this.handleQRCode(qr);
        }

        if (connection === 'open') {
          this.state.isConnected = true;
          this.state.isAuthenticated = true;
          this.state.lastActivity = Date.now();
          this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
          this.emit('stateChange', this.state);

          logger.info('WhatsApp connected successfully');
        } else if (connection === 'close') {
          const shouldReconnect =
            (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

          this.state.isConnected = false;
          this.state.isAuthenticated = false;
          this.emit('stateChange', this.state);

          // Check if it's a conflict error (another session is using the same number)
          const isConflict =
            lastDisconnect?.error?.message?.includes('conflict') ||
            lastDisconnect?.error?.message?.includes('replaced') ||
            (lastDisconnect?.error as any)?.output?.payload?.error === 'conflict' ||
            JSON.stringify(lastDisconnect?.error).includes('conflict');

          if (isConflict) {
            logger.warn('WhatsApp session conflict detected - another session is using this number');
            // Don't reconnect on conflict, let user handle it manually
            return;
          }

          logger.info('Connection closed', { shouldReconnect });

          if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.warn('Max reconnection attempts reached, stopping reconnection attempts');
          }
        }
      });

      this.sock.ev.on('creds.update', saveCreds);

      // Listen for message queue events
      this.on('sendMessage', async (item: MessageQueueItem) => {
        await this.sendMessage(item);
      });
    } catch (error) {
      logger.error('Failed to initialize WhatsApp', { error });
      throw error;
    }
  }

  /**
   * Handle QR code generation
   */
  private async handleQRCode(qr: string): Promise<void> {
    try {
      // Clear any existing QR timeout
      if (this.qrCodeTimeout) {
        clearTimeout(this.qrCodeTimeout);
      }

      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(qr);
      this.state.qrCode = qrCodeDataUrl;
      this.state.lastActivity = Date.now();

      this.emit('stateChange', this.state);
      logger.info('QR Code generated');
      console.log(qrCodeDataUrl);

      // Set timeout to clear QR code after 2 minutes
      this.qrCodeTimeout = setTimeout(() => {
        delete this.state.qrCode;
        this.emit('stateChange', this.state);
        logger.info('QR Code expired');
      }, 2 * 60 * 1000);
    } catch (error) {
      logger.error('Failed to generate QR code', { error });
    }
  }

  /**
   * Send a message
   */
  async sendMessage(item: MessageQueueItem): Promise<void> {
    if (!this.sock || !this.state.isAuthenticated) {
      this.emit('messageFailed', item.id, 'WhatsApp not connected');
      return;
    }

    // Check if message is already being processed
    if (this.processingMessages.has(item.id)) {
      logger.warn(`Message ${item.id} is already being processed by WhatsApp service, skipping`);
      return;
    }

    // Mark as being processed
    this.processingMessages.add(item.id);

    try {
      const whatsappNumber = PhoneNumberUtil.formatForWhatsApp(item.phoneNumber);
      if (!whatsappNumber) {
        this.emit('messageFailed', item.id, 'Invalid phone number');
        return;
      }

      let messageOptions: any = {};

      // Handle media if present
      if (item.media) {
        const mediaMessage = await this.prepareMediaMessage(item.media);
        if (mediaMessage) {
          messageOptions = mediaMessage;
          // Always add text as caption for all media types
          if (item.message && item.message.trim()) {
            messageOptions.caption = item.message;
          }
        }
      } else {
        // If no media, just send text message
        if (item.message) {
          messageOptions.text = item.message;
        }
      }

      // Send the message
      const result = await this.sock.sendMessage(whatsappNumber, messageOptions);

      if (result && result.key) {
        this.state.lastActivity = Date.now();
        this.emit('messageSent', item.id, result.key.id);

        // Clean up media file after successful send
        if (item.media) {
          this.cleanupMediaFile(item.media.path);
        }

        logger.info('Message sent successfully', {
          messageId: item.id,
          phoneNumber: item.phoneNumber,
          whatsappId: result.key.id,
          hasMedia: !!item.media,
          mediaType: item.media?.type,
          hasText: !!item.message,
        });
      } else {
        throw new Error('Failed to send message: No result received');
      }
    } catch (error) {
      logger.error('Failed to send message', { error, messageId: item.id });

      // Clean up media file even if send failed
      if (item.media) {
        this.cleanupMediaFile(item.media.path);
      }

      this.emit('messageFailed', item.id, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      // Always remove from processing set
      this.processingMessages.delete(item.id);
    }
  }

  /**
   * Prepare media message
   */
  private async prepareMediaMessage(media: MessageQueueItem['media']): Promise<any> {
    if (!media || !this.sock) {
      logger.warn('No media or socket available for media message');
      return null;
    }

    try {
      const fs = await import('fs/promises');

      // Check if file exists
      try {
        await fs.access(media.path);
      } catch (error) {
        logger.error('Media file not found', { path: media.path, error });
        return null;
      }

      const fileBuffer = await fs.readFile(media.path);
      logger.info('Media file loaded successfully', {
        path: media.path,
        size: fileBuffer.length,
        type: media.type,
        filename: media.filename,
      });

      // Use the filename directly without any processing
      const filename = media.filename || 'File';

      switch (media.type) {
        case 'image':
          return {
            image: fileBuffer,
            caption: filename,
          };
        case 'document':
          return {
            document: fileBuffer,
            fileName: filename,
            mimetype: this.getMimeType(media.path),
          };
        case 'video':
          return {
            video: fileBuffer,
            caption: filename,
          };
        case 'audio':
          return {
            audio: fileBuffer,
            mimetype: this.getMimeType(media.path),
          };
        default:
          logger.warn('Unknown media type', { type: media.type });
          return null;
      }
    } catch (error) {
      logger.error('Failed to prepare media message', { error, media });
      return null;
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      mp4: 'video/mp4',
      avi: 'video/x-msvideo',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = Math.min(5000 * this.reconnectAttempts, 30000); // Exponential backoff, max 30 seconds

    this.reconnectTimeout = setTimeout(() => {
      logger.info(
        `Attempting to reconnect... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
      );
      this.initialize().catch((error) => {
        logger.error('Reconnection failed', { error, attempt: this.reconnectAttempts });
      });
    }, delay);
  }

  /**
   * Get current state
   */
  getState(): WhatsAppState {
    return { ...this.state };
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    try {
      if (this.sock) {
        await this.sock.logout();
      }

      this.state.isConnected = false;
      this.state.isAuthenticated = false;
      delete this.state.qrCode;
      this.emit('stateChange', this.state);

      // Clear timeouts
      if (this.qrCodeTimeout) {
        clearTimeout(this.qrCodeTimeout);
      }
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }

      logger.info('WhatsApp logged out successfully');
    } catch (error) {
      logger.error('Failed to logout', { error });
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    logger.info('Cleaning up WhatsApp service');

    // Clear timeouts
    if (this.qrCodeTimeout) {
      clearTimeout(this.qrCodeTimeout);
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Clear processing messages set
    this.processingMessages.clear();

    // Close socket
    if (this.sock) {
      // The socket will be closed automatically when the process ends
      // No need to explicitly call end() as it may cause issues
    }

    logger.info('WhatsApp service cleanup completed');
  }

  /**
   * Clean up media file after successful send
   */
  private async cleanupMediaFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      await fs.unlink(filePath);
      logger.info('Media file cleaned up', { path: filePath });
    } catch (error) {
      logger.warn('Failed to cleanup media file', { path: filePath, error });
    }
  }
}
