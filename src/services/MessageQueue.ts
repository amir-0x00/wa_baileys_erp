import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { MessageQueueItem, QueueStatus } from '../types';
import logger from '../utils/logger';

export class MessageQueue extends EventEmitter {
  private queue: MessageQueueItem[] = [];
  private isProcessing = false;
  private lastSendTime = 0;
  private processingTimeout?: NodeJS.Timeout;
  private processingMessages = new Set<string>(); // Track messages currently being processed

  constructor() {
    super();
  }

  /**
   * Add a message to the queue
   */
  addMessage(phoneNumber: string, message: string, media?: MessageQueueItem['media']): string {
    const messageId = uuidv4();
    const queueItem: MessageQueueItem = {
      id: messageId,
      phoneNumber,
      message,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
    };

    if (media) {
      queueItem.media = media;
    }

    this.queue.push(queueItem);
    logger.info(`Message added to queue: ${messageId}`, { phoneNumber, queueLength: this.queue.length });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return messageId;
  }

  /**
   * Process the message queue with random delays
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    logger.info('Starting queue processing');

    while (this.queue.length > 0) {
      // Get the first pending message and remove it from the queue immediately
      const pendingIndex = this.queue.findIndex(
        (msg) => msg.status === 'pending' && !this.processingMessages.has(msg.id),
      );
      if (pendingIndex === -1) break;

      const items = this.queue.splice(pendingIndex, 1); // Remove and get the item
      const item = items[0];
      if (!item) break; // Safety check

      // Double-check that this message is not already being processed
      if (this.processingMessages.has(item.id)) {
        logger.warn(`Message ${item.id} is already being processed, skipping`);
        continue;
      }

      // Mark as being processed
      this.processingMessages.add(item.id);

      try {
        // Calculate delay since last message (1-5 seconds)
        const timeSinceLastSend = Date.now() - this.lastSendTime;
        const minDelay = 1000; // 1 second
        const maxDelay = 5000; // 5 seconds
        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

        const actualDelay = Math.max(0, randomDelay - timeSinceLastSend);

        if (actualDelay > 0) {
          logger.info(`Waiting ${actualDelay}ms before sending next message`);
          await this.delay(actualDelay);
        }

        // Mark as sending
        item.status = 'sending';
        this.emit('messageSending', item);

        // Emit event for WhatsApp service to handle
        this.emit('sendMessage', item);

        this.lastSendTime = Date.now();

        // Wait a bit before processing next message
        await this.delay(100);
      } catch (error) {
        logger.error('Error processing queue item', { error, itemId: item.id });
        item.status = 'failed';
        item.retryCount++;
        this.processingMessages.delete(item.id); // Remove from processing set

        // Add back to queue for retry if under retry limit
        if (item.retryCount < 3) {
          item.status = 'pending';
          this.queue.push(item);
          logger.warn(`Message failed, will retry: ${item.id}`, { retryCount: item.retryCount, error });
        } else {
          // Permanently failed, don't add back to queue
          this.emit('messageFailed', item);
          logger.error(`Message permanently failed: ${item.id}`, { error });
        }
      }
    }

    this.isProcessing = false;
    logger.info('Queue processing completed');
  }

  /**
   * Mark a message as sent
   */
  markAsSent(messageId: string): void {
    const item = this.queue.find((msg) => msg.id === messageId);
    if (item) {
      item.status = 'sent';
      // Remove the message from queue immediately
      this.queue = this.queue.filter((msg) => msg.id !== messageId);
      this.processingMessages.delete(messageId); // Remove from processing set
      this.emit('messageSent', item);
      logger.info(`Message sent successfully: ${messageId}`);
    } else {
      // Message might have already been removed, log it
      this.processingMessages.delete(messageId); // Clean up processing set anyway
      logger.warn(`Message ${messageId} not found in queue when marking as sent`);
    }
  }

  /**
   * Mark a message as failed
   */
  markAsFailed(messageId: string, error?: string): void {
    const item = this.queue.find((msg) => msg.id === messageId);
    if (item) {
      item.status = 'failed';
      item.retryCount++;

      if (item.retryCount >= 3) {
        // Remove permanently failed messages
        this.queue = this.queue.filter((msg) => msg.id !== messageId);
        this.processingMessages.delete(messageId); // Remove from processing set
        this.emit('messageFailed', item);
        logger.error(`Message permanently failed: ${messageId}`, { error });
      } else {
        // Reset to pending for retry
        item.status = 'pending';
        this.processingMessages.delete(messageId); // Remove from processing set for retry
        logger.warn(`Message failed, will retry: ${messageId}`, { retryCount: item.retryCount, error });
      }
    } else {
      this.processingMessages.delete(messageId); // Clean up processing set anyway
      logger.warn(`Message ${messageId} not found in queue when marking as failed`);
    }
  }

  /**
   * Get queue status
   */
  getStatus(): QueueStatus {
    return {
      pending: this.queue.filter((msg) => msg.status === 'pending').length,
      processing: this.queue.filter((msg) => msg.status === 'sending').length,
      completed: 0, // We remove sent messages, so this is always 0
      failed: 0, // We remove failed messages, so this is always 0
    };
  }

  /**
   * Get a specific message by ID
   */
  getMessage(messageId: string): MessageQueueItem | undefined {
    return this.queue.find((msg) => msg.id === messageId);
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    this.isProcessing = false;
    this.processingMessages.clear(); // Clear processing set
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
    }
    logger.info('Message queue cleared');
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
