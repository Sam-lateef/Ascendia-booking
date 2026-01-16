# Enhanced tunnel script that shows URL clearly
param(
    [int]$Port = 3001
)

$cloudflaredPath = "$env:USERPROFILE\bin\cloudflared.exe"
if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "Error: cloudflared.exe not found!" -ForegroundColor Red
    exit 1
}

# Add to PATH
if ($env:PATH -notlike "*$env:USERPROFILE\bin*") {
    $env:PATH += ";$env:USERPROFILE\bin"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  STARTING CLOUDFLARE TUNNEL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Tunneling: http://localhost:$Port" -ForegroundColor Yellow
Write-Host "Your app should be running on port $Port" -ForegroundColor Yellow
Write-Host ""
Write-Host "LOOK FOR THIS IN THE OUTPUT BELOW:" -ForegroundColor Green
Write-Host "  +--------------------------------------------------------------------------------------------+" -ForegroundColor White
Write-Host "  |  Your quick Tunnel has been created! Visit it at:" -ForegroundColor White
Write-Host "  |  https://[random-name].trycloudflare.com" -ForegroundColor Yellow
Write-Host "  +--------------------------------------------------------------------------------------------+" -ForegroundColor White
Write-Host ""
Write-Host "Once you see the URL above, your agent-ui will be at:" -ForegroundColor Cyan
Write-Host "  https://[that-url]/agent-ui?agentConfig=dental" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the tunnel" -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting tunnel..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start cloudflared and capture output
& $cloudflaredPath tunnel --url http://localhost:$Port 2>&1 | ForEach-Object {
    $line = $_
    Write-Host $line
    
    # Highlight the URL if it appears
    if ($line -match "trycloudflare\.com") {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "✅ TUNNEL URL FOUND!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Your agent-ui URL:" -ForegroundColor Cyan
        Write-Host "  $line/agent-ui?agentConfig=dental" -ForegroundColor Yellow -BackgroundColor Black
        Write-Host ""
    }
}



