/**
 * Self-Correcting API Registry Validator
 * 
 * This script:
 * 1. Tests each endpoint against the real API
 * 2. When it fails, analyzes the error message
 * 3. Attempts automatic corrections (parameter names, URL paths, etc.)
 * 4. Retests with corrections
 * 5. Iterates until success or max attempts reached
 * 6. Saves corrected definitions to a new registry
 * 
 * Usage:
 *   node scripts/auto_correct_registry.js
 * 
 * Environment Variables:
 *   OPENDENTAL_API_KEY=your_key_here
 *   OPENDENTAL_API_BASE_URL=https://api.opendental.com/api/v1
 *   DRY_RUN=true  (optional: test without making changes)
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const REGISTRY_PATH = path.join(__dirname, '../docs/API/api_registry.json');
const OUTPUT_DIR = path.join(__dirname, '../docs/API/validated');
const CORRECTED_REGISTRY_PATH = path.join(OUTPUT_DIR, 'auto_corrected_registry.json');
const CORRECTION_LOG_PATH = path.join(OUTPUT_DIR, 'corrections_log.json');

const API_BASE_URL = process.env.OPENDENTAL_API_BASE_URL || 'https://api.opendental.com/api/v1';
const API_KEY = process.env.OPENDENTAL_API_KEY;
const DRY_RUN = process.env.DRY_RUN === 'true';

const MAX_ATTEMPTS = 5; // Max correction attempts per endpoint

// Test data
const TEST_DATA = {
  existingPatNum: 22,
  existingAptNum: 53,
  testDate: '2025-10-27',
  testDateTime: '2025-10-27 15:00:00',
};

// Known parameter mappings (learned from errors)
const PARAMETER_CORRECTIONS = {
  'PatientId': 'PatNum',
  'patient_id': 'PatNum',
  'Date': 'AptDateTime',
  'date': 'AptDateTime',
  'appointment_date': 'AptDateTime',
  'Notes': 'Note',
  'notes': 'Note',
  'AppointmentId': 'AptNum',
  'appointment_id': 'AptNum',
  'Provider': 'ProvNum',
  'provider': 'ProvNum',
  'provider_id': 'ProvNum',
  'Operatory': 'Op',
  'operatory': 'Op',
  'operatory_id': 'Op',
  'Status': 'AptStatus',
  'status': 'AptStatus',
};

// Known path corrections
const PATH_CORRECTIONS = [
  { from: '/api/v1/', to: '/' },
  { from: '/api/', to: '/' },
  { from: '{AppointmentId}', to: '{AptNum}' },
  { from: '{PatientId}', to: '{PatNum}' },
  { from: '{patient_id}', to: '{PatNum}' },
];

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Parse error message to identify what needs correction
 */
function parseErrorMessage(errorDetails) {
  const message = typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails);
  const corrections = [];

  // Pattern 1: "X is required" or "X is invalid"
  const requiredMatch = message.match(/(\w+) is (required|invalid)/i);
  if (requiredMatch) {
    corrections.push({
      type: 'missing_parameter',
      parameter: requiredMatch[1],
      reason: requiredMatch[2],
    });
  }

  // Pattern 2: "X is not a valid resource"
  if (message.includes('is not a valid resource')) {
    corrections.push({
      type: 'invalid_path',
      reason: 'Path resource not found',
    });
  }

  // Pattern 3: "breakType is invalid. X is not enabled"
  const breakTypeMatch = message.match(/breakType is invalid\. (\w+) is not enabled/i);
  if (breakTypeMatch) {
    corrections.push({
      type: 'invalid_enum_value',
      parameter: 'breakType',
      invalid_value: breakTypeMatch[1],
      reason: 'Value not enabled in dental office',
    });
  }

  // Pattern 4: Generic "dateStart is invalid"
  if (message.includes('dateStart is invalid') || message.includes('date is invalid')) {
    corrections.push({
      type: 'invalid_date_format',
      reason: 'Date format or range issue',
    });
  }

  return corrections;
}

/**
 * Apply corrections to endpoint definition
 */
