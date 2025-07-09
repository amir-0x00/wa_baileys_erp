export interface MessageQueueItem {
  id: string;
  phoneNumber: string;
  message: string;
  media?: {
    type: 'image' | 'document' | 'video' | 'audio';
    path: string;
    filename?: string;
  };
  timestamp: number;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  retryCount: number;
}

export interface WhatsAppState {
  isConnected: boolean;
  isAuthenticated: boolean;
  qrCode?: string;
  lastActivity: number;
}

export interface SendMessageRequest {
  phoneNumber: string;
  message: string;
  media?: {
    type: 'image' | 'document' | 'video' | 'audio';
    path: string;
    filename?: string;
  };
}

export interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  queuePosition?: number;
}

export interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}
