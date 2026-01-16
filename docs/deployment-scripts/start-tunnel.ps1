# Cloudflare Tunnel Startup Script
# This will expose your localhost via a Cloudflare tunnel for the agent-ui page

param(
    [int]$Port = 3000
)

Write-Host "Starting Cloudflare tunnel for http://localhost:$Port..." -ForegroundColor Green
Write-Host "Make sure your Next.js app is running!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Once the tunnel starts, you'll see a URL like: https://xxxxx.trycloudflare.com" -ForegroundColor Cyan
Write-Host "Your agent-ui will be accessible at:" -ForegroundColor Cyan
Write-Host "  https://xxxxx.trycloudflare.com/agent-ui?agentConfig=dental" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the tunnel" -ForegroundColor Yellow
Write-Host ""

# Add cloudflared to PATH if not already there
$cloudflaredPath = "$env:USERPROFILE\bin\cloudflared.exe"
if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "Error: cloudflared.exe not found at $cloudflaredPath" -ForegroundColor Red
    Write-Host "Please ensure cloudflared is installed." -ForegroundColor Red
    exit 1
}

# Add to PATH for this session
if ($env:PATH -notlike "*$env:USERPROFILE\bin*") {
    $env:PATH += ";$env:USERPROFILE\bin"
}

# Start the tunnel
Write-Host "Creating tunnel..." -ForegroundColor Yellow
& $cloudflaredPath tunnel --url http://localhost:$Port

