# 🔴 CHECK TWILIO ERROR LOGS

## Step 1: Open Twilio Debugger

Go to: **https://console.twilio.com/us1/monitor/logs/debugger**

This shows you EXACTLY what went wrong!

## Step 2: Look for Recent Errors

You should see red error entries with your recent calls.

## Common Errors & Solutions:

### Error 1: "Unable to connect to URL"
**Problem:** ngrok tunnel is down or URL is wrong
**Fix:** 
- Make sure ngrok is running: `ngrok start --all`
- Check ngrok shows: `https://ascendia-api.ngrok.io`

### Error 2: "SSL/TLS Certificate Error"
**Problem:** ngrok URL uses http instead of https
**Fix:** Change webhook to use `https://` (not `http://`)

### Error 3: "Timeout" or "502 Bad Gateway"
**Problem:** Next.js server not running
**Fix:** Make sure `npm run dev:full` is running

### Error 4: "Invalid TwiML"
**Problem:** Endpoint returned wrong format
**Fix:** Check if endpoint is actually returning XML

### Error 5: "11200: HTTP retrieval failure"
**Problem:** Twilio can't reach your URL at all
**Fix:** 
- Verify ngrok is running
- Check firewall isn't blocking
- Test URL in browser: `https://ascendia-api.ngrok.io/api/twilio/incoming-call`

## Step 3: Share the Error

**Tell me:**
1. What's the error code? (like 11200, 11750, etc.)
2. What's the error message?
3. What's the "Request URL" shown in the error?

Then I can help you fix it immediately!

## Quick Debug Commands:

```bash
# Check if ngrok is running
curl http://127.0.0.1:4040/api/tunnels

# Test your endpoint directly
curl -X POST https://ascendia-api.ngrok.io/api/twilio/incoming-call -d "From=%2B15551234567&To=%2B15559876543&CallSid=TEST123"
```






