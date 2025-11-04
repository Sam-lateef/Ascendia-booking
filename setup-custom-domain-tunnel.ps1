# Setup Cloudflare tunnel for custom domain
# Routes https://agent.asandiagroup-testing.com to http://localhost:3000/agent-ui?agentConfig=dental

Write-Host ""
Write-Host "CUSTOM DOMAIN TUNNEL SETUP" -ForegroundColor Cyan
Write-Host "Domain: agent.asandiagroup-testing.com" -ForegroundColor Yellow
Write-Host "Target: http://localhost:3000/agent-ui?agentConfig=dental" -ForegroundColor Yellow
Write-Host ""

# Check if cloudflared is installed
$cloudflaredPath = "$env:USERPROFILE\bin\cloudflared.exe"
if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "Error: cloudflared.exe not found at $cloudflaredPath" -ForegroundColor Red
    Write-Host "Please install cloudflared first:" -ForegroundColor Yellow
    Write-Host "  .\install-cloudflared.ps1" -ForegroundColor White
    exit 1
}

Write-Host "Step 1: Login to Cloudflare (if not already logged in)" -ForegroundColor Green
Write-Host "Run: cloudflared tunnel login" -ForegroundColor White
Write-Host ""

Write-Host "Step 2: Create a named tunnel" -ForegroundColor Green
Write-Host "Run: cloudflared tunnel create agent-asandiagroup" -ForegroundColor White
Write-Host ""

Write-Host "Step 3: Configure the tunnel" -ForegroundColor Green
Write-Host "This will create a config file. You'll need to edit it manually." -ForegroundColor Yellow
Write-Host ""

Write-Host "Step 4: Add DNS record" -ForegroundColor Green
Write-Host "Run: cloudflared tunnel route dns agent-asandiagroup agent.asandiagroup-testing.com" -ForegroundColor White
Write-Host ""

Write-Host "Step 5: Start the tunnel" -ForegroundColor Green
Write-Host "Run: cloudflared tunnel run agent-asandiagroup" -ForegroundColor White
Write-Host ""

Write-Host "Manual Configuration Required:" -ForegroundColor Red
Write-Host "After creating the tunnel, you'll need to edit the config file to add:" -ForegroundColor Yellow
Write-Host "1. Service: http://localhost:3000" -ForegroundColor White
Write-Host "2. Path: /agent-ui*" -ForegroundColor White
Write-Host "3. Query: agentConfig=dental" -ForegroundColor White
Write-Host ""

Write-Host "Would you like to start the setup process? (y/n)" -ForegroundColor Cyan
$response = Read-Host
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "Starting cloudflared login..." -ForegroundColor Green
    & $cloudflaredPath tunnel login
}
