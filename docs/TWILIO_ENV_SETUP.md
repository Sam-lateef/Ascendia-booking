# Twilio Environment Variables Setup

## Required Environment Variables

Add these variables to your `.env.local` file:

```bash
# ============================================
# Twilio Configuration
# ============================================

# Twilio Account Credentials
TWILIO_ACCOUNT_SID=AC6ed333dfcf6dae866f8f2c451b56084b
TWILIO_AUTH_TOKEN=aeb9cce73f06261c65e0c227b2815c85
TWILIO_PHONE_NUMBER=+1234567890  # Your Twilio phone number

# Twilio WebSocket URL (for local development with ngrok)
TWILIO_WEBSOCKET_URL=wss://ascendia-ws.ngrok.io/twilio-media-stream

# ============================================
# OpenAI API Key (Required for Twilio Voice)
# ============================================

# This should already exist, but ensure it's set
OPENAI_API_KEY=sk-proj-xxxxx

# ============================================
# Existing Variables (Keep these)
# ============================================

# Retell Configuration (if using Retell)
RETELL_API_KEY=your_retell_api_key
RETELL_AGENT_ID=your_retell_agent_id
RETELL_WEBSOCKET_PORT=8080

# Next.js
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# OpenDental API
OPENDENTAL_API_BASE_URL=https://api.opendental.com/api/v1
OPENDENTAL_API_KEY=your_opendental_api_key
OPENDENTAL_MOCK_MODE=false
```

## Setup Instructions

1. **Copy the template above** to your `.env.local` file
2. **Update the placeholders** with your actual credentials:
   - Replace `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` with values from your Twilio account
   - Replace `TWILIO_PHONE_NUMBER` with your actual Twilio phone number (E.164 format)
   - Update `TWILIO_WEBSOCKET_URL` with your ngrok WebSocket domain (see below)
3. **Restart your development servers** for changes to take effect

## ngrok WebSocket URL Configuration

When running locally with ngrok, your `TWILIO_WEBSOCKET_URL` should point to your ngrok WebSocket tunnel:

### Format
```
wss://[your-ngrok-ws-domain]/twilio-media-stream
```

### Example
```
wss://ascendia-ws.ngrok.io/twilio-media-stream
```

### How to Get Your ngrok URL

1. Start your WebSocket server:
   ```bash
   npm run dev:full
   ```

2. In another terminal, start ngrok:
   ```bash
   ngrok start --all
   ```

3. Copy the WebSocket URL from ngrok output (port 8080)
4. Add `/twilio-media-stream` to the end
5. Update `TWILIO_WEBSOCKET_URL` in your `.env.local`

## Production Configuration

For production deployment (Fly.io, Heroku, etc.):

1. Set environment variables in your hosting platform
2. Update `TWILIO_WEBSOCKET_URL` to your production WebSocket URL:
   ```
   wss://your-app.fly.dev/twilio-media-stream
   ```

3. Ensure your hosting platform exposes port 8080 for WebSocket connections

## Troubleshooting

### "OPENAI_API_KEY not configured" error
- Ensure `OPENAI_API_KEY` is set in `.env.local`
- Restart your dev servers after adding the key

### "WebSocket connection failed" error
- Verify ngrok is running on port 8080
- Check that `TWILIO_WEBSOCKET_URL` matches your ngrok WebSocket URL
- Ensure the WebSocket server is running (`npm run dev:full`)

### "Twilio credentials invalid" error
- Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are correct
- Check for extra spaces or quotes in the environment variable values


















