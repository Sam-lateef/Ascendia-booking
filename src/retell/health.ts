// Simple health check endpoint for WebSocket server
import express from 'express';

export function setupHealthCheck(app: any) {
  app.get('/health', (req: any, res: any) => {
    res.json({ 
      status: 'ok', 
      service: 'retell-websocket',
      timestamp: new Date().toISOString()
    });
  });
}

