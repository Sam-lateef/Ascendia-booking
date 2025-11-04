# Add DNS routing for existing tunnel
# Routes agent.asandiagroup-testing.com to your existing tunnel

param(
    [string]$Domain = "agent.asandiagroup-testing.com",
    [string]$TunnelName = "agent-asandiagroup"
)

Write-Host ""
Write-Host "ADDING DNS ROUTING" -ForegroundColor Cyan
Write-Host "Domain: $Domain" -ForegroundColor Yellow
Write-Host "Tunnel: $TunnelName" -ForegroundColor Yellow
Write-Host ""

# Check if cloudflared is installed
$cloudflaredPath = "$env:USERPROFILE\bin\cloudflared.exe"
if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "Error: cloudflared.exe not found at $cloudflaredPath" -ForegroundColor Red
    Write-Host "Please install cloudflared first:" -ForegroundColor Yellow
    Write-Host "  .\install-cloudflared.ps1" -ForegroundColor White
    exit 1
}

# Add cloudflared to PATH
if ($env:PATH -notlike "*$env:USERPROFILE\bin*") {
    $env:PATH += ";$env:USERPROFILE\bin"
}

Write-Host "Adding DNS record..." -ForegroundColor Green
Write-Host "This will create a CNAME record pointing $Domain to your tunnel" -ForegroundColor Yellow
Write-Host ""

try {
    $output = & $cloudflaredPath tunnel route dns $TunnelName $Domain 2>&1
    Write-Host $output
    
    Write-Host ""
    Write-Host "✅ DNS routing added successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your domain is now accessible at:" -ForegroundColor Cyan
    Write-Host "  https://$Domain" -ForegroundColor White
    Write-Host ""
    Write-Host "Since your tunnel routes to localhost:3000 and you have middleware" -ForegroundColor Yellow
    Write-Host "redirecting / to /agent-ui, this will automatically show your agent UI!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Make sure your tunnel is running:" -ForegroundColor Green
    Write-Host "  cloudflared tunnel run $TunnelName" -ForegroundColor White
    
} catch {
    Write-Host "❌ Error adding DNS routing:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "1. You're logged in: cloudflared tunnel login" -ForegroundColor White
    Write-Host "2. The tunnel '$TunnelName' exists" -ForegroundColor White
    Write-Host "3. You have permission to manage DNS for asandiagroup-testing.com" -ForegroundColor White
}
