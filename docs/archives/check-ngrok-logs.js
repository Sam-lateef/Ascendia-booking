/**
 * Check ngrok logs to see if Twilio is actually calling
 * Run: node check-ngrok-logs.js
 */

const http = require('http');

console.log('🔍 Checking ngrok inspector for incoming requests...\n');
console.log('This will show you if Twilio is actually calling your webhook.\n');

// ngrok inspector API endpoint
const options = {
  hostname: '127.0.0.1',
  port: 4040,
  path: '/api/requests/http',
  method: 'GET',
  headers: {
    'Accept': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.log('❌ Cannot access ngrok inspector.');
      console.log('   Make sure ngrok is running!');
      console.log('   Visit: http://127.0.0.1:4040\n');
      return;
    }

    try {
      const response = JSON.parse(data);
      const requests = response.requests || [];

      console.log('='.repeat(70));
      console.log('📊 NGROK INCOMING REQUESTS');
      console.log('='.repeat(70));

      if (requests.length === 0) {
        console.log('\n⚠️  NO REQUESTS RECEIVED YET\n');
        console.log('This means either:');
        console.log('1. You haven\'t called your Twilio number yet');
        console.log('2. Twilio webhook URL is incorrect');
        console.log('3. Twilio is sending to a different URL\n');
        console.log('💡 Try calling your Twilio number now...\n');
      } else {
        console.log(`\n✅ Found ${requests.length} recent requests:\n`);

        requests.slice(0, 10).forEach((req, index) => {
          const uri = req.uri || 'unknown';
          const method = req.method || 'unknown';
          const status = req.response?.status || 'pending';
          const timestamp = req.start ? new Date(req.start).toLocaleTimeString() : 'unknown';

          console.log(`${index + 1}. ${method} ${uri}`);
          console.log(`   Status: ${status}`);
          console.log(`   Time: ${timestamp}`);
          
          // Check if it's a Twilio endpoint
          if (uri.includes('/api/twilio/')) {
            console.log('   🎯 THIS IS A TWILIO REQUEST!');
          }
          console.log('');
        });
      }

      console.log('='.repeat(70));
      console.log('\n💡 TIP: Visit http://127.0.0.1:4040 to see detailed request/response data\n');

    } catch (error) {
      console.log('❌ Error parsing ngrok response:', error.message);
    }
  });
});

req.on('error', (error) => {
  console.log('❌ Cannot connect to ngrok inspector');
  console.log('   Error:', error.message);
  console.log('\n💡 Make sure:');
  console.log('   1. ngrok is running');
  console.log('   2. ngrok web interface is on port 4040');
  console.log('   3. Visit http://127.0.0.1:4040 in browser\n');
});

req.end();






