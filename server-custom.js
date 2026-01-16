// Custom Next.js server with WebSocket support for Retell
// This integrates the WebSocket server into Next.js so everything runs on one port

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const express = require('express');
const expressWs = require('express-ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Import WebSocket handler logic
// We'll inline the WebSocket setup here to avoid module resolution issues
const setupWebSocketHandler = (expressApp) => {
  // This will be implemented to handle Retell WebSocket connections
  // For now, we'll set up the route structure
  expressApp.ws('/llm-websocket/:call_id', (ws, req) => {
    const callId = req.params.call_id;
    console.log(`[Retell WS] Connected for call: ${callId}`);
    
    // TODO: Import and use the actual WebSocket handler logic
    // For now, just acknowledge connection
    ws.send(JSON.stringify({
      response_type: 'config',
      config: {
        auto_reconnect: true,
        call_details: true
      }
    }));
    
    ws.on('message', (data) => {
      console.log(`[Retell WS] Message received for call ${callId}`);
      // Handle message - will be implemented with actual handler
    });
    
    ws.on('close', () => {
      console.log(`[Retell WS] Disconnected for call: ${callId}`);
    });
  });
};

app.prepare().then(() => {
  const expressApp = express();
  const server = createServer(expressApp);
  
  // Add WebSocket support
  const expressWsInstance = expressWs(expressApp, server);
  
  // Set up WebSocket handler
  setupWebSocketHandler(expressApp);
  
  // Next.js routes (must be last)
  expressApp.all('*', (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });
  
  server.listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket endpoint: ws://${hostname}:${port}/llm-websocket/:call_id`);
    console.log(`> Environment: ${dev ? 'development' : 'production'}`);
  });
});

