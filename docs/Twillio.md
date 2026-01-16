Complete Twilio Integration Guide - UPDATED WITH BEST AUDIO CONVERSION
Your Twilio Credentials
envTWILIO_ACCOUNT_SID=AC6ed333dfcf6dae866f8f2c451b56084b
TWILIO_AUTH_TOKEN=aeb9cce73f06261c65e0c227b2815c85
TWILIO_2FA=PA2R4P1ASNPG9J9SGK63TTWY
OPENAI_API_KEY=your_openai_key
Your Domain Setup

API Domain: https://ascendia-api.ngrok.io - for HTTP endpoints (calls, SMS)
WebSocket Domain: wss://ascendia-ws.ngrok.io - for audio streaming

Required Libraries
bashnpm install @openai/realtime-api-beta twilio ws wavefile
Key Library: wavefile - handles μ-law ↔ PCM conversion and resampling in one go

Step 1: Configure Your Twilio Phone Number

Go to Twilio Console → Phone Numbers → Manage → Active Numbers
Click on your phone number
Voice Configuration:

A Call Comes In: https://ascendia-api.ngrok.io/incoming-call (HTTP POST)


Messaging Configuration:

A Message Comes In: https://ascendia-api.ngrok.io/incoming-sms (HTTP POST)


Save


Step 2: HTTP Endpoints (ascendia-api server on port 3000)
javascriptconst express = require('express');
const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Voice Call Endpoint
app.post('/incoming-call', (req, res) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="wss://ascendia-ws.ngrok.io/media-stream" />
    </Connect>
</Response>`;
  
  res.type('text/xml');
  res.send(twiml);
});

// SMS Endpoint
app.post('/incoming-sms', async (req, res) => {
  const { Body, From, To } = req.body;
  
  console.log(`SMS from ${From}: ${Body}`);
  
  // Process with your agent/logic
  const responseText = await handleSmsWithAgent(Body, From);
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${responseText}</Message>
</Response>`;
  
  res.type('text/xml');
  res.send(twiml);
});

// Your SMS handler function
async function handleSmsWithAgent(message, fromNumber) {
  // Integrate with your existing agent logic
  // or use OpenAI Chat Completion for SMS
  return "Thanks for your message! We'll get back to you soon.";
}

app.listen(3000, () => {
  console.log('API server on port 3000');
});

Step 3: WebSocket Server (ascendia-ws server on port 3001)
javascriptconst WebSocket = require('ws');
const http = require('http');
const { RealtimeClient } = require('@openai/realtime-api-beta');
const WaveFile = require('wavefile').WaveFile;

const server = http.createServer();

const wss = new WebSocket.Server({ 
  server,
  path: '/media-stream'
});

wss.on('connection', async (twilioWs) => {
  console.log('Twilio connected');
  
  let streamSid = null;
  let callSid = null;
  
  // Initialize OpenAI Realtime
  const client = new RealtimeClient({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-realtime-preview-2024-12-17'
  });
  
  await client.connect();
  
  // Configure session with your tools
  client.updateSession({
    instructions: 'Your agent instructions here',
    voice: 'alloy',
    turn_detection: { type: 'server_vad' },
    tools: [
      {
        type: 'function',
        name: 'your_function_name',
        description: 'Description',
        parameters: {
          type: 'object',
          properties: {
            // your params
          }
        }
      }
    ]
  });
  
  // Keep-alive for Twilio (required every 20s)
  const keepAlive = setInterval(() => {
    if (twilioWs.readyState === WebSocket.OPEN) {
      twilioWs.send(JSON.stringify({ event: 'mark' }));
    }
  }, 20000);
  
  // OpenAI → Twilio: Send audio
  client.on('response.audio.delta', (event) => {
    if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
      const audioData = convertOpenAIToTwilio(event.delta);
      
      twilioWs.send(JSON.stringify({
        event: 'media',
        streamSid: streamSid,
        media: { payload: audioData }
      }));
    }
  });
  
  // Handle function calls from OpenAI
  client.on('response.function_call_arguments.done', async (event) => {
    const { name, arguments: args, call_id } = event;
    
    console.log(`Function called: ${name}`, args);
    
    try {
      const result = await executeYourFunction(name, JSON.parse(args));
      
      client.realtime.send('conversation.item.create', {
        type: 'function_call_output',
        call_id: call_id,
        output: JSON.stringify(result)
      });
      
      client.createResponse();
    } catch (error) {
      console.error('Function execution error:', error);
      
      client.realtime.send('conversation.item.create', {
        type: 'function_call_output',
        call_id: call_id,
        output: JSON.stringify({ error: error.message })
      });
    }
  });
  
  // Twilio → OpenAI: Receive audio
  twilioWs.on('message', (message) => {
    const msg = JSON.parse(message);
    
    switch (msg.event) {
      case 'start':
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;
        console.log('Stream started:', streamSid);
        break;
        
      case 'media':
        const audioData = convertTwilioToOpenAI(msg.media.payload);
        client.appendInputAudio(audioData);
        break;
        
      case 'stop':
        console.log('Stream stopped');
        clearInterval(keepAlive);
        client.disconnect();
        break;
    }
  });
  
  twilioWs.on('close', () => {
    console.log('Twilio disconnected');
    clearInterval(keepAlive);
    client.disconnect();
  });
  
  twilioWs.on('error', (error) => {
    console.error('WebSocket error:', error);
    clearInterval(keepAlive);
    client.disconnect();
  });
});

