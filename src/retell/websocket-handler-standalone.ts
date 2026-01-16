// Standalone WebSocket handler that can be imported into custom server
// This is a wrapper around the Express app with WebSocket support

import express from 'express';
import expressWs from 'express-ws';
import WebSocket from 'ws';
import { callGreetingAgent } from '../app/agentConfigs/openDental/greetingAgentSTT';

// Base URL for Next.js API routes
const NEXTJS_BASE_URL = process.env.NEXTJS_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// Patch global fetch to use absolute URLs when running in Express server
if (typeof global !== 'undefined' && typeof global.fetch === 'function') {
  const originalFetch = global.fetch;
  global.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;
    if (typeof input === 'string') {
      url = input.startsWith('http') ? input : `${NEXTJS_BASE_URL}${input}`;
    } else if (input instanceof URL) {
      url = input.href;
    } else {
      url = input.url.startsWith('http') ? input.url : `${NEXTJS_BASE_URL}${input.url}`;
    }
    return originalFetch(url, init);
  };
}

// Extend Express Request to include WebSocket
interface RetellWebSocket extends WebSocket {
  callId?: string;
  conversationHistory?: any[];
  isFirstMessage?: boolean;
}

interface RetellMessage {
  interaction_type: 'update_only' | 'response_required' | 'reminder_required' | 'call_details' | 'ping';
  response_id?: number;
  transcript?: Array<{
    role: 'agent' | 'user';
    content: string;
    timestamp: number;
  }>;
  call_id?: string;
}

interface RetellResponse {
  response_type: 'response' | 'config' | 'pong';
  response_id?: number;
  content?: string;
  content_complete?: boolean;
  end_call?: boolean;
  config?: {
    auto_reconnect?: boolean;
    call_details?: boolean;
  };
}

// Store conversation history per call_id
const callHistoryMap = new Map<string, any[]>();

/**
 * Get the last user message from transcript
 */
function getLastUserMessage(transcript?: Array<{ role: string; content: string }>): string {
  if (!transcript || transcript.length === 0) return '';
  
  for (let i = transcript.length - 1; i >= 0; i--) {
    if (transcript[i].role === 'user') {
      return transcript[i].content;
    }
  }
  return '';
}

/**
 * Process user message with our LLM (greeting agent)
 */
async function processWithLLM(
  userMessage: string,
  callId: string,
  conversationHistory: any[]
): Promise<{ text: string; shouldEndCall: boolean }> {
  try {
    console.log(`[Retell WS] Processing message for call ${callId}:`, userMessage);
    
    const isFirstMessage = conversationHistory.length === 0;
    
    const response = await callGreetingAgent(
      userMessage,
      conversationHistory,
      isFirstMessage,
      undefined
    );
    
    const userMessageItem = {
      type: 'message',
      role: 'user',
      content: userMessage,
    };
    
    const assistantMessageItem = {
      type: 'message',
      role: 'assistant',
      content: response,
    };
    
    conversationHistory.push(userMessageItem, assistantMessageItem);
    callHistoryMap.set(callId, conversationHistory);
    
    return {
      text: response,
      shouldEndCall: false,
    };
  } catch (error: any) {
    console.error(`[Retell WS] Error processing message for call ${callId}:`, error);
    return {
      text: "I'm sorry, I encountered an error processing your request. Please try again.",
      shouldEndCall: false,
    };
  }
}

/**
 * Setup WebSocket routes on an Express app
 * This can be called from a custom server
 */
export function setupRetellWebSocket(expressApp: any) {
  // WebSocket endpoint that Retell connects to
  expressApp.ws('/llm-websocket/:call_id', (ws: RetellWebSocket, req: any) => {
    const callId = req.params.call_id;
    console.log(`[Retell WS] Connected for call: ${callId}`);
    
    ws.callId = callId;
    ws.conversationHistory = callHistoryMap.get(callId) || [];
    ws.isFirstMessage = ws.conversationHistory.length === 0;
    
    // Send config on connection
    ws.send(JSON.stringify({
      response_type: 'config',
      config: {
        auto_reconnect: true,
        call_details: true
      }
    } as RetellResponse));

    // Send initial greeting
    if (ws.isFirstMessage) {
      processWithLLM('Start the conversation with the greeting.', callId, ws.conversationHistory)
        .then((result) => {
          ws.send(JSON.stringify({
            response_type: 'response',
            response_id: 0,
            content: result.text,
            content_complete: true
          } as RetellResponse));
          ws.isFirstMessage = false;
        })
        .catch((error) => {
          console.error(`[Retell WS] Error sending initial greeting for call ${callId}:`, error);
          ws.send(JSON.stringify({
            response_type: 'response',
            response_id: 0,
            content: "Hi! Welcome to Barton Dental. This is Lexi. How can I help you today?",
            content_complete: true
          } as RetellResponse));
          ws.isFirstMessage = false;
        });
    }

    ws.on('message', async (data: string) => {
      try {
        const message: RetellMessage = JSON.parse(data);
        console.log(`[Retell WS] Received message for call ${callId}:`, message.interaction_type);

        switch (message.interaction_type) {
          case 'call_details':
            console.log(`[Retell WS] Call details received for call ${callId}:`, message);
            break;

          case 'update_only':
            console.log(`[Retell WS] Transcript update for call ${callId}:`, message.transcript);
            break;

          case 'response_required':
          case 'reminder_required':
            const userMessage = getLastUserMessage(message.transcript);
            
            if (!userMessage) {
              console.warn(`[Retell WS] No user message found in transcript for call ${callId}`);
              break;
            }
            
            const aiResponse = await processWithLLM(
              userMessage,
              callId,
              ws.conversationHistory || []
            );
            
            const response: RetellResponse = {
              response_type: 'response',
              response_id: message.response_id,
              content: aiResponse.text,
              content_complete: true,
              end_call: aiResponse.shouldEndCall || false
            };
            
            ws.send(JSON.stringify(response));
            console.log(`[Retell WS] Sent response for call ${callId}, response_id: ${message.response_id}`);
            break;

          case 'ping':
            ws.send(JSON.stringify({ response_type: 'pong' } as RetellResponse));
            break;

          default:
            console.log(`[Retell WS] Unknown interaction_type for call ${callId}:`, message.interaction_type);
        }
      } catch (error) {
        console.error(`[Retell WS] Error processing message for call ${callId}:`, error);
      }
    });

    ws.on('close', () => {
      console.log(`[Retell WS] Disconnected for call: ${callId}`);
    });

    ws.on('error', (error) => {
      console.error(`[Retell WS] Error for call ${callId}:`, error);
    });
  });
}

