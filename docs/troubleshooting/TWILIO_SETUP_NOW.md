# 🚨 QUICK TWILIO SETUP - DO THIS NOW

## Step 1: Get Your ngrok URLs

A new PowerShell window opened with ngrok running. Look for these URLs:

```
Forwarding  https://ascendia-api.ngrok.io -> http://localhost:3000
Forwarding  https://ascendia-ws.ngrok.io -> http://localhost:8080
```

**OR** Visit: http://127.0.0.1:4040 (ngrok web interface)

## Step 2: Configure Twilio Dashboard

Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming

1. **Click your phone number**

2. **Voice Configuration:**
   - A Call Comes In: `https://ascendia-api.ngrok.io/api/twilio/incoming-call`
   - Method: `HTTP POST`

3. **Messaging Configuration:**
   - A Message Comes In: `https://ascendia-api.ngrok.io/api/twilio/incoming-sms`
   - Method: `HTTP POST`

4. **Click SAVE**

## Step 3: Test Immediately

**Call your Twilio number** - You should now see logs in Terminal 5:

```
[Twilio Call] Incoming call from +1234567890 to +1987654321, CallSid: CA...
[Twilio WS] New connection established
[Twilio WS] Connected to OpenAI Realtime API
[Twilio WS] Stream started: MZ...
```

## ⚠️ IMPORTANT NOTES

1. **ngrok URLs change** every time you restart ngrok (unless you have paid ngrok account)
2. **You must update Twilio dashboard** every time ngrok restarts with new URLs
3. **Keep the ngrok PowerShell window open** - closing it stops the tunnels

## 🔍 Troubleshooting

### Still no logs?

1. **Check ngrok is running:**
   - Look for the new PowerShell window
   - Or visit http://127.0.0.1:4040

2. **Verify Twilio webhook URLs:**
   - They must start with `https://` (not `http://`)
   - They must use your actual ngrok domain
   - Method must be `HTTP POST`

3. **Test the endpoints directly:**
   ```
   # In browser, visit:
   https://ascendia-api.ngrok.io/api/twilio/incoming-call
   
   # Should return: Method Not Allowed (because it needs POST)
   ```

### ngrok window closed?

Run this again:
```powershell
cd D:\Dev\Agent0; Start-Process powershell -ArgumentList '-NoExit', '-Command', 'ngrok start --all'
```

## ✅ Success Check

When you call, Terminal 5 should show:
```
[0] [Twilio Call] Incoming call from +1XXX...
[1] [Twilio WS] New connection established
[1] [Twilio WS] Connected to OpenAI Realtime API
```

If you see this - YOU'RE LIVE! 🎉






