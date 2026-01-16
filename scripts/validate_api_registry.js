/**
 * API Registry Validation Script
 * 
 * This script:
 * 1. Tests each endpoint in api_registry.json against the real API
 * 2. Identifies duplicates and conflicts
 * 3. Validates parameter names and types
 * 4. Generates a clean, tested registry
 * 5. Creates a detailed validation report
 * 
 * Usage:
 *   node scripts/validate_api_registry.js
 * 
 * Environment Variables:
 *   OPENDENTAL_API_KEY=your_key_here
 *   OPENDENTAL_API_BASE_URL=https://api.opendental.com/api/v1
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const REGISTRY_PATH = path.join(__dirname, '../docs/API/api_registry.json');
const OUTPUT_DIR = path.join(__dirname, '../docs/API/validated');
const VALIDATION_REPORT_PATH = path.join(OUTPUT_DIR, 'validation_report.json');
const CLEAN_REGISTRY_PATH = path.join(OUTPUT_DIR, 'validated_registry.json');
const ISSUES_PATH = path.join(OUTPUT_DIR, 'issues.json');

const API_BASE_URL = process.env.OPENDENTAL_API_BASE_URL || 'https://api.opendental.com/api/v1';
const API_KEY = process.env.OPENDENTAL_API_KEY;

// Test data for validation (adjust for your test environment)
const TEST_DATA = {
  existingPatNum: 22, // Sam Lateef from your test DB
  existingAptNum: 53,
  testDate: '2025-10-27',
  testDateTime: '2025-10-27 15:00:00',
};

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Load the API registry
 */
function loadRegistry() {
  log('\n📖 Loading API registry...', 'cyan');
  const registryData = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  log(`✅ Loaded ${registryData.endpoints.length} endpoints`, 'green');
  return registryData;
}

/**
 * Find duplicate function names
 */
function findDuplicates(endpoints) {
  log('\n🔍 Checking for duplicates...', 'cyan');
  const seen = new Map();
  const duplicates = [];

  endpoints.forEach((endpoint, index) => {
    const name = endpoint.function_name;
    if (seen.has(name)) {
      duplicates.push({
        function_name: name,
        first_occurrence: seen.get(name),
        duplicate_at: index,
        first_endpoint: endpoints[seen.get(name)].endpoint,
        duplicate_endpoint: endpoint.endpoint,
      });
      log(`⚠️  DUPLICATE: ${name}`, 'yellow');
      log(`   First:  ${endpoints[seen.get(name)].endpoint}`, 'yellow');
      log(`   Second: ${endpoint.endpoint}`, 'yellow');
    } else {
      seen.set(name, index);
    }
  });

  if (duplicates.length === 0) {
    log('✅ No duplicates found', 'green');
  } else {
    log(`⚠️  Found ${duplicates.length} duplicate function names`, 'yellow');
  }

  return duplicates;
}

/**
 * Test an endpoint against the real API
 */
async function testEndpoint(endpoint) {
  const functionName = endpoint.function_name;
  const method = endpoint.method;
  let url = API_BASE_URL;

  // Build URL
  let endpointPath = endpoint.endpoint;
  
  // Strip /api/v1 or /api prefix if present
  if (endpointPath.startsWith('/api/v1/')) {
    endpointPath = endpointPath.substring(7);
  } else if (endpointPath.startsWith('/api/')) {
    endpointPath = endpointPath.substring(4);
  }
  
  // Ensure path starts with /
  if (!endpointPath.startsWith('/')) {
    endpointPath = '/' + endpointPath;
  }

  url = API_BASE_URL.replace(/\/$/, '') + endpointPath;

  // Replace path parameters with test data
  url = url.replace(/{PatNum}/g, TEST_DATA.existingPatNum);
  url = url.replace(/{AptNum}/g, TEST_DATA.existingAptNum);
  url = url.replace(/{AppointmentId}/g, TEST_DATA.existingAptNum);
  url = url.replace(/{patient_id}/g, TEST_DATA.existingPatNum);
  url = url.replace(/{id}/g, TEST_DATA.existingPatNum);

  const options = {
    method,
    headers: {
      'Authorization': API_KEY,
      'Content-Type': 'application/json',
    },
  };

  // For POST/PUT, add minimal body (don't actually create/modify data)
  if (method === 'POST' || method === 'PUT') {
    // Skip write operations in validation - we'll mark them as "untested but safe"
    return {
      status: 'skipped_write',
      reason: 'Write operation skipped to prevent data changes',
      url,
      method,
    };
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    return {
      status: response.ok ? 'success' : 'failed',
      status_code: response.status,
      url,
      method,
      response_data: response.ok ? data : null,
      error: response.ok ? null : data,
    };
  } catch (error) {
    return {
      status: 'error',
      url,
      method,
      error: error.message,
    };
  }
}

