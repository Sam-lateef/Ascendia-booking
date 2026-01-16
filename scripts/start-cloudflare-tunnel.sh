#!/bin/bash
# Cloudflare Tunnel setup for Retell Integration
# This script starts tunnels for both Next.js (port 3000) and WebSocket server (port 8080)

echo "Starting Cloudflare Tunnels for Retell Integration..."
echo ""
echo "Tunnel 1: Next.js API (port 3000) - for webhooks"
echo "Tunnel 2: WebSocket Server (port 8080) - for Retell LLM WebSocket"
echo ""
echo "Press Ctrl+C to stop all tunnels"
echo ""

# Start tunnel for Next.js (port 3000) - for webhooks
cloudflared tunnel --url http://localhost:3000 &
TUNNEL1_PID=$!

# Wait a moment for the first tunnel to start
sleep 2

# Start tunnel for WebSocket server (port 8080) - for Retell LLM
cloudflared tunnel --url http://localhost:8080 &
TUNNEL2_PID=$!

echo ""
echo "Tunnels started! Check the output above for the public URLs."
echo ""
echo "IMPORTANT: Copy the URLs and configure in Retell Dashboard:"
echo "  - WebSocket URL: wss://<your-tunnel-url-8080>/llm-websocket"
echo "  - Webhook URL: https://<your-tunnel-url-3000>/api/retell/webhook"
echo ""
echo "Press Ctrl+C to stop tunnels..."

# Wait for interrupt
trap "kill $TUNNEL1_PID $TUNNEL2_PID 2>/dev/null; exit" INT TERM

# Keep script running
wait

