/**
 * Evolution API TypeScript Types
 * 
 * Type definitions for Evolution API v2.x
 * Documentation: https://doc.evolution-api.com/
 */

// ============================================================================
// WEBHOOK EVENT TYPES
// ============================================================================

export interface EvolutionWebhookEvent {
  event: string; // e.g., "messages.upsert", "connection.update", "qrcode.updated"
  instance: string; // Instance name
  data: any; // Event-specific data
  destination?: string;
  date_time: string;
  server_url: string;
  apikey: string;
}

export interface EvolutionMessageUpsert {
  key: {
    remoteJid: string; // e.g., "1234567890@s.whatsapp.net"
    fromMe: boolean;
    id: string; // Message ID
  };
  messageType: 'conversation' | 'imageMessage' | 'documentMessage' | 'audioMessage' | 'videoMessage' | 'stickerMessage' | 'locationMessage' | 'contactMessage';
  message: {
    conversation?: string; // Text message content
    imageMessage?: EvolutionImageMessage;
    documentMessage?: EvolutionDocumentMessage;
    audioMessage?: EvolutionAudioMessage;
    videoMessage?: EvolutionVideoMessage;
  };
  messageTimestamp: number;
  pushName?: string; // Sender's display name
  status?: 'PENDING' | 'SERVER_ACK' | 'DELIVERY_ACK' | 'READ' | 'PLAYED';
}

export interface EvolutionImageMessage {
  url: string;
  mimetype: string;
  caption?: string;
  height?: number;
  width?: number;
}

export interface EvolutionDocumentMessage {
  url: string;
  mimetype: string;
  title?: string;
  fileName?: string;
  pageCount?: number;
  fileLength?: number;
  caption?: string;
}

export interface EvolutionAudioMessage {
  url: string;
  mimetype: string;
  seconds?: number;
  ptt?: boolean; // Voice message
}

export interface EvolutionVideoMessage {
  url: string;
  mimetype: string;
  caption?: string;
  seconds?: number;
}

export interface EvolutionConnectionUpdate {
  state: 'connecting' | 'open' | 'close';
  statusReason?: number;
  instance: string;
}

export interface EvolutionQRCode {
  pairingCode?: string;
  code?: string; // Base64 QR code image
  base64?: string;
}

// ============================================================================
// API REQUEST TYPES
// ============================================================================

export interface CreateInstanceRequest {
  instanceName: string;
  token?: string;
  number?: string; // Optional - not needed for QR code flow
  qrcode?: boolean;
  integration?: 'WHATSAPP-BAILEYS' | 'WHATSAPP-BUSINESS' | 'EVOLUTION';
  webhook?: string;
  webhookByEvents?: boolean;
  webhookEvents?: string[]; // Changed from 'events' to match API
  events?: string[]; // Keep for compatibility
  // QR code customization
  qrcodeOptions?: {
    colorDark?: string;  // Dark color for QR code (default: green)
    colorLight?: string; // Light/background color (default: white)
  };
}

export interface SendTextMessageRequest {
  number: string; // e.g., "1234567890" or "1234567890@s.whatsapp.net"
  text: string;
  delay?: number; // Delay in milliseconds
}

export interface SendMediaMessageRequest {
  number: string;
  mediatype: 'image' | 'document' | 'video' | 'audio';
  media: string; // URL or base64
  caption?: string;
  fileName?: string; // For documents
  mimetype?: string;
  delay?: number;
}

export interface SetWebhookRequest {
  enabled?: boolean;
  url: string;
  webhookByEvents?: boolean;
  webhook_by_events?: boolean; // Evolution API v2 format
  webhook_base64?: boolean;
  events?: string[];
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface EvolutionAPIResponse<T = any> {
  instance?: {
    instanceName: string;
    instanceId?: string;
    status?: string;
  };
  hash?: {
    apikey: string;
  };
  qrcode?: EvolutionQRCode;
  webhook?: {
    url: string;
    enabled: boolean;
    webhookByEvents: boolean;
    events: string[];
  };
  data?: T;
  message?: string;
  error?: string;
}

export interface InstanceInfo {
  instanceName: string;
  instanceId: string;
  status: 'open' | 'connecting' | 'close';
  profileName?: string;
  profilePicUrl?: string;
  profileStatus?: string;
  owner: string;
  serverUrl: string;
  apikey: string;
  webhookUrl?: string;
}

export interface SendMessageResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: any;
  messageTimestamp: number;
  status: string;
}

// ============================================================================
// CLIENT CONFIGURATION
// ============================================================================

export interface EvolutionClientConfig {
  baseUrl: string; // e.g., "https://evolution.yourdomain.com"
  apiKey: string; // Global API key
}

export interface EvolutionInstance {
  name: string;
  apiKey?: string; // Instance-specific API key (if different from global)
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class EvolutionAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'EvolutionAPIError';
  }
}

// ============================================================================
// WEBHOOK EVENT NAMES
// ============================================================================

export const EVOLUTION_EVENTS = {
  // Connection events
  CONNECTION_UPDATE: 'connection.update',
  QRCODE_UPDATED: 'qrcode.updated',
  
  // Message events
  MESSAGES_UPSERT: 'messages.upsert',
  MESSAGES_UPDATE: 'messages.update',
  MESSAGES_DELETE: 'messages.delete',
  SEND_MESSAGE: 'send.message',
  
  // Contact events
  CONTACTS_UPSERT: 'contacts.upsert',
  CONTACTS_UPDATE: 'contacts.update',
  
  // Chat events
  CHATS_UPSERT: 'chats.upsert',
  CHATS_UPDATE: 'chats.update',
  CHATS_DELETE: 'chats.delete',
  
  // Presence events
  PRESENCE_UPDATE: 'presence.update',
  
  // Group events
  GROUPS_UPSERT: 'groups.upsert',
  GROUP_UPDATE: 'group.update',
  GROUP_PARTICIPANTS_UPDATE: 'group_participants.update',
  
  // Call events
  CALL: 'call',
} as const;

export type EvolutionEventName = typeof EVOLUTION_EVENTS[keyof typeof EVOLUTION_EVENTS];
