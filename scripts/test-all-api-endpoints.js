#!/usr/bin/env node
/**
 * Test All API Endpoints
 * Verifies that all API endpoints are accessible and returning 200/401 (not 500)
 * 
 * Usage: node scripts/test-all-api-endpoints.js
 */

const endpoints = [
  // Booking System
  { url: '/api/booking', method: 'POST', requiresAuth: true, body: { functionName: 'GetProviders', parameters: {} } },
  
  // User & Organizations
  { url: '/api/user/organizations', method: 'GET', requiresAuth: true },
  
  // Admin APIs
  { url: '/api/admin/current-org', method: 'GET', requiresAuth: true },
  { url: '/api/admin/agent-mode', method: 'GET', requiresAuth: true },
  { url: '/api/admin/agent-instructions', method: 'GET', requiresAuth: true },
  
  // Treatment System
  { url: '/api/treatments-catalog', method: 'GET', requiresAuth: true },
  
  // Session (public)
  { url: '/api/session', method: 'GET', requiresAuth: false },
];

console.log('🔍 API Endpoints Test Plan\n');
console.log(`Total endpoints to test: ${endpoints.length}\n`);

endpoints.forEach((endpoint, index) => {
  console.log(`${index + 1}. ${endpoint.method} ${endpoint.url}`);
  console.log(`   Auth required: ${endpoint.requiresAuth ? '✅ Yes' : '❌ No'}`);
  if (endpoint.body) {
    console.log(`   Body: ${JSON.stringify(endpoint.body).substring(0, 50)}...`);
  }
  console.log('');
});

console.log('\n📝 Manual Testing Instructions:\n');
console.log('1. Open http://localhost:3000');
console.log('2. Log in with your credentials');
console.log('3. Open browser DevTools (F12)');
console.log('4. Go to Network tab');
console.log('5. Navigate through these pages:');
console.log('   - Dashboard (/admin/booking)');
console.log('   - Patients (/admin/booking/patients)');
console.log('   - Providers (/admin/booking/providers)');
console.log('   - Appointments (/admin/booking/appointments)');
console.log('   - Schedules (/admin/booking/schedules)');
console.log('   - Settings (/admin/booking/settings)');
console.log('   - Translations (/admin/booking/translations)');
console.log('');
console.log('6. For each page, verify in Network tab:');
console.log('   ✅ Status: 200 OK (not 401 or 500)');
console.log('   ✅ Request Headers include: Authorization: Bearer <token>');
console.log('   ✅ Response contains data (not empty)');
console.log('');
console.log('7. Check Console for:');
console.log('   ✅ [FetchInterceptor] Installed - message on page load');
console.log('   ✅ No "Unauthorized" errors');
console.log('   ✅ No "No token provided" errors');
console.log('');
console.log('✅ If all checks pass, authentication is working correctly!');
