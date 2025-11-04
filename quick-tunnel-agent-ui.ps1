# Quick tunnel for agent-ui - No authentication needed
# This creates a temporary public URL

param(
    [int]$Port = 3001
)

$cloudflaredPath = "$env:USERPROFILE\bin\cloudflared.exe"
if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "Error: cloudflared.exe not found!" -ForegroundColor Red
    Write-Host "Expected at: $cloudflaredPath" -ForegroundColor Yellow
    exit 1
}

# Add to PATH
if ($env:PATH -notlike "*$env:USERPROFILE\bin*") {
    $env:PATH += ";$env:USERPROFILE\bin"
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     CLOUDFLARE QUICK TUNNEL FOR AGENT-UI              ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tunneling: http://localhost:$Port" -ForegroundColor Yellow
Write-Host "Make sure your Next.js app is running on port $Port!" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  IMPORTANT: Look for this box in the output:" -ForegroundColor Green
Write-Host ""
Write-Host "┌─────────────────────────────────────────────────────────┐" -ForegroundColor White
Write-Host "│  Your quick Tunnel has been created! Visit it at:       │" -ForegroundColor White
Write-Host "│  https://[random-name].trycloudflare.com                │" -ForegroundColor Yellow
Write-Host "└─────────────────────────────────────────────────────────┘" -ForegroundColor White
Write-Host ""
Write-Host "Once you see the URL above, your agent-ui will be at:" -ForegroundColor Cyan
Write-Host "  https://[that-url]/agent-ui?agentConfig=dental" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the tunnel" -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting tunnel in 2 seconds..." -ForegroundColor Gray
Start-Sleep -Seconds 2
Write-Host ""

& $cloudflaredPath tunnel --url http://localhost:$Port



