/**
 * Evolution API Client
 * 
 * Wrapper for Evolution API (WhatsApp Business API)
 * Handles all communication with the Evolution API instance
 */

interface EvolutionAPIConfig {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

interface MessageResponse {
  key: {
    remoteJid: string;
    id: string;
    fromMe: boolean;
  };
  message: any;
  messageTimestamp: number;
}

interface InstanceStatus {
  instance: {
    instanceName: string;
    status: 'open' | 'close' | 'connecting';
  };
}

interface QRCodeResponse {
  pairingCode?: string;
  code?: string;
  base64?: string;
}

export class EvolutionAPIClient {
  private baseUrl: string;
  private apiKey: string;
  private instanceName: string;

  constructor(config?: Partial<EvolutionAPIConfig>) {
    this.baseUrl = config?.baseUrl || process.env.EVOLUTION_API_URL || 'http://localhost:8081';
    this.apiKey = config?.apiKey || process.env.EVOLUTION_API_KEY || '';
    this.instanceName = config?.instanceName || process.env.EVOLUTION_INSTANCE_NAME || 'BookingAgent';
  }

  /**
   * Make authenticated request to Evolution API
   */
  private async request<T>(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'apikey': this.apiKey,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Evolution API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  /**
   * Send text message to WhatsApp user
   * @param to - WhatsApp ID (e.g., "1234567890@s.whatsapp.net")
   * @param text - Message text
   */
  async sendTextMessage(to: string, text: string): Promise<MessageResponse> {
    console.log(`[Evolution API] Sending message to ${to}`);
    
    return this.request<MessageResponse>('/message/sendText', 'POST', {
      number: to,
      text: text,
    });
  }

  /**
   * Get instance connection status
   */
  async getInstanceStatus(): Promise<InstanceStatus> {
    try {
      return await this.request<InstanceStatus>(`/instance/connectionState/${this.instanceName}`);
    } catch (error) {
      console.error('[Evolution API] Error getting instance status:', error);
      // Return disconnected status if API call fails
      return {
        instance: {
          instanceName: this.instanceName,
          status: 'close',
        },
      };
    }
  }

  /**
   * Get QR code for WhatsApp authentication
   * 
   * Evolution API only returns QR codes when creating a NEW instance.
   * If instance exists, we must delete and recreate it.
   */
  async getQRCode(): Promise<QRCodeResponse> {
    console.log(`[Evolution API] Fetching QR code for instance: ${this.instanceName}`);
    
    try {
      // Step 1: Delete existing instance if it exists
      try {
        console.log('[Evolution API] Deleting existing instance to generate fresh QR...');
        await this.deleteInstance();
        // Wait for deletion to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('[Evolution API] Instance deleted successfully');
      } catch (deleteError: any) {
        // Instance might not exist, which is fine
        console.log('[Evolution API] Delete failed (instance may not exist):', deleteError.message);
      }

      // Step 2: Create new instance
      console.log('[Evolution API] Creating new instance...');
      const createResponse = await this.createInstance();
      console.log('[Evolution API] Instance created:', createResponse.instance?.instanceName, '- Status:', createResponse.instance?.status);
      
      // Step 3: Use /instance/connect endpoint to get QR code
      // This is the correct Evolution API endpoint for QR code generation
      console.log('[Evolution API] Calling connect endpoint for QR code...');
      
      const maxAttempts = 10;
      const pollInterval = 2000; // 2 seconds between attempts
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`[Evolution API] Attempt ${attempt}/${maxAttempts} - Calling connect endpoint...`);
        
        try {
          // GET /instance/connect/{instanceName} returns QR code
          const connectResponse = await this.request<any>(`/instance/connect/${this.instanceName}`, 'GET');
          console.log(`[Evolution API] Connect response:`, JSON.stringify(connectResponse, null, 2));
          
          // Check for QR code in response - Evolution API returns it in various formats
          if (connectResponse?.base64) {
            console.log('[Evolution API] ✅ QR code found in base64');
            return { base64: connectResponse.base64 };
          }
          if (connectResponse?.code) {
            console.log('[Evolution API] ✅ QR code found in code');
            return { code: connectResponse.code };
          }
          if (connectResponse?.pairingCode) {
            console.log('[Evolution API] ✅ Pairing code found');
            return { pairingCode: connectResponse.pairingCode };
          }
          if (connectResponse?.qrcode?.base64) {
            console.log('[Evolution API] ✅ QR code found in qrcode.base64');
            return { base64: connectResponse.qrcode.base64 };
          }
          if (connectResponse?.qrcode?.code) {
            console.log('[Evolution API] ✅ QR code found in qrcode.code');
            return { code: connectResponse.qrcode.code };
          }
          
          // Check if instance is already connected
          const state = connectResponse?.instance?.state || connectResponse?.state;
          if (state === 'open') {
            console.error('[Evolution API] Instance already connected');
            throw new Error('Instance already connected - please disconnect first');
          }
          
          console.log(`[Evolution API] QR code not ready yet, waiting ${pollInterval}ms...`);
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        } catch (error: any) {
          console.error(`[Evolution API] Error on attempt ${attempt}:`, error.message);
          if (attempt === maxAttempts) throw error;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }
      
      console.error('[Evolution API] ❌ QR code not generated after maximum attempts');
      throw new Error('QR code not available after 20 seconds - please try again');
    } catch (error) {
      console.error('[Evolution API] Error getting QR code:', error);
      throw error;
    }
  }

  /**
   * Create new WhatsApp instance
   */
  async createInstance(instanceName?: string): Promise<any> {
    const name = instanceName || this.instanceName;
    console.log(`[Evolution API] Creating instance: ${name}`);
    
    return this.request('/instance/create', 'POST', {
      instanceName: name,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    });
  }

  /**
   * Delete/disconnect instance
   */
  async disconnectInstance(): Promise<void> {
    console.log(`[Evolution API] Disconnecting instance: ${this.instanceName}`);
    
    await this.request(`/instance/logout/${this.instanceName}`, 'DELETE');
  }

  /**
   * Delete instance completely
   */
  async deleteInstance(): Promise<void> {
    console.log(`[Evolution API] Deleting instance: ${this.instanceName}`);
    
    await this.request(`/instance/delete/${this.instanceName}`, 'DELETE');
  }

  /**
   * Restart instance (generates new QR code)
   */
  async restartInstance(): Promise<any> {
    console.log(`[Evolution API] Restarting instance: ${this.instanceName}`);
    return this.request(`/instance/restart/${this.instanceName}`, 'PUT');
  }

  /**
   * Set webhook URL for instance
   */
  async setWebhook(webhookUrl: string, events: string[] = ['MESSAGES_UPSERT']): Promise<any> {
    console.log(`[Evolution API] Setting webhook: ${webhookUrl}`);
    
    return this.request(`/webhook/set/${this.instanceName}`, 'POST', {
      url: webhookUrl,
      webhook_by_events: true,
      events: events,
    });
  }

  /**
   * Get instance information
   */
  async getInstanceInfo(): Promise<any> {
    return this.request(`/instance/fetchInstances?instanceName=${this.instanceName}`);
  }

  /**
   * Fetch QR code image for existing instance
   */
  async fetchQRCodeImage(): Promise<any> {
    console.log(`[Evolution API] Fetching QR code image for instance: ${this.instanceName}`);
    return this.request(`/instance/qrcode/${this.instanceName}`);
  }
}

/**
 * Singleton instance for easy access
 */
let client: EvolutionAPIClient | null = null;

export function getEvolutionClient(): EvolutionAPIClient {
  if (!client) {
    client = new EvolutionAPIClient();
  }
  return client;
}


