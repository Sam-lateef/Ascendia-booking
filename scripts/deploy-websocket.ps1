# Deploy WebSocket server to Fly.io (PowerShell version)
# Usage: .\scripts\deploy-websocket.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying WebSocket server to Fly.io..." -ForegroundColor Green

# Check if flyctl is installed
if (!(Get-Command fly -ErrorAction SilentlyContinue)) {
    Write-Host "❌ flyctl is not installed. Please install it first:" -ForegroundColor Red
    Write-Host "   winget install flyctl" -ForegroundColor Yellow
    Write-Host "   Or download from: https://fly.io/docs/hands-on/install-flyctl/" -ForegroundColor Yellow
    exit 1
}

# Check if logged in
try {
    fly auth whoami | Out-Null
} catch {
    Write-Host "❌ Not logged in to Fly.io. Running 'fly auth login'..." -ForegroundColor Yellow
    fly auth login
}

# Check if app exists
$APP_NAME = "ascendia-websocket"
$appList = fly apps list 2>$null
if ($appList -notmatch $APP_NAME) {
    Write-Host "📝 App '$APP_NAME' doesn't exist. Creating it..." -ForegroundColor Yellow
    fly apps create $APP_NAME
    
    Write-Host ""
    Write-Host "⚠️  Now you need to set secrets (environment variables):" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "fly secrets set ``" -ForegroundColor Cyan
    Write-Host "  OPENAI_API_KEY=`"your-openai-api-key`" ``" -ForegroundColor Cyan
    Write-Host "  RETELL_API_KEY=`"your-retell-api-key`" ``" -ForegroundColor Cyan
    Write-Host "  SUPABASE_URL=`"your-supabase-url`" ``" -ForegroundColor Cyan
    Write-Host "  SUPABASE_ANON_KEY=`"your-supabase-anon-key`" ``" -ForegroundColor Cyan
    Write-Host "  SUPABASE_SERVICE_ROLE_KEY=`"your-supabase-service-key`" ``" -ForegroundColor Cyan
    Write-Host "  NEXTJS_BASE_URL=`"https://your-main-app.fly.dev`" ``" -ForegroundColor Cyan
    Write-Host "  --app $APP_NAME" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Press Enter after setting secrets to continue"
}

# Deploy
Write-Host "📦 Deploying to Fly.io..." -ForegroundColor Green
fly deploy `
  --config fly-websocket.toml `
  --dockerfile Dockerfile.websocket `
  --app $APP_NAME

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Get your WebSocket URL: fly apps list | Select-String $APP_NAME"
Write-Host "2. Your WebSocket endpoint: wss://ascendia-websocket.fly.dev/llm-websocket"
Write-Host "3. Configure this URL in Retell dashboard"
Write-Host "4. Test with: fly logs --app $APP_NAME"
Write-Host ""
Write-Host "🔍 Monitor logs: fly logs --app $APP_NAME -f" -ForegroundColor Cyan
Write-Host "📊 Check status: fly status --app $APP_NAME" -ForegroundColor Cyan
Write-Host ""
