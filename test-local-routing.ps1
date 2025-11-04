# Test local routing to agent-ui page
# This simulates what the tunnel will do

Write-Host ""
Write-Host "TESTING LOCAL ROUTING" -ForegroundColor Cyan
Write-Host ""

# Check if the app is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/agent-ui?agentConfig=dental" -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ App is running and agent-ui page is accessible" -ForegroundColor Green
        Write-Host "URL: http://localhost:3000/agent-ui?agentConfig=dental" -ForegroundColor Cyan
    } else {
        Write-Host "❌ App returned status code: $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ App is not running or not accessible" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Start your app first:" -ForegroundColor Yellow
    Write-Host "  npm run dev" -ForegroundColor White
}

Write-Host ""
Write-Host "Testing redirect from root..." -ForegroundColor Yellow
try {
    $rootResponse = Invoke-WebRequest -Uri "http://localhost:3000/" -TimeoutSec 5 -MaximumRedirection 0
    Write-Host "❌ Root should redirect, but didn't" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 302) {
        Write-Host "✅ Root correctly redirects to agent-ui" -ForegroundColor Green
    } else {
        Write-Host "❌ Unexpected redirect behavior" -ForegroundColor Red
    }
}
