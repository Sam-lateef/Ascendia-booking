/**
 * Parse OpenDental database schema (output.json) and generate enhanced_schema.json
 * with foreign key relationships, enums, and workflow rules
 */

const fs = require('fs');
const path = require('path');

// Core tables we care about for API operations
const CORE_TABLES = [
  'patient',
  'appointment',
  'provider',
  'operatory',
  'clinic',
  'insplan',
  'patplan',
  'claim',
  'procedurelog',
  'procedurecode',
  'definition',
  'payment',
  'adjustment',
  'recall',
  'schedule',
  'employee',
  'userod',
  'claimproc',
  'claimtracking',
  'benefit'
];

// API functions that need FK validation
const CRITICAL_FUNCTIONS = {
  'CreateAppointment': {
    table: 'appointment',
    required_fks: ['PatNum', 'AptDateTime'],
    optional_fks: ['ProvNum', 'Op'],
    avoid_fks: ['ClinicNum'] // Known to cause issues
  },
  'UpdateAppointment': {
    table: 'appointment',
    required_fks: ['AptNum'],
    optional_fks: ['PatNum', 'ProvNum', 'Op']
  },
  'CreatePatient': {
    table: 'patient',
    required_fks: ['FName', 'LName'],
    optional_fks: ['Birthdate', 'WirelessPhone']
  },
  'UpdatePatient': {
    table: 'patient',
    required_fks: ['PatNum'],
    optional_fks: ['FName', 'LName', 'WirelessPhone']
  },
  'CreateClaim': {
    table: 'claim',
    required_fks: ['PatNum', 'ProvNum'],
    optional_fks: ['ClinicNum']
  },
  'CreatePayment': {
    table: 'payment',
    required_fks: ['PatNum'],
    optional_fks: ['ProvNum', 'ClinicNum']
  },
  'CreateProcedure': {
    table: 'procedurelog',
    required_fks: ['PatNum', 'CodeNum'],
    optional_fks: ['ProvNum', 'ClinicNum']
  }
};

