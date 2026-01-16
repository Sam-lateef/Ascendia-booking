# Setup tunnel that ONLY exposes /agent-ui route
# This uses the Cloudflare Dashboard method for proper routing

Write-Host ""
Write-Host "CLOUDFLARE TUNNEL - AGENT-UI ONLY SETUP" -ForegroundColor Cyan
Write-Host ""

Write-Host "To expose ONLY /agent-ui (and hide the main page):" -ForegroundColor Yellow
Write-Host ""
Write-Host "Method 1: Dashboard Setup (Recommended)" -ForegroundColor Green
Write-Host "1. Go to: https://dash.cloudflare.com/" -ForegroundColor White
Write-Host "2. Zero Trust -> Networks -> Tunnels" -ForegroundColor White
Write-Host "3. Create tunnel -> Cloudflared -> Name: agent-ui" -ForegroundColor White
Write-Host "4. After creation, go to Public Hostnames tab" -ForegroundColor White
Write-Host "5. Add public hostname:" -ForegroundColor White
Write-Host "   - Subdomain: agent-ui (or any name)" -ForegroundColor Yellow
Write-Host "   - Domain: [your Cloudflare domain]" -ForegroundColor Yellow
Write-Host "   - Service: http://localhost:3001" -ForegroundColor Yellow
Write-Host "   - Path: /agent-ui*" -ForegroundColor Yellow
Write-Host "   - Click Save" -ForegroundColor White
Write-Host ""
Write-Host "6. Add another route to block everything else:" -ForegroundColor White
Write-Host "   - Service: http_status:404" -ForegroundColor Yellow
Write-Host "   - (No hostname, this is the catch-all)" -ForegroundColor Gray
Write-Host ""
Write-Host "Method 2: Quick Tunnel (Temporary - exposes everything)" -ForegroundColor Yellow
Write-Host "For quick testing, use:" -ForegroundColor White
Write-Host "  .\quick-tunnel-agent-ui.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: Quick tunnels expose the entire site. Main page will be accessible." -ForegroundColor Red
Write-Host ""

$cloudflaredPath = "$env:USERPROFILE\bin\cloudflared.exe"
if (Test-Path $cloudflaredPath) {
    Write-Host "To start a quick tunnel now, run:" -ForegroundColor Cyan
    Write-Host "  .\quick-tunnel-agent-ui.ps1" -ForegroundColor White
} else {
    Write-Host "cloudflared not found. Install it first." -ForegroundColor Red
}



