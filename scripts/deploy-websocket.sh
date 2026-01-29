#!/bin/bash
# Deploy WebSocket server to Fly.io
# Usage: ./scripts/deploy-websocket.sh

set -e

echo "🚀 Deploying WebSocket server to Fly.io..."

# Check if flyctl is installed
if ! command -v fly &> /dev/null; then
    echo "❌ flyctl is not installed. Please install it first:"
    echo "   Mac: brew install flyctl"
    echo "   Linux: curl -L https://fly.io/install.sh | sh"
    echo "   Windows: winget install flyctl"
    exit 1
fi

# Check if logged in
if ! fly auth whoami &> /dev/null; then
    echo "❌ Not logged in to Fly.io. Running 'fly auth login'..."
    fly auth login
fi

# Check if app exists
APP_NAME="ascendia-websocket"
if ! fly apps list | grep -q "$APP_NAME"; then
    echo "📝 App '$APP_NAME' doesn't exist. Creating it..."
    fly apps create "$APP_NAME"
    
    echo ""
    echo "⚠️  Now you need to set secrets (environment variables):"
    echo ""
    echo "fly secrets set \\"
    echo "  OPENAI_API_KEY=\"your-openai-api-key\" \\"
    echo "  RETELL_API_KEY=\"your-retell-api-key\" \\"
    echo "  SUPABASE_URL=\"your-supabase-url\" \\"
    echo "  SUPABASE_ANON_KEY=\"your-supabase-anon-key\" \\"
    echo "  SUPABASE_SERVICE_ROLE_KEY=\"your-supabase-service-key\" \\"
    echo "  NEXTJS_BASE_URL=\"https://your-main-app.fly.dev\" \\"
    echo "  --app $APP_NAME"
    echo ""
    read -p "Press Enter after setting secrets to continue..."
fi

# Deploy
echo "📦 Deploying to Fly.io..."
fly deploy \
  --config fly-websocket.toml \
  --dockerfile Dockerfile.websocket \
  --app "$APP_NAME"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Get your WebSocket URL: fly apps list | grep $APP_NAME"
echo "2. Your WebSocket endpoint: wss://ascendia-websocket.fly.dev/llm-websocket"
echo "3. Configure this URL in Retell dashboard"
echo "4. Test with: fly logs --app $APP_NAME"
echo ""
echo "🔍 Monitor logs: fly logs --app $APP_NAME -f"
echo "📊 Check status: fly status --app $APP_NAME"
echo ""
