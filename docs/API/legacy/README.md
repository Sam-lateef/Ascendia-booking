# Legacy API Documentation Files

This folder contains **archived** versions of API documentation files that have been superseded by `unified_registry.json`.

## Files in This Folder

### `validated_registry.json` (ARCHIVED)
- **Purpose**: Original API function registry with 337 functions
- **Size**: ~600 KB
- **Replaced By**: `../unified_registry.json`
- **Status**: Kept for reference only

### `enhanced_schema.json` (ARCHIVED)
- **Purpose**: Database schema with FK relationships and natural language guide
- **Size**: ~120 KB
- **Replaced By**: Integrated into `../unified_registry.json`
- **Status**: Kept for reference only

### `api_registry.json` (ARCHIVED)
- **Purpose**: Original API registry before validation
- **Size**: ~500 KB
- **Replaced By**: `../unified_registry.json`
- **Status**: Kept for reference only

## Migration Date
**October 29, 2025**

## Why These Were Archived

The original system had **3 separate documentation sources**:
1. `validated_registry.json` - API functions and parameters
2. `enhanced_schema.json` - Database relationships and workflow rules
3. `api_registry.json` - Raw API definitions

This created several issues:
- **Duplication**: Same information in multiple files
- **Sync problems**: Updates needed in multiple places
- **Complexity**: Hard to maintain consistency
- **Performance**: Multiple file reads during initialization

## New Unified Approach

All documentation is now consolidated into:
**`../unified_registry.json`** - Single source of truth (689 KB)

This includes:
- ✅ All 337 API functions
- ✅ Foreign key mappings
- ✅ Natural language guide
- ✅ SQL patterns from production
- ✅ Workflow patterns
- ✅ Default configuration values
- ✅ Database schema and relationships

## How to Use

**✅ DO**: Use `unified_registry.json` for all new development  
**❌ DON'T**: Reference files in this legacy folder

## If You Need to Restore

If for any reason you need to revert to the old system:
1. Copy files from this folder back to `docs/API/`
2. Update `orchestratorAgent.ts` imports:
   ```typescript
   // Change from:
   import unifiedRegistry from '../../../../docs/API/unified_registry.json';
   
   // Back to:
   import enhancedSchema from '../../../../docs/API/enhanced_schema.json';
   ```
3. Revert `apiRegistry.ts` to use `validated_registry.json`

## Cleanup Plan

These files may be **permanently deleted** after:
- [ ] 1 month of successful unified registry usage
- [ ] All integration tests passing
- [ ] Production validation complete
- [ ] Team approval

**Target Deletion Date**: November 29, 2025

---

*For questions about the migration to unified registry, see `../DEFAULTS_AND_OPTIMIZATION.md`*




