# Cloudflare Tunnel setup for Retell Integration
# This script starts tunnels for both Next.js (port 3000) and WebSocket server (port 8080)

Write-Host "Starting Cloudflare Tunnels for Retell Integration..." -ForegroundColor Green
Write-Host ""
Write-Host "Tunnel 1: Next.js API (port 3000) - for webhooks" -ForegroundColor Cyan
Write-Host "Tunnel 2: WebSocket Server (port 8080) - for Retell LLM WebSocket" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all tunnels" -ForegroundColor Yellow
Write-Host ""

# Start tunnel for Next.js (port 3000) - for webhooks
Start-Process -NoNewWindow cloudflared -ArgumentList "tunnel", "--url", "http://localhost:3000"

# Wait a moment for the first tunnel to start
Start-Sleep -Seconds 2

# Start tunnel for WebSocket server (port 8080) - for Retell LLM
Start-Process -NoNewWindow cloudflared -ArgumentList "tunnel", "--url", "http://localhost:8080"

Write-Host ""
Write-Host "Tunnels started! Check the output above for the public URLs." -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Copy the URLs and configure in Retell Dashboard:" -ForegroundColor Yellow
Write-Host "  - WebSocket URL: wss://<your-tunnel-url-8080>/llm-websocket" -ForegroundColor Cyan
Write-Host "  - Webhook URL: https://<your-tunnel-url-3000>/api/retell/webhook" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to stop tunnels..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Stop all cloudflared processes
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force

