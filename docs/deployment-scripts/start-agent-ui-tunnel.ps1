# Quick script to tunnel the agent-ui page
# Detects the port automatically or uses port 3001 (common after port conflict)

param(
    [int]$Port = 3001  # Default to 3001 since port 3000 is often in use
)

$cloudflaredPath = "$env:USERPROFILE\bin\cloudflared.exe"
if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "Error: cloudflared.exe not found!" -ForegroundColor Red
    Write-Host "Please install cloudflared first." -ForegroundColor Red
    exit 1
}

# Add to PATH
if ($env:PATH -notlike "*$env:USERPROFILE\bin*") {
    $env:PATH += ";$env:USERPROFILE\bin"
}

Write-Host ""
Write-Host "=== AGENT-UI TUNNEL ===" -ForegroundColor Cyan
Write-Host "Tunneling: http://localhost:$Port" -ForegroundColor Yellow
Write-Host ""
Write-Host "After the tunnel starts, your agent-ui URL will be:" -ForegroundColor Cyan
Write-Host "  https://[random-name].trycloudflare.com/agent-ui?agentConfig=dental" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

& $cloudflaredPath tunnel --url http://localhost:$Port



