# Quick setup for custom domain tunnel
# This script will guide you through the entire process

param(
    [string]$Domain = "agent.asandiagroup-testing.com",
    [string]$TunnelName = "agent-asandiagroup"
)

Write-Host ""
Write-Host "QUICK CUSTOM DOMAIN SETUP" -ForegroundColor Cyan
Write-Host "Domain: $Domain" -ForegroundColor Yellow
Write-Host "Tunnel: $TunnelName" -ForegroundColor Yellow
Write-Host ""

# Check if cloudflared is installed
$cloudflaredPath = "$env:USERPROFILE\bin\cloudflared.exe"
if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "Installing cloudflared..." -ForegroundColor Yellow
    .\install-cloudflared.ps1
}

# Add cloudflared to PATH
if ($env:PATH -notlike "*$env:USERPROFILE\bin*") {
    $env:PATH += ";$env:USERPROFILE\bin"
}

Write-Host "Step 1: Login to Cloudflare" -ForegroundColor Green
Write-Host "This will open a browser window for authentication..." -ForegroundColor Yellow
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

& $cloudflaredPath tunnel login

Write-Host ""
Write-Host "Step 2: Creating tunnel '$TunnelName'..." -ForegroundColor Green
$tunnelOutput = & $cloudflaredPath tunnel create $TunnelName 2>&1
Write-Host $tunnelOutput

# Extract tunnel ID from output
$tunnelId = ($tunnelOutput | Select-String "Created tunnel (\w+-\w+-\w+-\w+-\w+)").Matches[0].Groups[1].Value

if ($tunnelId) {
    Write-Host "Tunnel ID: $tunnelId" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Step 3: Adding DNS record..." -ForegroundColor Green
    & $cloudflaredPath tunnel route dns $TunnelName $Domain
    
    Write-Host ""
    Write-Host "Step 4: Creating config file..." -ForegroundColor Green
    $configPath = "$env:USERPROFILE\.cloudflared\$tunnelId.yml"
    $configContent = @"
tunnel: $tunnelId
credentials-file: $env:USERPROFILE\.cloudflared\$tunnelId.json

ingress:
  - hostname: $Domain
    path: /agent-ui*
    service: http://localhost:3000
    originRequest:
      httpHostHeader: localhost:3000
  - service: http_status:404
"@
    
    $configContent | Out-File -FilePath $configPath -Encoding UTF8
    Write-Host "Config saved to: $configPath" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Step 5: Starting tunnel..." -ForegroundColor Green
    Write-Host "Your domain will be available at: https://$Domain/agent-ui?agentConfig=dental" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop the tunnel" -ForegroundColor Yellow
    Write-Host ""
    
    & $cloudflaredPath tunnel run $TunnelName
} else {
    Write-Host "Error: Could not extract tunnel ID from output" -ForegroundColor Red
    Write-Host "Please run the commands manually:" -ForegroundColor Yellow
    Write-Host "1. cloudflared tunnel login" -ForegroundColor White
    Write-Host "2. cloudflared tunnel create $TunnelName" -ForegroundColor White
    Write-Host "3. cloudflared tunnel route dns $TunnelName $Domain" -ForegroundColor White
    Write-Host "4. Edit the config file manually" -ForegroundColor White
}
