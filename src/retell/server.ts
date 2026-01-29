import dotenv from 'dotenv';
import path from 'path';
import websocketHandler, { server, expressWsInstance } from './websocket-handler';
import { setupHealthCheck } from './health';
import { setupTwilioWebSocketHandler } from '../twilio/websocket-handler';
import { setupTwilioStandardWebSocketHandler } from '../twilio/websocket-handler-standard';

// Load environment variables - only if .env file exists (optional for Fly.io)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Debug: Log if required keys are configured
console.log('[WebSocket Server] Environment check:');
console.log(`  - OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Missing'}`);
console.log(`  - RETELL_API_KEY: ${process.env.RETELL_API_KEY ? '✓ Set (for Retell)' : '✗ Missing (Retell disabled)'}`);
console.log(`  - SUPABASE_URL: ${process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing'}`);
console.log(`  - SUPABASE_SERVICE_KEY: ${process.env.SUPABASE_SERVICE_KEY ? '✓ Set' : '✗ Missing (DB operations will fail!)'}`);
console.log(`  - SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing'}`);
console.log(`  - BASE_URL: ${process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'Not set (using localhost:3000)'}`);
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.log('[WebSocket Server] ⚠️  WARNING: Database operations will fail without SUPABASE_URL and SUPABASE_SERVICE_KEY!');
  console.log('[WebSocket Server] ⚠️  Agent instructions cannot be loaded from database!');
}

// Required environment variables:
// - RETELL_API_KEY: Your Retell API key
// - RETELL_AGENT_ID: Your Retell agent ID
// - OPENAI_API_KEY: Your OpenAI API key (for Twilio integration)
// - TWILIO_ACCOUNT_SID: Your Twilio account SID (optional)
// - TWILIO_AUTH_TOKEN: Your Twilio auth token (optional)
// - NEXTJS_BASE_URL (optional): Base URL for Next.js API routes (defaults to http://localhost:3000)
// - RETELL_WEBSOCKET_PORT (optional): Port for WebSocket server (defaults to 8080)

const PORT = parseInt(process.env.RETELL_WEBSOCKET_PORT || process.env.PORT || '8080', 10);

// The websocket handler already sets up the Express app with WebSocket support
const app = websocketHandler;

// Add Twilio WebSocket handlers - pass the express-ws app for route registration
setupTwilioWebSocketHandler(expressWsInstance.app);
console.log('[WebSocket Server] Twilio Premium handler registered');

// Add Twilio Standard (two-agent) WebSocket handler
setupTwilioStandardWebSocketHandler(expressWsInstance.app);
console.log('[WebSocket Server] Twilio Standard handler registered');

// Add health check endpoint
setupHealthCheck(app);

// Start the server (using the shared HTTP server, not app.listen)
// Listen on 0.0.0.0 to accept external connections (required for Fly.io)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[WebSocket Server] Running on 0.0.0.0:${PORT}`);
  console.log(`[WebSocket Server] Retell endpoints:`);
  console.log(`  - Default org: ws://0.0.0.0:${PORT}/llm-websocket/:call_id`);
  console.log(`  - Multi-org:   ws://0.0.0.0:${PORT}/llm-websocket/:org_slug/:call_id`);
  console.log(`[WebSocket Server] Twilio Premium endpoint: ws://0.0.0.0:${PORT}/twilio-media-stream`);
  console.log(`[WebSocket Server] Twilio Standard endpoint: ws://0.0.0.0:${PORT}/twilio-media-stream-standard`);
  console.log(`[WebSocket Server] Ready to accept connections`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Retell WebSocket Server] SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Retell WebSocket Server] SIGINT received, shutting down gracefully');
  process.exit(0);
});


