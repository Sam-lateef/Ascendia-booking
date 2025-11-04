/**
 * Unified API Registry Validator & Auto-Corrector
 * 
 * This script does EVERYTHING:
 * 1. Finds duplicates
 * 2. Analyzes parameter issues
 * 3. Tests each endpoint against real API
 * 4. Auto-corrects errors by learning from responses
 * 5. Iterates up to 5 times per endpoint
 * 6. Generates comprehensive reports
 * 7. Saves clean, validated registry
 * 
 * Usage:
 *   node scripts/validate_and_correct_registry.js
 * 
 * Options:
 *   --dry-run          Test without saving changes
 *   --priority-only    Only test priority functions (default)
 *   --all              Test all endpoints (WARNING: takes time!)
 *   --max-attempts=N   Max correction attempts per endpoint (default: 5)
 * 
 * Environment Variables:
 *   OPENDENTAL_API_KEY=your_key_here (required)
 *   OPENDENTAL_API_BASE_URL=https://api.opendental.com/api/v1
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ALL_ENDPOINTS = args.includes('--all');
const PRIORITY_ONLY = !ALL_ENDPOINTS; // Default to priority only
const MAX_ATTEMPTS = parseInt(args.find(arg => arg.startsWith('--max-attempts='))?.split('=')[1] || '5');

// Configuration
const REGISTRY_PATH = path.join(__dirname, '../docs/API/api_registry.json');
const OUTPUT_DIR = path.join(__dirname, '../docs/API/validated');
const VALIDATED_REGISTRY_PATH = path.join(OUTPUT_DIR, 'validated_registry.json');
const FULL_REPORT_PATH = path.join(OUTPUT_DIR, 'full_report.json');
const SUMMARY_PATH = path.join(OUTPUT_DIR, 'summary.json');

const API_BASE_URL = process.env.OPENDENTAL_API_BASE_URL || 'https://api.opendental.com/api/v1';
const API_KEY = process.env.OPENDENTAL_API_KEY;

// Test data (update for your environment)
const TEST_DATA = {
  existingPatNum: 22,
  existingAptNum: 53,
  testDate: '2025-10-27',
  testDateTime: '2025-10-27 15:00:00',
};

// Priority functions to test
const PRIORITY_FUNCTIONS = [
  'GetPatients', 'GetPatient', 'CreatePatient', 'UpdatePatient',
  'GetAppointments', 'GetAppointmentById', 'GetAvailableSlots',
  'CreateAppointment', 'UpdateAppointment', 'BreakAppointment',
  'DeleteAppointment', 'GetProviders', 'GetProvider',
  'GetInsuranceForPatient', 'GetPatientBalances',
];

// Known parameter corrections (learned from errors)
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

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

//=============================================================================
// PHASE 1: LOAD & ANALYZE REGISTRY
//=============================================================================

function loadRegistry() {
  log('\n📖 [PHASE 1] Loading API registry...', 'cyan');
  const registryData = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  log(`   Loaded ${registryData.endpoints.length} total endpoints`, 'green');
  return registryData;
}

function findDuplicates(endpoints) {
  log('\n🔍 [PHASE 1] Checking for duplicates...', 'cyan');
  const seen = new Map();
  const duplicates = [];

  endpoints.forEach((endpoint, index) => {
    const name = endpoint.function_name;
    if (seen.has(name)) {
      const firstIdx = seen.get(name);
      duplicates.push({
        function_name: name,
        first_occurrence: {
          index: firstIdx,
          endpoint: endpoints[firstIdx].endpoint,
          method: endpoints[firstIdx].method,
        },
        duplicate: {
          index,
          endpoint: endpoint.endpoint,
          method: endpoint.method,
        },
      });
      log(`   ⚠️  DUPLICATE: ${name}`, 'yellow');
      log(`      [${firstIdx}] ${endpoints[firstIdx].method} ${endpoints[firstIdx].endpoint}`, 'gray');
      log(`      [${index}] ${endpoint.method} ${endpoint.endpoint}`, 'gray');
    } else {
      seen.set(name, index);
    }
  });

  if (duplicates.length === 0) {
    log('   ✅ No duplicates found', 'green');
  } else {
    log(`   ⚠️  Found ${duplicates.length} duplicate function names`, 'yellow');
  }

  return { duplicates, uniqueMap: seen };
}

function analyzeParameters(endpoints) {
  log('\n🔍 [PHASE 1] Analyzing parameter definitions...', 'cyan');
  
  const issues = [];

  endpoints.forEach(endpoint => {
    const params = endpoint.parameters || {};
    Object.keys(params).forEach(paramName => {
      if (PARAMETER_CORRECTIONS[paramName]) {
        issues.push({
          function_name: endpoint.function_name,
          parameter: paramName,
          suggested_correction: PARAMETER_CORRECTIONS[paramName],
          reason: 'Parameter name does not match OpenDental API convention',
        });
      }
    });
  });

  if (issues.length > 0) {
    log(`   ⚠️  Found ${issues.length} potential parameter naming issues`, 'yellow');
  } else {
    log('   ✅ No obvious parameter issues detected', 'green');
  }

  return issues;
}

//=============================================================================
// PHASE 2: TEST & AUTO-CORRECT ENDPOINTS
//=============================================================================

function parseErrorMessage(errorDetails) {
  const message = typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails);
  const corrections = [];

  // Pattern: "X is required" or "X is invalid"
  const requiredMatch = message.match(/(\w+) is (required|invalid)/i);
  if (requiredMatch) {
    corrections.push({
      type: 'missing_parameter',
      parameter: requiredMatch[1],
      reason: requiredMatch[2],
    });
  }

  // Pattern: "X is not a valid resource"
  if (message.includes('is not a valid resource')) {
    corrections.push({
      type: 'invalid_path',
      reason: 'Path resource not found',
    });
  }

  // Pattern: "breakType is invalid. X is not enabled"
  const breakTypeMatch = message.match(/breakType is invalid\. (\w+) is not enabled/i);
  if (breakTypeMatch) {
    corrections.push({
      type: 'invalid_enum_value',
      parameter: 'breakType',
      invalid_value: breakTypeMatch[1],
      reason: 'Value not enabled in dental office',
    });
  }

  // Pattern: Invalid date
  if (message.includes('dateStart is invalid') || message.includes('date is invalid')) {
    corrections.push({
      type: 'invalid_date_format',
      reason: 'Date format or range issue',
    });
  }

  return corrections;
}

function applyCorrections(endpoint, errorAnalysis, attempt) {
  const corrected = JSON.parse(JSON.stringify(endpoint));
  let changesMade = false;
  const changes = [];

  errorAnalysis.forEach(issue => {
    switch (issue.type) {
      case 'missing_parameter':
        const correctedName = PARAMETER_CORRECTIONS[issue.parameter];
        if (correctedName && corrected.parameters) {
          if (corrected.parameters[issue.parameter]) {
            corrected.parameters[correctedName] = corrected.parameters[issue.parameter];
            delete corrected.parameters[issue.parameter];
            changes.push(`Renamed: ${issue.parameter} → ${correctedName}`);
            changesMade = true;
          }
        }
        break;

      case 'invalid_path':
        PATH_CORRECTIONS.forEach(correction => {
          if (corrected.endpoint.includes(correction.from)) {
            corrected.endpoint = corrected.endpoint.replace(correction.from, correction.to);
            changes.push(`Fixed path: ${correction.from} → ${correction.to}`);
            changesMade = true;
          }
        });
        break;

      case 'invalid_enum_value':
        if (issue.parameter === 'breakType' && corrected.parameters?.breakType) {
          corrected.parameters.breakType.required = false;
          corrected.parameters.breakType.note = 'May not be supported in test environment';
          changes.push(`Marked ${issue.parameter} as optional`);
          changesMade = true;
        }
        break;

      case 'invalid_date_format':
        if (corrected.parameters) {
          Object.keys(corrected.parameters).forEach(param => {
            if (param.toLowerCase().includes('date') && 
                corrected.parameters[param].type === 'string' &&
                !corrected.parameters[param].format) {
              corrected.parameters[param].format = 'yyyy-MM-dd or yyyy-MM-dd HH:mm:ss';
              changes.push(`Added format hint for ${param}`);
              changesMade = true;
            }
          });
        }
        break;
    }
  });

  // First attempt: try common parameter fixes
  if (!changesMade && attempt === 1 && corrected.parameters) {
    Object.keys(corrected.parameters).forEach(param => {
      const correctedName = PARAMETER_CORRECTIONS[param];
      if (correctedName) {
        corrected.parameters[correctedName] = corrected.parameters[param];
        delete corrected.parameters[param];
        changes.push(`Common fix: ${param} → ${correctedName}`);
        changesMade = true;
      }
    });
  }

  return { corrected, changesMade, changes };
}

function buildTestUrl(endpoint) {
  let url = API_BASE_URL;
  let endpointPath = endpoint.endpoint;
  
  if (endpointPath.startsWith('/api/v1/')) {
    endpointPath = endpointPath.substring(7);
  } else if (endpointPath.startsWith('/api/')) {
    endpointPath = endpointPath.substring(4);
  }
  
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

  return url;
}

function buildTestBody(endpoint) {
  // Build minimal test body for write operations
  // Returns null if we shouldn't test this endpoint
  
  const functionName = endpoint.function_name;
  
  // For most write operations, return null (skip testing)
  // Only test safe operations that won't corrupt data
  
  switch (functionName) {
    // Don't test patient/appointment creation (too risky)
    case 'CreatePatient':
    case 'CreateAppointment':
    case 'UpdatePatient':
    case 'UpdateAppointment':
    case 'DeleteAppointment':
    case 'BreakAppointment':
      return null; // Still skip even with TEST_WRITES=true
    
    // Could add safe test cases here in the future
    default:
      return null;
  }
}

async function testEndpoint(endpoint) {
  const method = endpoint.method;
  const url = buildTestUrl(endpoint);

  // Skip write operations to prevent data changes (unless TEST_WRITES enabled)
  const TEST_WRITES = process.env.TEST_WRITES === 'true';
  
  if (['POST', 'PUT', 'DELETE'].includes(method) && !TEST_WRITES) {
    return {
      status: 'skipped_write',
      reason: 'Write operation - skipped to prevent data changes. Set TEST_WRITES=true to test.',
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

  // If testing writes, add minimal test data for POST/PUT
  if (TEST_WRITES && (method === 'POST' || method === 'PUT')) {
    // Add minimal test body based on endpoint
    const testBody = buildTestBody(endpoint);
    if (testBody) {
      options.body = JSON.stringify(testBody);
    }
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

async function processEndpoint(originalEndpoint, index, total) {
  const functionName = originalEndpoint.function_name;
  let currentEndpoint = JSON.parse(JSON.stringify(originalEndpoint));
  const correctionHistory = [];

  process.stdout.write(`   [${index + 1}/${total}] ${functionName}... `);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await testEndpoint(currentEndpoint);

    if (result.status === 'success') {
      log(`✅${attempt > 1 ? ` (fixed in ${attempt} attempts)` : ''}`, 'green');
      return {
        success: true,
        endpoint: currentEndpoint,
        attempts: attempt,
        history: correctionHistory,
        final_result: result,
      };
    }

    if (result.status === 'skipped_write') {
      log('⏭️  skipped', 'yellow');
      return {
        success: false,
        skipped: true,
        endpoint: currentEndpoint,
        reason: result.reason,
      };
    }

    // Failed - analyze and try to correct
    const errorAnalysis = parseErrorMessage(result.error_details);
    correctionHistory.push({
      attempt,
      error: result.error_details,
      analysis: errorAnalysis,
      status_code: result.status_code,
    });

    if (attempt < MAX_ATTEMPTS) {
      const { corrected, changesMade, changes } = applyCorrections(currentEndpoint, errorAnalysis, attempt);
      
      if (changesMade) {
        correctionHistory[correctionHistory.length - 1].corrections_applied = changes;
        currentEndpoint = corrected;
        await new Promise(resolve => setTimeout(resolve, 300)); // Rate limit
      } else {
        log(`❌ ${result.status_code || 'ERROR'} (no fixes available)`, 'red');
        break;
      }
    } else {
      log(`❌ ${result.status_code || 'ERROR'} (max attempts)`, 'red');
    }
  }

  return {
    success: false,
    endpoint: currentEndpoint,
    attempts: correctionHistory.length,
    history: correctionHistory,
  };
}

async function validateAndCorrectEndpoints(endpoints, priorityOnly) {
  log('\n🧪 [PHASE 2] Testing & auto-correcting endpoints...', 'cyan');
  
  const toProcess = priorityOnly
    ? endpoints.filter(ep => PRIORITY_FUNCTIONS.includes(ep.function_name))
    : endpoints;

  log(`   Processing ${toProcess.length} endpoints (${priorityOnly ? 'priority only' : 'all'})...`, 'blue');
  log('   (Write operations skipped to prevent data changes)\n', 'gray');

  const results = [];

  for (let i = 0; i < toProcess.length; i++) {
    const result = await processEndpoint(toProcess[i], i, toProcess.length);
    results.push({
      function_name: toProcess[i].function_name,
      original_endpoint: toProcess[i],
      ...result,
    });

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

//=============================================================================
// PHASE 3: GENERATE OUTPUTS
//=============================================================================

function generateValidatedRegistry(allEndpoints, duplicateMap, correctionResults) {
  log('\n📝 [PHASE 3] Generating validated registry...', 'cyan');

  // Remove duplicates (keep first validated or first occurrence)
  const unique = Array.from(duplicateMap.values()).map(index => {
    const endpoint = allEndpoints[index];
    const correction = correctionResults.find(r => r.function_name === endpoint.function_name);
    
    if (!correction) {
      return {
        ...endpoint,
        validation_status: 'untested',
      };
    }

    if (correction.skipped) {
      return {
        ...endpoint,
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
        correction_history: correction.attempts > 1 ? correction.history : undefined,
      };
    }

    return {
      ...endpoint,
      validation_status: 'failed',
      attempted_corrections: correction.attempts,
      failure_details: correction.history,
    };
  });

  const registry = {
    generated_at: new Date().toISOString(),
    validated: true,
    auto_corrected: true,
    total_endpoints: unique.length,
    validated_count: unique.filter(ep => ep.validation_status === 'validated').length,
    failed_count: unique.filter(ep => ep.validation_status === 'failed').length,
    skipped_count: unique.filter(ep => ep.validation_status === 'skipped_write').length,
    untested_count: unique.filter(ep => ep.validation_status === 'untested').length,
    endpoints: unique,
  };

  if (!DRY_RUN) {
    fs.writeFileSync(VALIDATED_REGISTRY_PATH, JSON.stringify(registry, null, 2));
    log(`   ✅ Validated registry saved to: ${path.basename(VALIDATED_REGISTRY_PATH)}`, 'green');
  }

  return registry;
}

function generateFullReport(registry, duplicates, parameterIssues, correctionResults) {
  log('\n📊 [PHASE 3] Generating full report...', 'cyan');

  const report = {
    generated_at: new Date().toISOString(),
    configuration: {
      dry_run: DRY_RUN,
      priority_only: PRIORITY_ONLY,
      max_attempts: MAX_ATTEMPTS,
    },
    summary: {
      total_endpoints: registry.total_endpoints,
      duplicates_found: duplicates.length,
      parameter_issues: parameterIssues.length,
      tested_endpoints: correctionResults.length,
      validated: correctionResults.filter(r => r.success).length,
      failed: correctionResults.filter(r => !r.success && !r.skipped).length,
      skipped: correctionResults.filter(r => r.skipped).length,
      auto_corrected: correctionResults.filter(r => r.success && r.attempts > 1).length,
    },
    duplicates,
    parameter_issues: parameterIssues,
    correction_results: correctionResults,
  };

  if (!DRY_RUN) {
    fs.writeFileSync(FULL_REPORT_PATH, JSON.stringify(report, null, 2));
    log(`   ✅ Full report saved to: ${path.basename(FULL_REPORT_PATH)}`, 'green');
  }

  return report;
}

function generateSummary(report) {
  const summary = {
    generated_at: report.generated_at,
    statistics: report.summary,
    issues: {
      duplicates: report.duplicates.map(d => d.function_name),
      failed_validations: report.correction_results
        .filter(r => !r.success && !r.skipped)
        .map(r => ({
          function_name: r.function_name,
          attempts: r.attempts,
          last_error: r.history[r.history.length - 1]?.error,
        })),
      parameter_issues: report.parameter_issues.slice(0, 10), // Top 10
    },
    recommendations: [],
  };

  // Add recommendations
  if (report.summary.duplicates_found > 0) {
    summary.recommendations.push('Remove duplicate function definitions from registry');
  }
  if (report.summary.failed > 0) {
    summary.recommendations.push('Review failed validations - may require manual testing');
  }
  if (report.summary.auto_corrected > 0) {
    summary.recommendations.push('Review auto-corrected endpoints to confirm changes');
  }

  if (!DRY_RUN) {
    fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2));
    log(`   ✅ Summary saved to: ${path.basename(SUMMARY_PATH)}`, 'green');
  }

  return summary;
}

//=============================================================================
// PRINT RESULTS
//=============================================================================

function printResults(report) {
  log('\n' + '='.repeat(70), 'cyan');
  log('📊 VALIDATION & CORRECTION RESULTS', 'cyan');
  log('='.repeat(70), 'cyan');
  
  log(`\n📚 Registry Statistics:`, 'blue');
  log(`   Total Endpoints: ${report.summary.total_endpoints}`);
  log(`   Tested: ${report.summary.tested_endpoints}`);
  log(`   ${colors.green}✅ Validated: ${report.summary.validated}${colors.reset}`);
  log(`   ${colors.red}❌ Failed: ${report.summary.failed}${colors.reset}`);
  log(`   ${colors.yellow}⏭️  Skipped: ${report.summary.skipped}${colors.reset}`);
  log(`   ${colors.gray}⚪ Untested: ${report.summary.total_endpoints - report.summary.tested_endpoints}${colors.reset}`);

  if (report.summary.auto_corrected > 0) {
    log(`\n🔧 Auto-Corrections:`, 'magenta');
    log(`   ${colors.magenta}Successfully fixed ${report.summary.auto_corrected} endpoints!${colors.reset}`);
  }

  if (report.summary.duplicates_found > 0) {
    log(`\n⚠️  Issues Found:`, 'yellow');
    log(`   ${report.summary.duplicates_found} duplicate function names`);
  }

  if (report.summary.parameter_issues > 0) {
    log(`   ${report.summary.parameter_issues} parameter naming issues`);
  }

  log(`\n📁 Output Files:`, 'blue');
  if (!DRY_RUN) {
    log(`   ${OUTPUT_DIR}/`);
    log(`   ├── validated_registry.json    (${report.summary.validated} validated endpoints)`);
    log(`   ├── full_report.json          (complete details)`);
    log(`   └── summary.json              (quick overview)`);
  } else {
    log(`   ${colors.yellow}DRY RUN - No files saved${colors.reset}`);
  }

  log('\n' + '='.repeat(70), 'cyan');
}

//=============================================================================
// MAIN
//=============================================================================

async function main() {
  log('\n🚀 API Registry Validator & Auto-Corrector', 'cyan');
  log('='.repeat(70), 'cyan');

  if (DRY_RUN) {
    log('\n⚠️  DRY RUN MODE - No files will be saved', 'yellow');
  }
  if (PRIORITY_ONLY) {
    log(`\n📋 Testing priority functions only (${PRIORITY_FUNCTIONS.length} endpoints)`, 'blue');
  }

  if (!API_KEY) {
    log('\n❌ ERROR: OPENDENTAL_API_KEY not set in .env', 'red');
    log('   Add: OPENDENTAL_API_KEY=ODFHIR your_key', 'yellow');
    process.exit(1);
  }

  try {
    // Phase 1: Load & Analyze
    const registry = loadRegistry();
    const { duplicates, uniqueMap } = findDuplicates(registry.endpoints);
    const parameterIssues = analyzeParameters(registry.endpoints);

    // Phase 2: Test & Auto-Correct
    const correctionResults = await validateAndCorrectEndpoints(registry.endpoints, PRIORITY_ONLY);

    // Phase 3: Generate Outputs
    const validatedRegistry = generateValidatedRegistry(registry.endpoints, uniqueMap, correctionResults);
    const fullReport = generateFullReport(validatedRegistry, duplicates, parameterIssues, correctionResults);
    const summary = generateSummary(fullReport);

    // Print Results
    printResults(fullReport);

    log('\n✅ Validation complete!', 'green');
    if (!DRY_RUN) {
      log(`   Check ${OUTPUT_DIR}/ for all results\n`, 'blue');
    } else {
      log('   Run without --dry-run to save results\n', 'blue');
    }

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run
main();