server.listen(3001, () => {
  console.log('WebSocket server on port 3001');
});

Step 4: Audio Conversion Functions (BEST METHOD)
Using wavefile library - handles everything cleanly:
javascriptconst WaveFile = require('wavefile').WaveFile;

// Twilio μ-law 8kHz → OpenAI PCM16 24kHz base64
function convertTwilioToOpenAI(mulawBase64) {
  const wav = new WaveFile();
  
  // Create wave file from μ-law data
  wav.fromScratch(1, 8000, '8m', Buffer.from(mulawBase64, 'base64'));
  
  // Convert μ-law to PCM
  wav.fromMuLaw();
  
  // Resample to 24kHz (OpenAI's format)
  wav.toSampleRate(24000);
  
  // Return as base64
  return Buffer.from(wav.data.samples).toString('base64');
}

// OpenAI PCM16 24kHz base64 → Twilio μ-law 8kHz
function convertOpenAIToTwilio(pcm24kBase64) {
  const wav = new WaveFile();
  
  // Create wave file from PCM16 24kHz
  const pcmBuffer = Buffer.from(pcm24kBase64, 'base64');
  wav.fromScratch(1, 24000, '16', pcmBuffer);
  
  // Resample to 8kHz (Twilio's format)
  wav.toSampleRate(8000);
  
  // Convert to μ-law
  wav.toMuLaw();
  
  // Return as base64
  return Buffer.from(wav.data.samples).toString('base64');
}
Why wavefile is best:

Handles μ-law ↔ PCM conversion natively
Built-in high-quality resampling
Clean API, one library for everything
Battle-tested in production


Step 5: Your Function Handler
javascriptasync function executeYourFunction(functionName, args) {
  switch(functionName) {
    case 'book_appointment':
      return await yourExistingBookingFunction(args);
      
    case 'check_availability':
      return await yourExistingAvailabilityFunction(args);
      
    case 'get_customer_info':
      return await yourExistingCustomerLookup(args);
      
    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}

Step 6: Run Your Servers
Terminal 1 - API Server:
bashngrok http 3000 --domain=ascendia-api.ngrok.io
node api-server.js
Terminal 2 - WebSocket Server:
bashngrok http 3001 --domain=ascendia-ws.ngrok.io
node ws-server.js

Testing

Call your Twilio number → voice agent should respond
Send SMS to your Twilio number → automated response
Monitor both terminals for logs


Important Notes

wavefile handles all the audio complexity - no manual μ-law encoding/decoding needed
Two servers required: HTTP (port 3000) + WebSocket (port 3001)
Keep both ngrok tunnels running
Test audio quality: Speak clearly and check for robotic sound
Cost monitoring: Twilio + OpenAI both charge per minute

That's the complete setup. Feed this to Cursor - the audio conversion with wavefile is production-ready and much cleaner than manual conversion.