#!/usr/bin/env node

/**
 * Create Unified Registry
 * 
 * Merges:
 * 1. validated_registry.json (337 functions + parameters)
 * 2. enhanced_schema.json (FK relationships + natural language guide + enums + tables)
 * 3. sql_patterns.json (production SQL patterns)
 * 4. Default configuration values
 * 
 * Output: unified_registry.json (single source of truth)
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Creating unified registry...\n');

// Load source files
const validatedRegistryPath = path.join(__dirname, '../docs/API/validated/validated_registry.json');
const enhancedSchemaPath = path.join(__dirname, '../docs/API/enhanced_schema.json');
const sqlPatternsPath = path.join(__dirname, '../docs/API/sql_patterns.json');

console.log('📖 Loading source files...');
const validatedRegistry = JSON.parse(fs.readFileSync(validatedRegistryPath, 'utf8'));
const enhancedSchema = JSON.parse(fs.readFileSync(enhancedSchemaPath, 'utf8'));
const sqlPatterns = JSON.parse(fs.readFileSync(sqlPatternsPath, 'utf8'));

// Extract endpoints array (handle both formats)
const endpoints = validatedRegistry.endpoints || validatedRegistry;
console.log(`✓ Loaded ${endpoints.length} functions from validated_registry.json`);
console.log(`✓ Loaded ${Object.keys(enhancedSchema.tables || {}).length} tables from enhanced_schema.json`);
console.log(`✓ Loaded ${Object.keys(sqlPatterns.sql_patterns || {}).length} SQL patterns\n`);

// Enhance functions with FK mappings and SQL patterns
console.log('🔗 Enhancing functions with foreign key mappings...');
const enhancedFunctions = endpoints.map(func => {
  const fkMapping = enhancedSchema.foreign_key_mappings?.[func.function_name];
  const relatedSqlPatterns = [];
  
  // Find related SQL patterns
  Object.entries(sqlPatterns.sql_patterns || {}).forEach(([key, pattern]) => {
    if (pattern.api_function === func.function_name || 
        (pattern.api_functions && pattern.api_functions.includes(func.function_name))) {
      relatedSqlPatterns.push(key);
    }
  });
  
  return {
    ...func,
    ...(fkMapping && {
      foreign_key_mappings: {
        required: fkMapping.required_foreign_keys || {},
        optional: fkMapping.optional_foreign_keys || {},
        avoid_fields: fkMapping.avoid_fields || []
      }
    }),
    ...(relatedSqlPatterns.length > 0 && {
      related_sql_patterns: relatedSqlPatterns
    })
  };
});

console.log(`✓ Enhanced ${enhancedFunctions.length} functions with FK mappings\n`);

// Build unified registry
console.log('🏗️  Building unified registry structure...');
const unifiedRegistry = {
  metadata: {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    sources: [
      'validated_registry.json (337 functions with parameters)',
      'enhanced_schema.json (FK mappings, natural language guide, database schema)',
      'sql_patterns.json (production SQL patterns from shortQuery.txt)',
      'Default configuration values (ProvNum=1, Op=1, ClinicNum=null)'
    ],
    statistics: {
      total_functions: enhancedFunctions.length,
      functions_with_fk_mappings: enhancedFunctions.filter(f => f.foreign_key_mappings).length,
      functions_with_sql_patterns: enhancedFunctions.filter(f => f.related_sql_patterns).length,
      total_tables: Object.keys(enhancedSchema.tables || {}).length,
      total_sql_patterns: Object.keys(sqlPatterns.sql_patterns || {}).length,
      total_enum_values: Object.keys(enhancedSchema.enum_values || {}).length
    }
  },
  
  functions: enhancedFunctions,
  
  defaults: {
    provNum: 1,
    opNum: 1,
    clinicNum: null,
    appointmentLength: 30,
    bufferBetweenAppointments: 15,
    lookAheadDays: 7,
    preferredTimes: ['09:00', '10:00', '14:00', '15:00', '16:00']
  },
  
  sql_patterns: sqlPatterns.sql_patterns || {},
  
  workflow_patterns: sqlPatterns.workflow_patterns || {},
  
  best_practices: sqlPatterns.best_practices || {},
  
  natural_language_guide: enhancedSchema.natural_language_guide || '',
  
  foreign_key_mappings: enhancedSchema.foreign_key_mappings || {},
  
  enum_values: enhancedSchema.enum_values || {},
  
  tables: enhancedSchema.tables || {},
  
  table_relationships: enhancedSchema.foreign_key_mappings || {}
};

// Write unified registry
const outputPath = path.join(__dirname, '../docs/API/unified_registry.json');
console.log(`💾 Writing unified registry to: ${outputPath}`);
fs.writeFileSync(outputPath, JSON.stringify(unifiedRegistry, null, 2));

const fileSizeKB = Math.round(fs.statSync(outputPath).size / 1024);
console.log(`✓ Created unified_registry.json (${fileSizeKB} KB)\n`);

// Summary
console.log('📊 Summary:');
console.log(`   Total Functions: ${unifiedRegistry.metadata.statistics.total_functions}`);
console.log(`   Functions with FK Mappings: ${unifiedRegistry.metadata.statistics.functions_with_fk_mappings}`);
console.log(`   Functions with SQL Patterns: ${unifiedRegistry.metadata.statistics.functions_with_sql_patterns}`);
console.log(`   Database Tables: ${unifiedRegistry.metadata.statistics.total_tables}`);
console.log(`   SQL Patterns: ${unifiedRegistry.metadata.statistics.total_sql_patterns}`);
console.log(`   Enum Values: ${unifiedRegistry.metadata.statistics.total_enum_values}`);
console.log(`   File Size: ${fileSizeKB} KB\n`);

console.log('✅ Unified registry created successfully!\n');
console.log('Next steps:');
console.log('1. Update orchestratorAgent.ts to import from unified_registry.json');
console.log('2. Archive old registry files to docs/API/legacy/');
console.log('3. Test with OpenDental API\n');




