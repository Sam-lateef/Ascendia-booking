# Script to kill all Node.js apps and Cloudflare tunnels

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  KILLING ALL APP PROCESSES AND TUNNELS                 ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Kill Node.js processes
Write-Host "Killing Node.js processes (Next.js)..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "✅ Killed $($nodeProcesses.Count) Node.js process(es)" -ForegroundColor Green
} else {
    Write-Host "No Node.js processes found" -ForegroundColor Gray
}

# Kill cloudflared processes
Write-Host "Killing cloudflared processes (tunnels)..." -ForegroundColor Yellow
$cloudProcesses = Get-Process -Name cloudflared -ErrorAction SilentlyContinue
if ($cloudProcesses) {
    $cloudProcesses | Stop-Process -Force
    Write-Host "✅ Killed $($cloudProcesses.Count) cloudflared process(es)" -ForegroundColor Green
} else {
    Write-Host "No cloudflared processes found" -ForegroundColor Gray
}

# Kill processes on ports 3000 and 3001
Write-Host "`nChecking ports 3000 and 3001..." -ForegroundColor Cyan

$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique -ErrorAction SilentlyContinue
if ($port3000) {
    foreach ($pid in $port3000) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "✅ Killed process on port 3000 (PID: $pid)" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Could not kill PID $pid on port 3000" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "Port 3000: Free" -ForegroundColor Green
}

$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique -ErrorAction SilentlyContinue
if ($port3001) {
    foreach ($pid in $port3001) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "✅ Killed process on port 3001 (PID: $pid)" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Could not kill PID $pid on port 3001" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "Port 3001: Free" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ All processes cleaned up!" -ForegroundColor Green
Write-Host ""
Write-Host "You can now:" -ForegroundColor Cyan
Write-Host "  • Start Next.js: npm run dev" -ForegroundColor White
Write-Host "  • Start tunnel:  .\quick-tunnel-agent-ui.ps1" -ForegroundColor White
Write-Host ""