function applyCorrections(endpoint, errorAnalysis, attempt) {
  log(`      🔧 Attempt ${attempt}: Applying corrections...`, 'yellow');
  
  const corrected = JSON.parse(JSON.stringify(endpoint)); // Deep clone
  let changesMade = false;

  errorAnalysis.forEach(issue => {
    switch (issue.type) {
      case 'missing_parameter':
        // Check if it's a parameter name mismatch
        const correctedName = PARAMETER_CORRECTIONS[issue.parameter];
        if (correctedName && corrected.parameters) {
          log(`         → Renaming parameter: ${issue.parameter} → ${correctedName}`, 'yellow');
          
          // Rename in parameters definition
          if (corrected.parameters[issue.parameter]) {
            corrected.parameters[correctedName] = corrected.parameters[issue.parameter];
            delete corrected.parameters[issue.parameter];
            changesMade = true;
          }
        }
        break;

      case 'invalid_path':
        // Try different path corrections
        PATH_CORRECTIONS.forEach(correction => {
          if (corrected.endpoint.includes(correction.from)) {
            log(`         → Fixing path: ${correction.from} → ${correction.to}`, 'yellow');
            corrected.endpoint = corrected.endpoint.replace(correction.from, correction.to);
            changesMade = true;
          }
        });
        break;

      case 'invalid_enum_value':
        // For breakType issues, try removing it or using alternative
        if (issue.parameter === 'breakType') {
          log(`         → Marking breakType as optional/problematic`, 'yellow');
          if (corrected.parameters && corrected.parameters.breakType) {
            corrected.parameters.breakType.required = false;
            corrected.parameters.breakType.note = 'May not be supported in test environment';
            changesMade = true;
          }
        }
        break;

      case 'invalid_date_format':
        // Add date format hints
        if (corrected.parameters) {
          Object.keys(corrected.parameters).forEach(param => {
            if (param.toLowerCase().includes('date') && corrected.parameters[param].type === 'string') {
              if (!corrected.parameters[param].format) {
                log(`         → Adding date format hint for ${param}`, 'yellow');
                corrected.parameters[param].format = 'yyyy-MM-dd or yyyy-MM-dd HH:mm:ss';
                changesMade = true;
              }
            }
          });
        }
        break;
    }
  });

  // If no specific corrections, try common fixes based on function name
  if (!changesMade && attempt === 1) {
    // Fix common parameter mismatches
    if (corrected.parameters) {
      Object.keys(corrected.parameters).forEach(param => {
        const correctedName = PARAMETER_CORRECTIONS[param];
        if (correctedName) {
          log(`         → Renaming common mismatch: ${param} → ${correctedName}`, 'yellow');
          corrected.parameters[correctedName] = corrected.parameters[param];
          delete corrected.parameters[param];
          changesMade = true;
        }
      });
    }
  }

  return { corrected, changesMade };
}

/**
 * Build URL for testing
 */
function buildTestUrl(endpoint) {
  let url = API_BASE_URL;
  let endpointPath = endpoint.endpoint;
  
  // Strip prefixes
  if (endpointPath.startsWith('/api/v1/')) {
    endpointPath = endpointPath.substring(7);
  } else if (endpointPath.startsWith('/api/')) {
    endpointPath = endpointPath.substring(4);
  }
  
  if (!endpointPath.startsWith('/')) {
    endpointPath = '/' + endpointPath;
  }

  url = API_BASE_URL.replace(/\/$/, '') + endpointPath;

  // Replace path parameters
  url = url.replace(/{PatNum}/g, TEST_DATA.existingPatNum);
  url = url.replace(/{AptNum}/g, TEST_DATA.existingAptNum);
  url = url.replace(/{AppointmentId}/g, TEST_DATA.existingAptNum);
  url = url.replace(/{patient_id}/g, TEST_DATA.existingPatNum);
  url = url.replace(/{id}/g, TEST_DATA.existingPatNum);

  return url;
}

/**
 * Test endpoint with current definition
 */
async function testEndpoint(endpoint) {
  const method = endpoint.method;
  const url = buildTestUrl(endpoint);

  // Skip write operations (POST, PUT, DELETE) - mark as skipped
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    return {
      status: 'skipped_write',
      reason: 'Write operation - validation skipped to prevent data changes',
      url,
      method,
    };
  }

  const options = {
    method,
    headers: {
      'Authorization': API_KEY,
      'Content-Type': 'application/json',
    },
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    return {
      status: response.ok ? 'success' : 'failed',
      status_code: response.status,
      url,
      method,
      response_data: response.ok ? data : null,
      error_details: response.ok ? null : data,
    };
  } catch (error) {
    return {
      status: 'error',
      url,
      method,
      error_details: error.message,
    };
  }
}

