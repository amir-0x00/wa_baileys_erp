import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { SendMessageRequest, SendMessageResponse } from '../types';
import { PhoneNumberUtil } from '../utils/phoneNumber';
import logger from '../utils/logger';
import fs from 'fs';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      // Use timestamp-based filename to avoid encoding issues
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      cb(null, `file-${timestamp}${ext}`);
    },
  }),
  limits: {
    fileSize: 16 * 1024 * 1024, // 16MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/wmv',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/m4a',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

// Store references to services (will be injected)
let messageQueue: any;
let whatsappService: any;

export function setServices(queue: any, whatsapp: any) {
  messageQueue = queue;
  whatsappService = whatsapp;
}

/**
 * Send message endpoint
 */
router.post('/send-message', upload.single('media'), async (req: Request, res: Response) => {
  try {
    const { phoneNumber, message } = req.body as SendMessageRequest;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required',
      });
    }

    // Validate phone number
    const validPhoneNumber = PhoneNumberUtil.parseSaudiOrEgyptianNumber(phoneNumber);
    if (!validPhoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Saudi or Egyptian phone number format',
      });
    }

    // Get country code for logging
    const countryCode = PhoneNumberUtil.getCountryCode(phoneNumber);
    const countryName = countryCode === 'SA' ? 'Saudi' : countryCode === 'EG' ? 'Egyptian' : 'Unknown';

    // Check if WhatsApp is connected
    const state = whatsappService.getState();
    if (!state.isAuthenticated) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp is not connected. Please scan the QR code first.',
      });
    }

    // Prepare media info if file was uploaded
    let mediaInfo;
    if (req.file) {
      const fileType = getFileType(req.file.mimetype);

      // Fix UTF-8 encoding issue - try multiple encoding approaches
      let originalFilename = req.file.originalname;

      // Log the raw filename for debugging
      logger.info('Raw filename received', {
        originalName: req.file.originalname,
        buffer: Buffer.from(req.file.originalname).toString('hex'),
      });

      // Try multiple encoding fixes
      try {
        // Method 1: Try Latin-1 to UTF-8 conversion
        const buffer1 = Buffer.from(originalFilename, 'latin1');
        const decoded1 = buffer1.toString('utf8');

        // Method 2: Try direct UTF-8 interpretation
        const buffer2 = Buffer.from(originalFilename, 'binary');
        const decoded2 = buffer2.toString('utf8');

        // Method 3: Try Windows-1256 (Arabic encoding)
        const buffer3 = Buffer.from(originalFilename, 'latin1');
        const decoded3 = buffer3.toString('utf8');

        // Choose the best result (one that contains Arabic characters)
        const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

        if (arabicPattern.test(decoded1)) {
          originalFilename = decoded1;
          logger.info('Using Latin-1 to UTF-8 conversion', { result: decoded1 });
        } else if (arabicPattern.test(decoded2)) {
          originalFilename = decoded2;
          logger.info('Using binary to UTF-8 conversion', { result: decoded2 });
        } else if (arabicPattern.test(decoded3)) {
          originalFilename = decoded3;
          logger.info('Using Windows-1256 conversion', { result: decoded3 });
        } else {
          // If no Arabic characters found, use the original
          logger.warn('No Arabic characters detected in any conversion, using original', {
            original: req.file.originalname,
            decoded1,
            decoded2,
            decoded3,
          });
        }
      } catch (error) {
        logger.warn('Failed to fix filename encoding', { originalName: req.file.originalname, error });
      }

      mediaInfo = {
        type: fileType,
        path: req.file.path,
        filename: originalFilename,
      };

      logger.info('Media file uploaded successfully', {
        originalName: req.file.originalname,
        fixedName: originalFilename,
        savedFilename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype,
        fileType: fileType,
      });
    }

    // Add message to queue
    const messageId = messageQueue.addMessage(validPhoneNumber, message, mediaInfo);

    const response: SendMessageResponse = {
      success: true,
      messageId,
      queuePosition: messageQueue.getStatus().pending,
    };

    logger.info('Message queued successfully', {
      messageId,
      phoneNumber: validPhoneNumber,
      country: countryName,
      hasMedia: !!mediaInfo,
    });

    return res.json(response);
  } catch (error) {
    logger.error('Error in send-message endpoint', { error });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * Get queue status endpoint
 */
router.get('/queue-status', (req: Request, res: Response) => {
  try {
    const status = messageQueue.getStatus();
    res.json({
      success: true,
      status,
    });
  } catch (error) {
    logger.error('Error getting queue status', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * Get WhatsApp connection status
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const state = whatsappService.getState();
    res.json({
      success: true,
      status: state,
    });
  } catch (error) {
    logger.error('Error getting WhatsApp status', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * Logout endpoint
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    await whatsappService.logout();
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Error during logout', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * Get message status by ID
 */
router.get('/message/:messageId', (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const message = messageQueue.getMessage(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      });
    }

    return res.json({
      success: true,
      message,
    });
  } catch (error) {
    logger.error('Error getting message status', { error });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * Send message via multipart form data (no frontend interface)
 * POST /api/send-message-direct
 *
 * Form fields:
 * - phoneNumber: string (required)
 * - message: string (optional)
 * - media: file (optional)
 */
router.post('/send-message-direct', upload.single('media'), async (req: Request, res: Response) => {
  try {
    const { phoneNumber, message } = req.body;

    // Validate required fields
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
      });
    }

    // Validate phone number
    const validPhoneNumber = PhoneNumberUtil.parseSaudiOrEgyptianNumber(phoneNumber);
    if (!validPhoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Saudi or Egyptian phone number format',
      });
    }

    // Check if WhatsApp is connected
    const state = whatsappService.getState();
    if (!state.isAuthenticated) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp is not connected. Please scan the QR code first.',
      });
    }

    // Prepare media info if file was uploaded
    let mediaInfo;
    if (req.file) {
      const fileType = getFileType(req.file.mimetype);

      // Fix UTF-8 encoding issue - try multiple encoding approaches
      let originalFilename = req.file.originalname;

      // Log the raw filename for debugging
      logger.info('Raw filename received', {
        originalName: req.file.originalname,
        buffer: Buffer.from(req.file.originalname).toString('hex'),
      });

      // Try multiple encoding fixes
      try {
        // Method 1: Try Latin-1 to UTF-8 conversion
        const buffer1 = Buffer.from(originalFilename, 'latin1');
        const decoded1 = buffer1.toString('utf8');

        // Method 2: Try direct UTF-8 interpretation
        const buffer2 = Buffer.from(originalFilename, 'binary');
        const decoded2 = buffer2.toString('utf8');

        // Method 3: Try Windows-1256 (Arabic encoding)
        const buffer3 = Buffer.from(originalFilename, 'latin1');
        const decoded3 = buffer3.toString('utf8');

        // Choose the best result (one that contains Arabic characters)
        const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

        if (arabicPattern.test(decoded1)) {
          originalFilename = decoded1;
          logger.info('Using Latin-1 to UTF-8 conversion', { result: decoded1 });
        } else if (arabicPattern.test(decoded2)) {
          originalFilename = decoded2;
          logger.info('Using binary to UTF-8 conversion', { result: decoded2 });
        } else if (arabicPattern.test(decoded3)) {
          originalFilename = decoded3;
          logger.info('Using Windows-1256 conversion', { result: decoded3 });
        } else {
          // If no Arabic characters found, use the original
          logger.warn('No Arabic characters detected in any conversion, using original', {
            original: req.file.originalname,
            decoded1,
            decoded2,
            decoded3,
          });
        }
      } catch (error) {
        logger.warn('Failed to fix filename encoding', { originalName: req.file.originalname, error });
      }

      mediaInfo = {
        type: fileType,
        path: req.file.path,
        filename: originalFilename,
      };

      logger.info('Media file uploaded successfully via direct API', {
        originalName: req.file.originalname,
        fixedName: originalFilename,
        savedFilename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype,
        fileType: fileType,
      });
    }

    // Add message to queue
    const messageId = messageQueue.addMessage(validPhoneNumber, message || '', mediaInfo);

    logger.info('Message added to queue via direct API', {
      messageId,
      phoneNumber: validPhoneNumber,
      hasMedia: !!mediaInfo,
      hasText: !!message,
    });

    return res.json({
      success: true,
      messageId,
      phoneNumber: validPhoneNumber,
      hasMedia: !!mediaInfo,
      hasText: !!message,
      message: 'Message queued successfully',
    });
  } catch (error) {
    logger.error('Failed to queue message via direct API', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to queue message',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Helper function to determine file type from MIME type
 */
function getFileType(mimeType: string): 'image' | 'document' | 'video' | 'audio' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

/**
 * Clean up uploads directory
 */
router.post('/cleanup-uploads', (req: Request, res: Response) => {
  try {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      let cleanedCount = 0;

      files.forEach((file) => {
        const filePath = path.join(uploadsDir, file);
        try {
          fs.unlinkSync(filePath);
          cleanedCount++;
          logger.info('Manually cleaned up upload file', { file });
        } catch (error) {
          logger.warn('Failed to cleanup upload file', { file, error });
        }
      });

      res.json({
        success: true,
        message: `Cleaned up ${cleanedCount} files from uploads directory`,
        cleanedCount,
      });
    } else {
      res.json({
        success: true,
        message: 'Uploads directory does not exist',
        cleanedCount: 0,
      });
    }
  } catch (error) {
    logger.error('Error cleaning up uploads', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup uploads',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