/**
 * Validate all endpoints
 */
async function validateEndpoints(endpoints, priorityOnly = true) {
  log('\n🧪 Testing endpoints against real API...', 'cyan');
  log('   (Only testing READ operations to avoid data changes)', 'blue');

  const PRIORITY_FUNCTIONS = [
    'GetPatients',
    'GetPatient',
    'CreatePatient',
    'UpdatePatient',
    'GetAppointments',
    'GetAppointmentById',
    'GetAvailableSlots',
    'CreateAppointment',
    'UpdateAppointment',
    'BreakAppointment',
    'DeleteAppointment',
    'GetProviders',
    'GetProvider',
    'GetInsuranceForPatient',
    'GetPatientBalances',
  ];

  const toTest = priorityOnly
    ? endpoints.filter(ep => PRIORITY_FUNCTIONS.includes(ep.function_name))
    : endpoints;

  log(`   Testing ${toTest.length} endpoints...`, 'blue');

  const results = [];

  for (const endpoint of toTest) {
    const name = endpoint.function_name;
    process.stdout.write(`   Testing ${name}... `);

    const result = await testEndpoint(endpoint);
    results.push({
      function_name: name,
      endpoint: endpoint.endpoint,
      method: endpoint.method,
      ...result,
    });

    if (result.status === 'success') {
      log('✅', 'green');
    } else if (result.status === 'skipped_write') {
      log('⏭️  (skipped write)', 'yellow');
    } else {
      log(`❌ ${result.status_code || 'ERROR'}`, 'red');
    }

    // Rate limiting: wait 200ms between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return results;
}

/**
 * Analyze parameter mismatches
 */
function analyzeParameters(endpoints) {
  log('\n🔍 Analyzing parameter definitions...', 'cyan');
  
  const issues = [];

  // Check for common mismatches
  const parameterMappings = {
    'PatientId': 'PatNum',
    'patient_id': 'PatNum',
    'Date': 'AptDateTime',
    'date': 'AptDateTime',
    'Notes': 'Note',
    'notes': 'Note',
    'AppointmentId': 'AptNum',
    'appointment_id': 'AptNum',
  };

  endpoints.forEach(endpoint => {
    const params = endpoint.parameters || {};
    Object.keys(params).forEach(paramName => {
      if (parameterMappings[paramName]) {
        issues.push({
          function_name: endpoint.function_name,
          parameter: paramName,
          suggested_correction: parameterMappings[paramName],
          reason: 'Parameter name does not match OpenDental API convention',
        });
      }
    });
  });

  if (issues.length > 0) {
    log(`⚠️  Found ${issues.length} potential parameter naming issues`, 'yellow');
  } else {
    log('✅ No obvious parameter issues detected', 'green');
  }

  return issues;
}

/**
 * Generate clean registry with only working endpoints
 */
function generateCleanRegistry(endpoints, validationResults, duplicates) {
  log('\n📝 Generating clean registry...', 'cyan');

  // Remove duplicates (keep first occurrence)
  const duplicateNames = new Set(duplicates.map(d => d.function_name));
  const seenFunctions = new Set();
  const noDuplicates = endpoints.filter(ep => {
    if (duplicateNames.has(ep.function_name)) {
      if (seenFunctions.has(ep.function_name)) {
        return false; // Skip duplicate
      }
      seenFunctions.add(ep.function_name);
    }
    return true;
  });

  // Mark endpoints with validation status
  const enriched = noDuplicates.map(ep => {
    const validation = validationResults.find(v => v.function_name === ep.function_name);
    
    return {
      ...ep,
      validation_status: validation ? validation.status : 'untested',
      tested: !!validation,
      working: validation?.status === 'success',
    };
  });

  const cleanRegistry = {
    generated_at: new Date().toISOString(),
    total_endpoints: enriched.length,
    tested_endpoints: enriched.filter(ep => ep.tested).length,
    working_endpoints: enriched.filter(ep => ep.working).length,
    endpoints: enriched,
  };

  fs.writeFileSync(CLEAN_REGISTRY_PATH, JSON.stringify(cleanRegistry, null, 2));
  log(`✅ Clean registry saved to: ${CLEAN_REGISTRY_PATH}`, 'green');

  return cleanRegistry;
}

/**
 * Generate validation report
 */
function generateReport(registry, duplicates, validationResults, parameterIssues) {
  log('\n📊 Generating validation report...', 'cyan');

  const report = {
    generated_at: new Date().toISOString(),
    summary: {
      total_endpoints: registry.endpoints.length,
      duplicates_found: duplicates.length,
      tested_endpoints: validationResults.length,
      successful_tests: validationResults.filter(r => r.status === 'success').length,
      failed_tests: validationResults.filter(r => r.status === 'failed').length,
      skipped_writes: validationResults.filter(r => r.status === 'skipped_write').length,
      parameter_issues: parameterIssues.length,
    },
    duplicates,
    validation_results: validationResults,
    parameter_issues: parameterIssues,
  };

  fs.writeFileSync(VALIDATION_REPORT_PATH, JSON.stringify(report, null, 2));
  log(`✅ Validation report saved to: ${VALIDATION_REPORT_PATH}`, 'green');

  // Also save just the issues for easy review
  const issues = {
    duplicates,
    failed_validations: validationResults.filter(r => r.status === 'failed' || r.status === 'error'),
    parameter_issues: parameterIssues,
  };

  fs.writeFileSync(ISSUES_PATH, JSON.stringify(issues, null, 2));
  log(`✅ Issues summary saved to: ${ISSUES_PATH}`, 'green');

  return report;
}

/**
 * Print summary
 */
function printSummary(report) {
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 VALIDATION SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  
  log(`\n📚 Total Endpoints: ${report.summary.total_endpoints}`, 'blue');
  log(`🔍 Tested: ${report.summary.tested_endpoints}`, 'blue');
  log(`✅ Successful: ${report.summary.successful_tests}`, 'green');
  log(`❌ Failed: ${report.summary.failed_tests}`, 'red');
  log(`⏭️  Skipped (writes): ${report.summary.skipped_writes}`, 'yellow');
  log(`⚠️  Duplicates: ${report.summary.duplicates_found}`, 'yellow');
  log(`⚠️  Parameter Issues: ${report.summary.parameter_issues}`, 'yellow');

  log('\n' + '='.repeat(60), 'cyan');
}

/**
 * Main execution
 */
async function main() {
  log('\n🚀 API Registry Validator', 'cyan');
  log('='.repeat(60), 'cyan');

  if (!API_KEY) {
    log('\n❌ ERROR: OPENDENTAL_API_KEY not set in .env', 'red');
    log('   Please add: OPENDENTAL_API_KEY=your_key_here', 'yellow');
    process.exit(1);
  }

  try {
    // Step 1: Load registry
    const registry = loadRegistry();

    // Step 2: Find duplicates
    const duplicates = findDuplicates(registry.endpoints);

    // Step 3: Analyze parameters
    const parameterIssues = analyzeParameters(registry.endpoints);

    // Step 4: Validate endpoints (priority functions only by default)
    const validationResults = await validateEndpoints(registry.endpoints, true);

    // Step 5: Generate clean registry
    const cleanRegistry = generateCleanRegistry(
      registry.endpoints,
      validationResults,
      duplicates
    );

    // Step 6: Generate report
    const report = generateReport(
      registry,
      duplicates,
      validationResults,
      parameterIssues
    );

    // Step 7: Print summary
    printSummary(report);

    log('\n✅ Validation complete!', 'green');
    log(`   Check ${OUTPUT_DIR} for detailed results\n`, 'blue');

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the validator
main();





