/**
 * Auto-correct a single endpoint with iteration
 */
async function autoCorrectEndpoint(originalEndpoint) {
  const functionName = originalEndpoint.function_name;
  let currentEndpoint = JSON.parse(JSON.stringify(originalEndpoint));
  const correctionHistory = [];

  log(`\n   🔍 Testing: ${functionName}`, 'cyan');

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Test current definition
    const result = await testEndpoint(currentEndpoint);

    if (result.status === 'success') {
      log(`      ✅ SUCCESS on attempt ${attempt}`, 'green');
      return {
        success: true,
        endpoint: currentEndpoint,
        attempts: attempt,
        history: correctionHistory,
        final_result: result,
      };
    }

    if (result.status === 'skipped_write') {
      log(`      ⏭️  SKIPPED (write operation)`, 'yellow');
      return {
        success: false,
        skipped: true,
        endpoint: currentEndpoint,
        reason: result.reason,
      };
    }

    // Log failure
    log(`      ❌ Attempt ${attempt} failed: ${result.status_code || result.status}`, 'red');
    if (result.error_details) {
      log(`         Error: ${JSON.stringify(result.error_details).substring(0, 100)}`, 'red');
    }

    // Analyze error and apply corrections
    const errorAnalysis = parseErrorMessage(result.error_details);
    correctionHistory.push({
      attempt,
      error: result.error_details,
      analysis: errorAnalysis,
    });

    if (attempt < MAX_ATTEMPTS) {
      const { corrected, changesMade } = applyCorrections(currentEndpoint, errorAnalysis, attempt);
      
      if (changesMade) {
        currentEndpoint = corrected;
        await new Promise(resolve => setTimeout(resolve, 300)); // Rate limiting
      } else {
        log(`      ⚠️  No corrections available, stopping`, 'yellow');
        break;
      }
    }
  }

  // All attempts failed
  log(`      ❌ FAILED after ${MAX_ATTEMPTS} attempts`, 'red');
  return {
    success: false,
    endpoint: currentEndpoint,
    attempts: MAX_ATTEMPTS,
    history: correctionHistory,
  };
}

/**
 * Process all endpoints with auto-correction
 */
