/**
 * WhatsApp Message Handler
 * 
 * Processes incoming WhatsApp messages using existing Lexi agent
 * Integrates with Evolution API and Supabase
 */

import { getSupabaseAdmin } from '../supabase';
import { getEvolutionClient } from '../evolution/EvolutionClient';
import { EvolutionMessageUpsert } from '../evolution/types';
import { callLexiWhatsApp } from '@/app/agentConfigs/embeddedBooking/lexiAgentWhatsApp';

// ============================================================================
// TYPES
// ============================================================================

export interface WhatsAppMessageContext {
  instanceId: string;
  instanceName: string;
  organizationId: string;
  remoteJid: string; // WhatsApp contact ID
  contactName?: string;
  conversationId: string;
  whatsappConversationId: string;
}

export interface ProcessedMessage {
  success: boolean;
  response?: string;
  error?: string;
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

export class WhatsAppMessageHandler {
  private supabase: ReturnType<typeof getSupabaseAdmin>;
  private evolutionClient: ReturnType<typeof getEvolutionClient>;

  constructor() {
    this.supabase = getSupabaseAdmin();
    this.evolutionClient = getEvolutionClient();
  }

  /**
   * Process incoming WhatsApp message
   */
  async processIncomingMessage(
    context: WhatsAppMessageContext,
    messageData: EvolutionMessageUpsert
  ): Promise<ProcessedMessage> {
    const { instanceName, organizationId, remoteJid, conversationId } = context;

    try {
      // Extract message text
      const messageText = this.extractMessageText(messageData);
      
      if (!messageText) {
        console.log('⏭️ Skipping non-text message');
        return { success: true }; // Skip media messages for now
      }

      console.log(`📨 Processing WhatsApp message: "${messageText.substring(0, 50)}..."`);

      // Show typing indicator
      await this.evolutionClient.sendTyping(instanceName, remoteJid);

      // Store incoming message
      await this.storeMessage(context, messageData, 'inbound', messageText);

      // Get conversation history
      const history = await this.getConversationHistory(conversationId);

      // Check if this is the first message
      const isFirstMessage = history.length === 0;

      // Generate AI response using Lexi
      const aiResponse = await callLexiWhatsApp(
        messageText,
        history,
        isFirstMessage
      );

      // Send response via WhatsApp
      if (aiResponse) {
        await this.evolutionClient.sendTextMessage(instanceName, {
          number: remoteJid,
          text: aiResponse,
        });

        // Store outgoing message
        await this.storeMessage(context, null, 'outbound', aiResponse);
      }

      return {
        success: true,
        response: aiResponse,
      };
    } catch (error: any) {
      console.error('❌ Error processing WhatsApp message:', error);
      
      // Send error message to user
      try {
        await this.evolutionClient.sendTextMessage(instanceName, {
          number: remoteJid,
          text: "I apologize, but I'm having trouble processing your message right now. Please try again in a moment.",
        });
      } catch (sendError) {
        console.error('❌ Failed to send error message:', sendError);
      }

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Extract text from WhatsApp message
   */
  private extractMessageText(messageData: EvolutionMessageUpsert): string | null {
    const message = messageData.message;
    
    if (!message) return null;
    
    // Text message
    if (message.conversation) {
      return message.conversation;
    }
    
    // Extended text message (with formatting, links, etc.)
    if (message.imageMessage?.caption) {
      return message.imageMessage.caption;
    }
    
    if (message.documentMessage?.caption) {
      return message.documentMessage.caption;
    }
    
    if (message.videoMessage?.caption) {
      return message.videoMessage.caption;
    }
    
    return null;
  }

  /**
   * Store message in database
   */
  private async storeMessage(
    context: WhatsAppMessageContext,
    messageData: EvolutionMessageUpsert | null,
    direction: 'inbound' | 'outbound',
    textContent: string
  ): Promise<void> {
    try {
      const { data: message, error } = await this.supabase
        .from('whatsapp_messages')
        .insert({
          whatsapp_instance_id: context.instanceId,
          whatsapp_conversation_id: context.whatsappConversationId,
          organization_id: context.organizationId,
          message_id: messageData?.key?.id,
          remote_jid: context.remoteJid,
          direction,
          message_type: 'text',
          text_content: textContent,
          status: direction === 'outbound' ? 'sent' : 'read',
          raw_payload: messageData || {},
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error storing message:', error);
      } else {
        console.log(`✅ Message stored: ${message.id}`);
      }

      // Also store in conversation_messages for unified history
      await this.storeInConversationMessages(
        context.conversationId,
        direction === 'inbound' ? 'user' : 'assistant',
        textContent
      );
    } catch (error) {
      console.error('❌ Error in storeMessage:', error);
    }
  }

  /**
   * Store message in conversation_messages table
   */
  private async storeInConversationMessages(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conversationId,
          role,
          content,
          metadata: {
            channel: 'whatsapp',
          },
        });

      if (error) {
        console.error('❌ Error storing conversation message:', error);
      }
    } catch (error) {
      console.error('❌ Error in storeInConversationMessages:', error);
    }
  }

  /**
   * Get conversation history for AI context
   */
  private async getConversationHistory(conversationId: string): Promise<any[]> {
    try {
      const { data: messages, error } = await this.supabase
        .from('conversation_messages')
        .select('role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(20); // Last 20 messages

      if (error) {
        console.error('❌ Error fetching conversation history:', error);
        return [];
      }

      return messages || [];
    } catch (error) {
      console.error('❌ Error in getConversationHistory:', error);
      return [];
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let handlerInstance: WhatsAppMessageHandler | null = null;

export function getWhatsAppMessageHandler(): WhatsAppMessageHandler {
  if (!handlerInstance) {
    handlerInstance = new WhatsAppMessageHandler();
  }
  return handlerInstance;
}

export default WhatsAppMessageHandler;
