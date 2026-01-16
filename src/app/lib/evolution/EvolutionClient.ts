/**
 * Evolution API Client
 * 
 * Handles all communication with Evolution API for WhatsApp integration
 * Documentation: https://doc.evolution-api.com/
 */

import {
  EvolutionClientConfig,
  EvolutionAPIResponse,
  EvolutionAPIError,
  CreateInstanceRequest,
  SendTextMessageRequest,
  SendMediaMessageRequest,
  SetWebhookRequest,
  InstanceInfo,
  SendMessageResponse,
} from './types';

export class EvolutionClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: EvolutionClientConfig) {
    // Remove trailing slash from baseUrl
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  public async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    customHeaders?: Record<string, string>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': this.apiKey,
      ...customHeaders,
    };

    try {
      console.log(`📡 Evolution API ${method} ${url}`);
      
      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('❌ Evolution API error:', responseData);
        throw new EvolutionAPIError(
          responseData.message || responseData.error || 'Evolution API request failed',
          response.status,
          responseData
        );
      }

      console.log(`✅ Evolution API success:`, responseData);
      return responseData as T;
    } catch (error: any) {
      if (error instanceof EvolutionAPIError) {
        throw error;
      }
      
      console.error('❌ Evolution API request failed:', error);
      throw new EvolutionAPIError(
        error.message || 'Network error',
        undefined,
        error
      );
    }
  }

  /**
   * Format phone number for WhatsApp
   * Removes special characters and adds @s.whatsapp.net if needed
   */
  private formatPhoneNumber(number: string): string {
    // Remove all non-numeric characters
    const cleaned = number.replace(/\D/g, '');
    
    // Add @s.whatsapp.net if not already present
    if (cleaned.includes('@')) {
      return cleaned;
    }
    
    return `${cleaned}@s.whatsapp.net`;
  }

  // ==========================================================================
  // INSTANCE MANAGEMENT
  // ==========================================================================

  /**
   * Create a new WhatsApp instance
   */
  async createInstance(request: CreateInstanceRequest): Promise<EvolutionAPIResponse> {
    // Remove qrcodeOptions as Evolution API doesn't support it in this format
    const { qrcodeOptions, ...apiRequest } = request as any;
    
    return await this.request<EvolutionAPIResponse>(
      'POST',
      '/instance/create',
      apiRequest
    );
  }

  /**
   * Get instance connection status and info
   */
  async getInstance(instanceName: string): Promise<InstanceInfo> {
    const response = await this.request<EvolutionAPIResponse<InstanceInfo>>(
      'GET',
      `/instance/connectionState/${instanceName}`
    );
    
    return response.data || response as any;
  }

  /**
   * Connect instance (after QR scan)
   */
  async connectInstance(instanceName: string): Promise<EvolutionAPIResponse> {
    return await this.request<EvolutionAPIResponse>(
      'GET',
      `/instance/connect/${instanceName}`
    );
  }

  /**
   * Logout and disconnect instance
   */
  async logoutInstance(instanceName: string): Promise<EvolutionAPIResponse> {
    return await this.request<EvolutionAPIResponse>(
      'DELETE',
      `/instance/logout/${instanceName}`
    );
  }

  /**
   * Delete instance completely
   */
  async deleteInstance(instanceName: string): Promise<EvolutionAPIResponse> {
    return await this.request<EvolutionAPIResponse>(
      'DELETE',
      `/instance/delete/${instanceName}`
    );
  }

  /**
   * Restart instance
   */
  async restartInstance(instanceName: string): Promise<EvolutionAPIResponse> {
    return await this.request<EvolutionAPIResponse>(
      'PUT',
      `/instance/restart/${instanceName}`
    );
  }

  /**
   * Fetch QR code (base64) by connecting/reconnecting instance
   * This endpoint initiates connection and returns QR code or pairing code
   */
  async fetchQRCode(instanceName: string): Promise<EvolutionAPIResponse> {
    return await this.request<EvolutionAPIResponse>(
      'GET',
      `/instance/connect/${instanceName}`
    );
  }

  // ==========================================================================
  // WEBHOOK CONFIGURATION
  // ==========================================================================

  /**
   * Set webhook URL for instance
   * Uses /webhook/instance/{instanceName} endpoint (Evolution API v2)
   */
  async setWebhook(instanceName: string, webhookConfig: SetWebhookRequest): Promise<EvolutionAPIResponse> {
    // Evolution API v2 uses different field names
    const apiPayload = {
      url: webhookConfig.url,
      webhook_by_events: webhookConfig.webhookByEvents ?? false,
      webhook_base64: false,
      events: webhookConfig.events || [
        'QRCODE_UPDATED',
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'CONNECTION_UPDATE',
      ],
    };

    console.log('📡 Setting webhook with payload:', JSON.stringify(apiPayload, null, 2));

    return await this.request<EvolutionAPIResponse>(
      'POST',
      `/webhook/instance/${instanceName}`,
      apiPayload
    );
  }

  /**
   * Get webhook configuration
   */
  async getWebhook(instanceName: string): Promise<EvolutionAPIResponse> {
    return await this.request<EvolutionAPIResponse>(
      'GET',
      `/webhook/instance/${instanceName}`
    );
  }

  // ==========================================================================
  // MESSAGE SENDING
  // ==========================================================================

  /**
   * Send text message
   */
  async sendTextMessage(
    instanceName: string,
    request: SendTextMessageRequest
  ): Promise<SendMessageResponse> {
    // Format phone number
    const formattedNumber = this.formatPhoneNumber(request.number);
    
    const response = await this.request<EvolutionAPIResponse<SendMessageResponse>>(
      'POST',
      `/message/sendText/${instanceName}`,
      {
        ...request,
        number: formattedNumber,
      }
    );
    
    // API may return data in .data or directly with .key field
    return response.data || (response as any).key as any;
  }

  /**
   * Send media message (image, document, audio, video)
   */
  async sendMediaMessage(
    instanceName: string,
    request: SendMediaMessageRequest
  ): Promise<SendMessageResponse> {
    const formattedNumber = this.formatPhoneNumber(request.number);
    
    const endpoint = `/message/sendMedia/${instanceName}`;
    
    const response = await this.request<EvolutionAPIResponse<SendMessageResponse>>(
      'POST',
      endpoint,
      {
        ...request,
        number: formattedNumber,
      }
    );
    
    return response.data || (response as any).key as any;
  }

  /**
   * Send image with optional caption
   */
  async sendImage(
    instanceName: string,
    number: string,
    imageUrl: string,
    caption?: string
  ): Promise<SendMessageResponse> {
    return await this.sendMediaMessage(instanceName, {
      number,
      mediatype: 'image',
      media: imageUrl,
      caption,
    });
  }

  /**
   * Send document (PDF, DOCX, etc.)
   */
  async sendDocument(
    instanceName: string,
    number: string,
    documentUrl: string,
    fileName?: string,
    caption?: string
  ): Promise<SendMessageResponse> {
    return await this.sendMediaMessage(instanceName, {
      number,
      mediatype: 'document',
      media: documentUrl,
      fileName,
      caption,
    });
  }

  /**
   * Send audio file
   */
  async sendAudio(
    instanceName: string,
    number: string,
    audioUrl: string
  ): Promise<SendMessageResponse> {
    return await this.sendMediaMessage(instanceName, {
      number,
      mediatype: 'audio',
      media: audioUrl,
    });
  }

  /**
   * Send button message (quick reply buttons)
   */
  async sendButtons(
    instanceName: string,
    number: string,
    text: string,
    buttons: Array<{ id: string; text: string }>
  ): Promise<SendMessageResponse> {
    const formattedNumber = this.formatPhoneNumber(number);
    
    const response = await this.request<EvolutionAPIResponse<SendMessageResponse>>(
      'POST',
      `/message/sendButtons/${instanceName}`,
      {
        number: formattedNumber,
        buttonMessage: {
          text,
          buttons: buttons.map((btn, idx) => ({
            buttonId: btn.id || `btn_${idx}`,
            buttonText: { displayText: btn.text },
            type: 1
          }))
        }
      }
    );
    
    return response.data || (response as any).key as any;
  }

  /**
   * Send list message (dropdown menu)
   */
  async sendList(
    instanceName: string,
    number: string,
    title: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>
  ): Promise<SendMessageResponse> {
    const formattedNumber = this.formatPhoneNumber(number);
    
    const response = await this.request<EvolutionAPIResponse<SendMessageResponse>>(
      'POST',
      `/message/sendList/${instanceName}`,
      {
        number: formattedNumber,
        listMessage: {
          title,
          buttonText,
          sections: sections.map((section) => ({
            title: section.title,
            rows: section.rows.map((row) => ({
              rowId: row.id,
              title: row.title,
              description: row.description || ''
            }))
          }))
        }
      }
    );
    
    return response.data || (response as any).key as any;
  }

  // ==========================================================================
  // MESSAGE STATUS
  // ==========================================================================

  /**
   * Mark message as read
   */
  async markMessageAsRead(
    instanceName: string,
    remoteJid: string,
    messageId: string
  ): Promise<EvolutionAPIResponse> {
    return await this.request<EvolutionAPIResponse>(
      'POST',
      `/chat/markMessageAsRead/${instanceName}`,
      {
        readMessages: [{
          remoteJid,
          id: messageId,
          fromMe: false,
        }],
      }
    );
  }

  // ==========================================================================
  // CHAT ACTIONS
  // ==========================================================================

  /**
   * Send presence update (typing, recording, available)
   */
  async sendPresence(
    instanceName: string,
    remoteJid: string,
    state: 'composing' | 'recording' | 'available'
  ): Promise<EvolutionAPIResponse> {
    return await this.request<EvolutionAPIResponse>(
      'POST',
      `/chat/sendPresence/${instanceName}`,
      {
        number: remoteJid,
        delay: 1000,
        presence: state,
      }
    );
  }

  /**
   * Show "typing..." indicator
   */
  async sendTyping(instanceName: string, remoteJid: string): Promise<EvolutionAPIResponse> {
    return await this.sendPresence(instanceName, remoteJid, 'composing');
  }

  // ==========================================================================
  // PROFILE & CONTACT INFO
  // ==========================================================================

  /**
   * Get profile picture URL
   */
  async getProfilePicture(
    instanceName: string,
    number: string
  ): Promise<string | null> {
    try {
      const formattedNumber = this.formatPhoneNumber(number);
      
      const response = await this.request<EvolutionAPIResponse>(
        'GET',
        `/chat/fetchProfilePictureUrl/${instanceName}?number=${formattedNumber}`
      );
      
      return response.data?.profilePictureUrl || null;
    } catch (error) {
      console.warn('Failed to fetch profile picture:', error);
      return null;
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Check if WhatsApp number is registered
   */
  async checkNumberExists(
    instanceName: string,
    number: string
  ): Promise<boolean> {
    try {
      const formattedNumber = this.formatPhoneNumber(number);
      
      const response = await this.request<EvolutionAPIResponse>(
        'GET',
        `/chat/whatsappNumbers/${instanceName}?numbers=${formattedNumber.replace('@s.whatsapp.net', '')}`
      );
      
      return response.data?.length > 0;
    } catch (error) {
      console.warn('Failed to check number:', error);
      return false;
    }
  }
}

// ==========================================================================
// SINGLETON EXPORT
// ==========================================================================

let evolutionClientInstance: EvolutionClient | null = null;

export function getEvolutionClient(): EvolutionClient {
  if (!evolutionClientInstance) {
    const baseUrl = process.env.EVOLUTION_API_URL || process.env.NEXT_PUBLIC_EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;

    if (!baseUrl || !apiKey) {
      throw new Error('Evolution API configuration missing: EVOLUTION_API_URL and EVOLUTION_API_KEY required');
    }

    evolutionClientInstance = new EvolutionClient({
      baseUrl,
      apiKey,
    });
  }

  return evolutionClientInstance;
}

export default EvolutionClient;