async function processAllEndpoints(endpoints, priorityOnly = true) {
  log('\n🤖 Starting auto-correction process...', 'cyan');
  
  const PRIORITY_FUNCTIONS = [
    'GetPatients', 'GetPatient', 'CreatePatient', 'UpdatePatient',
    'GetAppointments', 'GetAppointmentById', 'GetAvailableSlots',
    'CreateAppointment', 'UpdateAppointment', 'BreakAppointment',
    'DeleteAppointment', 'GetProviders', 'GetProvider',
    'GetInsuranceForPatient', 'GetPatientBalances',
  ];

  const toProcess = priorityOnly
    ? endpoints.filter(ep => PRIORITY_FUNCTIONS.includes(ep.function_name))
    : endpoints;

  log(`   Processing ${toProcess.length} endpoints...`, 'blue');

  const results = [];

  for (const endpoint of toProcess) {
    const result = await autoCorrectEndpoint(endpoint);
    results.push({
      function_name: endpoint.function_name,
      original_endpoint: endpoint,
      ...result,
    });

    // Rate limiting between endpoints
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Generate corrected registry
 */
function generateCorrectedRegistry(originalEndpoints, correctionResults) {
  log('\n📝 Generating corrected registry...', 'cyan');

  const correctedEndpoints = originalEndpoints.map(original => {
    const correction = correctionResults.find(r => r.function_name === original.function_name);
    
    if (!correction) {
      return {
        ...original,
        validation_status: 'untested',
      };
    }

    if (correction.skipped) {
      return {
        ...original,
        validation_status: 'skipped_write',
        note: correction.reason,
      };
    }

    if (correction.success) {
      return {
        ...correction.endpoint,
        validation_status: 'validated',
        auto_corrected: correction.attempts > 1,
        correction_attempts: correction.attempts,
      };
    }

    return {
      ...original,
      validation_status: 'failed',
      attempted_corrections: correction.attempts,
      correction_history: correction.history,
    };
  });

  // Remove duplicates (keep first validated or first occurrence)
  const seen = new Map();
  const noDuplicates = correctedEndpoints.filter(ep => {
    if (!seen.has(ep.function_name)) {
      seen.set(ep.function_name, ep);
      return true;
    }
    
    const existing = seen.get(ep.function_name);
    if (ep.validation_status === 'validated' && existing.validation_status !== 'validated') {
      seen.set(ep.function_name, ep);
      return false; // Will replace existing
    }
    
    return false;
  });

  // Get unique validated endpoints
  const unique = Array.from(seen.values());

  const registry = {
    generated_at: new Date().toISOString(),
    auto_corrected: true,
    total_endpoints: unique.length,
    validated_count: unique.filter(ep => ep.validation_status === 'validated').length,
    failed_count: unique.filter(ep => ep.validation_status === 'failed').length,
    skipped_count: unique.filter(ep => ep.validation_status === 'skipped_write').length,
    untested_count: unique.filter(ep => ep.validation_status === 'untested').length,
    endpoints: unique,
  };

  if (!DRY_RUN) {
    fs.writeFileSync(CORRECTED_REGISTRY_PATH, JSON.stringify(registry, null, 2));
    log(`✅ Corrected registry saved to: ${CORRECTED_REGISTRY_PATH}`, 'green');
  } else {
    log(`ℹ️  DRY RUN: Registry not saved`, 'blue');
  }

  return registry;
}

/**
 * Save correction log
 */
function saveCorrectionLog(correctionResults) {
  const log_data = {
    generated_at: new Date().toISOString(),
    total_processed: correctionResults.length,
    successful: correctionResults.filter(r => r.success).length,
    failed: correctionResults.filter(r => !r.success && !r.skipped).length,
    skipped: correctionResults.filter(r => r.skipped).length,
    corrections: correctionResults,
  };

  if (!DRY_RUN) {
    fs.writeFileSync(CORRECTION_LOG_PATH, JSON.stringify(log_data, null, 2));
    log(`✅ Correction log saved to: ${CORRECTION_LOG_PATH}`, 'green');
  }
}

/**
 * Print summary
 */
function printSummary(registry, correctionResults) {
  log('\n' + '='.repeat(60), 'cyan');
  log('🤖 AUTO-CORRECTION SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const successful = correctionResults.filter(r => r.success).length;
  const failed = correctionResults.filter(r => !r.success && !r.skipped).length;
  const skipped = correctionResults.filter(r => r.skipped).length;
  const autoCorrected = correctionResults.filter(r => r.success && r.attempts > 1).length;

  log(`\n✅ Validated: ${successful}`, 'green');
  log(`❌ Failed: ${failed}`, 'red');
  log(`⏭️  Skipped: ${skipped}`, 'yellow');
  log(`🔧 Auto-corrected: ${autoCorrected}`, 'magenta');
  
  if (autoCorrected > 0) {
    log(`\n🎉 Successfully fixed ${autoCorrected} endpoints automatically!`, 'green');
  }

  log('\n' + '='.repeat(60), 'cyan');
}

/**
 * Main execution
 */
async function main() {
  log('\n🤖 Self-Correcting API Registry Validator', 'cyan');
  log('='.repeat(60), 'cyan');

  if (DRY_RUN) {
    log('\n⚠️  DRY RUN MODE - No files will be saved', 'yellow');
  }

  if (!API_KEY) {
    log('\n❌ ERROR: OPENDENTAL_API_KEY not set', 'red');
    process.exit(1);
  }

  try {
    // Load registry
    const registryData = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    log(`\n📖 Loaded ${registryData.endpoints.length} endpoints`, 'green');

    // Process with auto-correction
    const correctionResults = await processAllEndpoints(registryData.endpoints, true);

    // Generate corrected registry
    const correctedRegistry = generateCorrectedRegistry(registryData.endpoints, correctionResults);

    // Save correction log
    saveCorrectionLog(correctionResults);

    // Print summary
    printSummary(correctedRegistry, correctionResults);

    log('\n✅ Auto-correction complete!', 'green');
    if (!DRY_RUN) {
      log(`   Check ${OUTPUT_DIR} for results\n`, 'blue');
    }

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run
main();





























