# Twilio Integration - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Add Environment Variables

Add these to your `.env.local` file:

```bash
# Twilio Credentials (from your Twilio.md file)
TWILIO_ACCOUNT_SID=AC6ed333dfcf6dae866f8f2c451b56084b
TWILIO_AUTH_TOKEN=aeb9cce73f06261c65e0c227b2815c85
TWILIO_PHONE_NUMBER=+1YOUR_TWILIO_NUMBER

# Twilio WebSocket URL
TWILIO_WEBSOCKET_URL=wss://ascendia-ws.ngrok.io/twilio-media-stream

# Ensure OpenAI key is set
OPENAI_API_KEY=sk-proj-xxxxx
```

### Step 2: Start Servers

**Terminal 1 - Application:**
```bash
npm run dev:full
```

This starts:
- Next.js on port 3000
- WebSocket server on port 8080 (with both Retell and Twilio handlers)

**Terminal 2 - ngrok Tunnels:**
```bash
ngrok start --all
```

This creates:
- `https://ascendia-api.ngrok.io` → Port 3000 (HTTP/API)
- `wss://ascendia-ws.ngrok.io` → Port 8080 (WebSocket)

### Step 3: Configure Twilio

1. Go to [Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Click your phone number
3. Set **Voice Configuration:**
   - A Call Comes In: `https://ascendia-api.ngrok.io/api/twilio/incoming-call`
   - Method: `HTTP POST`
4. Set **Messaging Configuration:**
   - A Message Comes In: `https://ascendia-api.ngrok.io/api/twilio/incoming-sms`
   - Method: `HTTP POST`
5. Click **Save**

### Step 4: Test Voice Call

1. **Call your Twilio number**
2. You should hear: "Hi! Welcome to [Office Name]. This is Lexi. How can I help you today?"
3. Try saying: "I'd like to book an appointment"
4. Follow Lexi's prompts

**What to watch:**
```bash
# Terminal 1 should show:
[Twilio WS] New connection established
[Twilio WS] Connected to OpenAI Realtime API
[Twilio WS] Stream started: MZ...
[Twilio WS] User said: I'd like to book an appointment
[Twilio WS] Function called: GetAvailableSlots
```

### Step 5: Test SMS

1. **Send SMS to your Twilio number:** "Hi"
2. You should receive: "Hi! Welcome to [Office Name]. This is Lexi. How can I help you today?"
3. Reply with: "I need to schedule a cleaning"
4. Follow Lexi's text responses

**What to watch:**
```bash
# Terminal 1 should show:
[Twilio SMS] Message from +1234567890: "Hi"
[Twilio SMS] Processing with Lexi (first message)...
[Twilio SMS] Response: "Hi! Welcome to..."
```

## 🔍 Verification Checklist

- [ ] Servers started without errors
- [ ] ngrok tunnels active (check ngrok web interface at http://127.0.0.1:4040)
- [ ] Twilio dashboard configured with correct URLs
- [ ] Voice call connects and Lexi responds
- [ ] SMS messages receive responses
- [ ] Function calls execute (check terminal logs)

## 🎯 Quick Tests

### Test 1: Voice - Get Current Date/Time
**Say:** "What day is it today?"
**Expected:** Lexi tells you the current date and day

### Test 2: Voice - Check Availability
**Say:** "What times are available on Friday?"
**Expected:** Lexi lists available time slots

### Test 3: SMS - Get Office Info
**Text:** "What are your hours?"
**Expected:** Lexi responds with office hours

### Test 4: SMS - Book Appointment
**Text:** "I'd like to book an appointment"
**Expected:** Lexi asks for your information and guides you through booking

## ❌ Troubleshooting

### "No ephemeral key" error
- **Cause:** Missing `OPENAI_API_KEY`
- **Fix:** Add to `.env.local` and restart

### "WebSocket connection failed"
- **Cause:** ngrok not running or wrong URL
- **Fix:** Check `TWILIO_WEBSOCKET_URL` matches ngrok WebSocket domain

### "No response to voice call"
- **Cause:** Twilio webhook URL incorrect
- **Fix:** Verify URL in Twilio dashboard matches ngrok HTTP domain

### "No response to SMS"
- **Cause:** SMS webhook URL incorrect
- **Fix:** Verify URL in Twilio dashboard, check server logs

## 📊 Monitoring

### ngrok Web Interface
Visit http://127.0.0.1:4040 to see:
- Incoming requests from Twilio
- Request/response details
- Replay requests for debugging

### Server Logs
Watch Terminal 1 for:
- `[Twilio WS]` - Voice call activity
- `[Twilio SMS]` - SMS message activity
- `[Lexi Twilio]` - Function execution logs
- `[WebSocket Server]` - Connection status

## 🎉 Success Indicators

You'll know it's working when you see:

1. **Voice Call:**
   ```
   [Twilio WS] New connection established
   [Twilio WS] Connected to OpenAI Realtime API
   [Twilio WS] Stream started: MZ...
   ```

2. **SMS:**
   ```
   [Twilio SMS] Message from +1234567890: "Hi"
   [Twilio SMS] Response: "Hi! Welcome to..."
   ```

3. **Function Calls:**
   ```
   [Twilio WS] Function called: GetAvailableSlots
   [Lexi Twilio] ✅ GetAvailableSlots succeeded
   ```

## 📚 Next Steps

Once everything works:
1. **Test All Functions:** Try booking, rescheduling, and canceling
2. **Review Logs:** Understand the flow and identify any issues
3. **Customize Lexi:** Update instructions in `lexiAgentTwilio.ts`
4. **Prepare for Production:** See `TWILIO_INTEGRATION_COMPLETE.md`

## 🆘 Need Help?

1. Check `docs/TWILIO_ENV_SETUP.md` for detailed configuration
2. Check `docs/TWILIO_INTEGRATION_COMPLETE.md` for architecture details
3. Review server logs for specific error messages
4. Test endpoints directly in browser/Postman

---

**Ready to go? Start with Step 1! 🚀**


