function parseSchema(inputPath) {
  console.log('Reading schema file...');
  const rawData = fs.readFileSync(inputPath, 'utf8');
  const tables = JSON.parse(rawData);
  
  console.log(`Found ${tables.length} tables`);
  
  const enhancedSchema = {
    metadata: {
      generated_from: 'output.json',
      generated_at: new Date().toISOString(),
      total_tables: tables.length,
      core_tables: CORE_TABLES.length,
      mapped_functions: Object.keys(CRITICAL_FUNCTIONS).length
    },
    tables: {},
    foreign_key_mappings: {},
    enum_values: {},
    workflow_rules: {},
    natural_language_guide: []
  };
  
  // Extract core table information
  for (const table of tables) {
    if (!CORE_TABLES.includes(table.name)) continue;
    
    const tableInfo = {
      name: table.name,
      summary: table.summary,
      primary_key: null,
      foreign_keys: [],
      enums: [],
      required_fields: [],
      optional_fields: []
    };
    
    for (const column of table.columns) {
      // Find primary key
      if (column.summary && column.summary.toLowerCase().includes('primary key')) {
        tableInfo.primary_key = {
          name: column.name,
          type: column.type
        };
      }
      
      // Find foreign keys
      if (column.summary && column.summary.includes('FK to')) {
        const fkMatch = column.summary.match(/FK to (\w+)\.(\w+)/);
        if (fkMatch) {
          tableInfo.foreign_keys.push({
            column: column.name,
            references_table: fkMatch[1],
            references_column: fkMatch[2],
            type: column.type
          });
        }
      }
      
      // Find enums
      if (column.summary && column.summary.includes('Enum:')) {
        const enumMatch = column.summary.match(/Enum:(\w+)\s+(.+)/);
        if (enumMatch) {
          const values = enumMatch[2].split(/[,\s]+/).filter(v => v.length > 0);
          tableInfo.enums.push({
            column: column.name,
            enum_name: enumMatch[1],
            values: values
          });
        }
      }
      
      // Categorize fields (basic heuristic)
      const isRequired = column.type.includes('NOT NULL') || 
                        column.summary?.toLowerCase().includes('required');
      
      if (isRequired) {
        tableInfo.required_fields.push(column.name);
      } else {
        tableInfo.optional_fields.push(column.name);
      }
    }
    
    enhancedSchema.tables[table.name] = tableInfo;
  }
  
  // Build FK mappings for critical functions
  for (const [functionName, config] of Object.entries(CRITICAL_FUNCTIONS)) {
    const tableInfo = enhancedSchema.tables[config.table];
    if (!tableInfo) continue;
    
    enhancedSchema.foreign_key_mappings[functionName] = {
      target_table: config.table,
      required_foreign_keys: {},
      optional_foreign_keys: {},
      avoid_fields: config.avoid_fks || []
    };
    
    // Map required FKs
    for (const fkField of config.required_fks) {
      const fkInfo = tableInfo.foreign_keys.find(fk => fk.column === fkField);
      
      if (fkInfo) {
        enhancedSchema.foreign_key_mappings[functionName].required_foreign_keys[fkField] = {
          references: `${fkInfo.references_table}.${fkInfo.references_column}`,
          lookup_functions: getLookupFunctions(fkInfo.references_table),
          error_message: `${fkField} is required but missing`,
          ask_user_prompt: getPromptForField(fkField, fkInfo.references_table)
        };
      } else if (fkField === 'AptDateTime' || fkField.includes('Date')) {
        // Special handling for date fields
        enhancedSchema.foreign_key_mappings[functionName].required_foreign_keys[fkField] = {
          type: 'datetime',
          format: fkField.includes('DateTime') ? 'YYYY-MM-DD HH:MM:SS' : 'YYYY-MM-DD',
          ask_user_prompt: getPromptForField(fkField, null)
        };
      }
    }
    
    // Map optional FKs
    for (const fkField of config.optional_fks) {
      const fkInfo = tableInfo.foreign_keys.find(fk => fk.column === fkField);
      
      if (fkInfo) {
        enhancedSchema.foreign_key_mappings[functionName].optional_foreign_keys[fkField] = {
          references: `${fkInfo.references_table}.${fkInfo.references_column}`,
          lookup_functions: getLookupFunctions(fkInfo.references_table),
          default_value: getDefaultValue(fkField),
          use_default_if_missing: true
        };
      }
    }
  }
  
  // Extract enum values for common fields
  for (const [tableName, tableInfo] of Object.entries(enhancedSchema.tables)) {
    for (const enumInfo of tableInfo.enums) {
      const key = `${tableName}.${enumInfo.column}`;
      enhancedSchema.enum_values[key] = {
        enum_name: enumInfo.enum_name,
        values: enumInfo.values
      };
    }
  }
  
  // Generate natural language guide
  enhancedSchema.natural_language_guide = generateNaturalLanguageRules(enhancedSchema);
  
  return enhancedSchema;
}

function getLookupFunctions(tableName) {
  const lookupMap = {
    'patient': ['GetMultiplePatients', 'GetPatients'],
    'provider': ['GetProviders', 'GetMultipleProviders'],
    'operatory': ['GetOperatories'],
    'clinic': ['GetClinics'],
    'appointment': ['GetAppointments', 'GetAppointmentById'],
    'procedurecode': ['GetProcedureCodes', 'GetProcedureCode'],
    'insplan': ['GetInsurancePlans', 'GetInsurancePlan']
  };
  
  return lookupMap[tableName] || [`Get${capitalize(tableName)}s`];
}

function getPromptForField(fieldName, referencedTable) {
  const prompts = {
    'PatNum': 'Who is the patient? (provide name or phone number)',
    'ProvNum': 'Which provider/doctor?',
    'AptDateTime': 'When would you like to schedule this appointment?',
    'Op': 'Which operatory/room?',
    'AptNum': 'Which appointment?',
    'CodeNum': 'What procedure code?'
  };
  
  return prompts[fieldName] || `Please provide ${fieldName}`;
}

