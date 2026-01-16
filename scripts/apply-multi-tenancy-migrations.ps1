# ============================================================================
# Apply Multi-Tenancy Migrations to Agent0
# ============================================================================
# Run this script to set up the full SaaS multi-tenancy infrastructure
# ============================================================================

Write-Host "🚀 Agent0 Multi-Tenancy Setup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "❌ ERROR: DATABASE_URL environment variable not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set DATABASE_URL in your .env file or environment:" -ForegroundColor Yellow
    Write-Host '  $env:DATABASE_URL = "postgresql://user:pass@host:5432/database"' -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "✅ Found DATABASE_URL" -ForegroundColor Green
Write-Host ""

# Confirm with user
Write-Host "⚠️  WARNING: This will modify your database structure" -ForegroundColor Yellow
Write-Host "The following migrations will be applied:" -ForegroundColor Yellow
Write-Host "  1. 000_multi_tenancy_foundation.sql - Organizations, users, members" -ForegroundColor Gray
Write-Host "  2. 001_add_organization_id_to_tables.sql - Add org_id to all tables" -ForegroundColor Gray
Write-Host "  3. 002_rls_config_helper.sql - RLS helper function" -ForegroundColor Gray
Write-Host "  4. 042_whatsapp_integration.sql - WhatsApp (if not applied)" -ForegroundColor Gray
Write-Host ""
$confirm = Read-Host "Continue? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "❌ Cancelled by user" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "📦 Applying migrations..." -ForegroundColor Cyan
Write-Host ""

# Function to apply a migration
function Apply-Migration {
    param (
        [string]$MigrationFile,
        [string]$Description
    )
    
    Write-Host "  ⏳ $Description..." -ForegroundColor White
    
    $migrationPath = Join-Path $PSScriptRoot "..\supabase\migrations\$MigrationFile"
    
    if (-not (Test-Path $migrationPath)) {
        Write-Host "    ⚠️  Migration file not found: $MigrationFile" -ForegroundColor Yellow
        return $false
    }
    
    try {
        $result = psql $env:DATABASE_URL -f $migrationPath 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    ✅ Success" -ForegroundColor Green
            return $true
        } else {
            Write-Host "    ❌ Failed" -ForegroundColor Red
            Write-Host $result -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "    ❌ Error: $_" -ForegroundColor Red
        return $false
    }
}

# Apply migrations in order
$success = $true

$success = Apply-Migration "000_multi_tenancy_foundation.sql" "Creating organizations, users, and members tables"
if (-not $success) { exit 1 }

$success = Apply-Migration "001_add_organization_id_to_tables.sql" "Adding organization_id to all tables"
if (-not $success) { exit 1 }

$success = Apply-Migration "002_rls_config_helper.sql" "Creating RLS config helper"
if (-not $success) { exit 1 }

$success = Apply-Migration "042_whatsapp_integration.sql" "Setting up WhatsApp integration"
# Don't exit on this one, might already be applied

Write-Host ""
Write-Host "✅ All migrations applied successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Create your first organization (see below)" -ForegroundColor Gray
Write-Host "  2. Enable Supabase Auth in dashboard" -ForegroundColor Gray
Write-Host "  3. Implement authentication (see docs/MULTI-TENANCY-IMPLEMENTATION.md)" -ForegroundColor Gray
Write-Host "  4. Update API routes with organization context" -ForegroundColor Gray
Write-Host ""
Write-Host "🏥 Create First Organization:" -ForegroundColor Cyan
Write-Host ""
Write-Host @"
psql `$env:DATABASE_URL -c "
INSERT INTO organizations (name, slug, plan, status)
VALUES ('Your Clinic', 'your-clinic', 'professional', 'active');
"
"@ -ForegroundColor Gray
Write-Host ""
Write-Host "📖 Full implementation guide: docs/MULTI-TENANCY-IMPLEMENTATION.md" -ForegroundColor Cyan
Write-Host ""
