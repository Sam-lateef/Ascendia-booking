# List existing Cloudflare tunnels

Write-Host ""
Write-Host "LISTING CLOUDFLARE TUNNELS" -ForegroundColor Cyan
Write-Host ""

# Check if cloudflared is installed
$cloudflaredPath = "$env:USERPROFILE\bin\cloudflared.exe"
if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "Error: cloudflared.exe not found at $cloudflaredPath" -ForegroundColor Red
    exit 1
}

# Add cloudflared to PATH
if ($env:PATH -notlike "*$env:USERPROFILE\bin*") {
    $env:PATH += ";$env:USERPROFILE\bin"
}

Write-Host "Your existing tunnels:" -ForegroundColor Green
Write-Host ""

try {
    & $cloudflaredPath tunnel list
} catch {
    Write-Host "❌ Error listing tunnels:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure you're logged in:" -ForegroundColor Yellow
    Write-Host "  cloudflared tunnel login" -ForegroundColor White
}