function getDefaultValue(fieldName) {
  const defaults = {
    'ProvNum': 1,
    'Op': 1,
    'ClinicNum': 0
  };
  
  return defaults[fieldName] || null;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateNaturalLanguageRules(schema) {
  const rules = [
    "# DATABASE RELATIONSHIP RULES",
    "",
    "## Core Principle: Lookup Foreign Keys Before Create/Update",
    "",
    "### Patient Operations (PatNum)",
    "- PatNum is THE MOST IMPORTANT foreign key - required for appointments, claims, payments, procedures",
    "- ALWAYS get PatNum first by calling GetMultiplePatients with search criteria:",
    "  * Search by Phone if user provides phone number",
    "  * Search by LName + FName if user provides name",
    "  * If not found, ASK: 'I couldn't find that patient. Can you spell their full name or provide their phone number?'",
    "  * If still not found, ASK: 'Would you like me to create a new patient record?'",
    "",
    "### Appointment Operations",
    "CreateAppointment workflow:",
    "1. Get PatNum (REQUIRED):",
    "   - Try GetMultiplePatients with available info",
    "   - If not found, STOP and ASK user for patient details",
    "2. Get AptDateTime (REQUIRED):",
    "   - If user said specific time, use it",
    "   - If user said 'tomorrow', calculate tomorrow's date + reasonable time (2PM)",
    "   - If user said 'next week', pick Monday + 10AM",
    "   - If no time specified, ASK: 'When would you like to schedule this?'",
    "3. Use defaults for optional fields:",
    "   - ProvNum = 1 (unless user specifies a provider)",
    "   - Op = 1 (unless user specifies room/operatory)",
    "4. NEVER send ClinicNum - it causes errors in test environments",
    "",
    "UpdateAppointment workflow:",
    "1. Get AptNum (REQUIRED):",
    "   - Call GetAppointments(PatNum, Date) to find appointment",
    "   - If multiple found, ASK: 'Which appointment?' (describe times)",
    "   - If none found, ASK: 'I couldn't find an appointment. Do you want to create one?'",
    "",
    "### Provider Operations (ProvNum)",
    "- Default ProvNum=1 is acceptable for most operations",
    "- Only lookup provider if user explicitly mentions doctor name: 'with Dr. Smith'",
    "- If user mentions doctor, call GetProviders or GetMultipleProviders",
    "",
    "### Insurance/Claim Operations",
    "CreateClaim workflow:",
    "1. Get PatNum (REQUIRED) - from GetMultiplePatients",
    "2. Check insurance:",
    "   - Call GetInsuranceForPatient(PatNum)",
    "   - If no insurance, ASK: 'Does this patient have insurance on file?'",
    "3. Get ProvNum (REQUIRED) - default=1 or lookup",
    "",
    "### Error Recovery Strategy",
    "When you encounter an error:",
    "1. Check if it mentions missing FK (e.g., 'PatNum is required')",
    "2. If FK is missing, try automatic lookup ONCE",
    "3. If lookup fails, STOP and ASK user clearly",
    "4. DO NOT retry the same failed call multiple times",
    "5. DO NOT guess or use 0 for foreign keys",
    "",
    "### Field Validation",
    "- Phone numbers: Auto-cleaned to 10 digits (remove formatting)",
    "- Dates: Must be YYYY-MM-DD format",
    "- DateTimes: Must be YYYY-MM-DD HH:MM:SS format",
    "- Future appointments: AptDateTime must be today or future",
    "- Past appointments: Only for lookups, not creation",
    "",
    "### Common Enum Values"
  ];
  
  // Add enum values
  for (const [key, enumInfo] of Object.entries(schema.enum_values)) {
    if (key.includes('AptStatus') || key.includes('PatStatus')) {
      rules.push(`- ${key}: Valid values are [${enumInfo.values.join(', ')}]`);
    }
  }
  
  return rules.join('\n');
}

// Main execution
const inputPath = 'c:\\Users\\samla\\Downloads\\output.json';
const outputPath = path.resolve(__dirname, '../docs/API/enhanced_schema.json');

console.log('Parsing OpenDental schema...');
console.log('Input:', inputPath);
console.log('Output:', outputPath);

try {
  const enhancedSchema = parseSchema(inputPath);
  
  // Write output
  fs.writeFileSync(
    outputPath,
    JSON.stringify(enhancedSchema, null, 2),
    'utf8'
  );
  
  console.log('\n✅ Successfully generated enhanced_schema.json');
  console.log(`   Core tables: ${Object.keys(enhancedSchema.tables).length}`);
  console.log(`   FK mappings: ${Object.keys(enhancedSchema.foreign_key_mappings).length}`);
  console.log(`   Enum values: ${Object.keys(enhancedSchema.enum_values).length}`);
  console.log(`   Rules: ${enhancedSchema.natural_language_guide.split('\n').length} lines`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

