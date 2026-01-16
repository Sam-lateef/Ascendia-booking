/**
 * Test script to verify Twilio endpoints are accessible
 * Run: node test-twilio-endpoints.js
 */

const https = require('https');
const http = require('http');

// Test configuration
const tests = [
  {
    name: 'Twilio Voice Endpoint (should return TwiML)',
    url: 'https://ascendia-api.ngrok.io/api/twilio/incoming-call',
    method: 'POST',
    data: 'From=%2B15551234567&To=%2B15559876543&CallSid=CA_test_123',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  },
  {
    name: 'Twilio SMS Endpoint (should return TwiML)',
    url: 'https://ascendia-api.ngrok.io/api/twilio/incoming-sms',
    method: 'POST',
    data: 'Body=test+message&From=%2B15551234567&To=%2B15559876543&MessageSid=SM_test_123',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  },
  {
    name: 'Local Next.js (port 3000)',
    url: 'http://localhost:3000',
    method: 'GET',
  },
  {
    name: 'Local WebSocket Server (port 8080)',
    url: 'http://localhost:8080/health',
    method: 'GET',
  },
];

function testEndpoint(test) {
  return new Promise((resolve) => {
    const url = new URL(test.url);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: test.method || 'GET',
      headers: test.headers || {},
      timeout: 10000,
    };

    if (test.data) {
      options.headers['Content-Length'] = Buffer.byteLength(test.data);
    }

    console.log(`\n🔍 Testing: ${test.name}`);
    console.log(`   URL: ${test.method} ${test.url}`);

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const status = res.statusCode;
        const isSuccess = status >= 200 && status < 400;

        console.log(`   Status: ${status} ${res.statusMessage}`);
        
        if (isSuccess) {
          console.log(`   ✅ SUCCESS`);
          if (data.includes('<?xml')) {
            console.log(`   📄 Response: TwiML detected (${data.length} chars)`);
            // Show first 200 chars of TwiML
            console.log(`   Preview: ${data.substring(0, 200)}...`);
          } else if (data) {
            console.log(`   📄 Response: ${data.substring(0, 200)}`);
          }
        } else {
          console.log(`   ❌ FAILED`);
          console.log(`   Error: ${data.substring(0, 500)}`);
        }

        resolve({ test: test.name, status, success: isSuccess });
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ ERROR: ${error.message}`);
      resolve({ test: test.name, status: 0, success: false, error: error.message });
    });

    req.on('timeout', () => {
      console.log(`   ⏱️  TIMEOUT: Request took too long`);
      req.destroy();
      resolve({ test: test.name, status: 0, success: false, error: 'Timeout' });
    });

    if (test.data) {
      req.write(test.data);
    }

    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('🧪 TWILIO ENDPOINT TESTING');
  console.log('='.repeat(70));

  const results = [];

  for (const test of tests) {
    const result = await testEndpoint(test);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between tests
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));

  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.test}: ${result.status || 'ERROR'}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  const allSuccess = results.every(r => r.success);
  
  console.log('\n' + '='.repeat(70));
  if (allSuccess) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('\nYour Twilio integration should work when you call.');
  } else {
    console.log('⚠️  SOME TESTS FAILED');
    console.log('\nCheck the errors above and fix them before testing calls.');
  }
  console.log('='.repeat(70));
}

// Run tests
runTests().catch(console.error);






