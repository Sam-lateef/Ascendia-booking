/**
 * Test: Verify booking API filters organizationId parameter
 * Simulates what the orchestrator LLM was doing (incorrectly)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function testBookingAPIFix() {
  console.log('\n🧪 Testing Booking API Parameter Filtering\n');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const orgId = 'b445a9c7-af93-4b4a-a975-40d3f44178ec';

  // Test 1: Call WITH organizationId in parameters (the bug scenario)
  console.log('Test 1: GetMultiplePatients WITH organizationId in parameters (simulating bug)');
  try {
    const response1 = await fetch(`${baseUrl}/api/booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Organization-Id': orgId  // Correct way to pass org
      },
      body: JSON.stringify({
        functionName: 'GetMultiplePatients',
        parameters: {
          LName: 'Lateef',
          organizationId: orgId  // WRONG - but API should handle this now
        }
      })
    });

    const data1 = await response1.json();
    
    if (response1.ok && !data1.error) {
      console.log('   ✅ SUCCESS - API handled the extra parameter');
      console.log(`   Found ${Array.isArray(data1) ? data1.length : 0} patients`);
      if (Array.isArray(data1) && data1.length > 0) {
        console.log(`   Sample: ${data1[0].FName} ${data1[0].LName}`);
      }
    } else {
      console.log('   ✗ FAILED -', data1.message || data1.error);
      console.log('   Response:', JSON.stringify(data1, null, 2));
    }
  } catch (error) {
    console.log('   ✗ ERROR:', error.message);
  }

  // Test 2: Call WITHOUT organizationId in parameters (correct way)
  console.log('\nTest 2: GetMultiplePatients WITHOUT organizationId (correct usage)');
  try {
    const response2 = await fetch(`${baseUrl}/api/booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Organization-Id': orgId
      },
      body: JSON.stringify({
        functionName: 'GetMultiplePatients',
        parameters: {
          LName: 'Lateef'
        }
      })
    });

    const data2 = await response2.json();
    
    if (response2.ok && !data2.error) {
      console.log('   ✅ SUCCESS');
      console.log(`   Found ${Array.isArray(data2) ? data2.length : 0} patients`);
    } else {
      console.log('   ✗ FAILED -', data2.message || data2.error);
    }
  } catch (error) {
    console.log('   ✗ ERROR:', error.message);
  }

  // Test 3: Search by phone WITH organizationId (another bug scenario)
  console.log('\nTest 3: GetMultiplePatients by Phone WITH organizationId parameter');
  try {
    const response3 = await fetch(`${baseUrl}/api/booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Organization-Id': orgId
      },
      body: JSON.stringify({
        functionName: 'GetMultiplePatients',
        parameters: {
          Phone: '6194563960',
          organizationId: orgId  // WRONG - but should be filtered
        }
      })
    });

    const data3 = await response3.json();
    
    if (response3.ok && !data3.error) {
      console.log('   ✅ SUCCESS - API filtered organizationId');
      console.log(`   Found ${Array.isArray(data3) ? data3.length : 0} patients`);
      if (Array.isArray(data3) && data3.length > 0) {
        console.log(`   Patient: ${data3[0].FName} ${data3[0].LName} - ${data3[0].WirelessPhone}`);
      }
    } else {
      console.log('   ✗ FAILED -', data3.message || data3.error);
    }
  } catch (error) {
    console.log('   ✗ ERROR:', error.message);
  }

  console.log('\n📊 Summary:');
  console.log('   If all 3 tests passed, the fix is working correctly!');
  console.log('   The API now automatically filters out organizationId from parameters.');
  console.log('');
}

testBookingAPIFix()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  });
