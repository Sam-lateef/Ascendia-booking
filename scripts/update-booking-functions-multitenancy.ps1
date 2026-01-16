# ============================================================================
# Batch Update Booking Functions for Multi-Tenancy
# ============================================================================
# Updates all booking function signatures to accept org-scoped database client
# ============================================================================

Write-Host "🔧 Updating booking functions for multi-tenancy..." -ForegroundColor Cyan

$files = @(
    "src\app\api\booking\functions\patients.ts",
    "src\app\api\booking\functions\appointments.ts",
    "src\app\api\booking\functions\schedules.ts",
    "src\app\api\booking\functions\operatories.ts"
)

$updated = 0
$skipped = 0

foreach ($file in $files) {
    $filePath = Join-Path $PSScriptRoot "..\$file"
    
    if (-not (Test-Path $filePath)) {
        Write-Host "  ⚠️  File not found: $file" -ForegroundColor Yellow
        $skipped++
        continue
    }
    
    Write-Host "  📝 Processing: $file" -ForegroundColor White
    
    $content = Get-Content -Path $filePath -Raw
    
    # Update import statement
    $content = $content -replace "import \{ db \} from '@/app/lib/db';", "import { db as defaultDb } from '@/app/lib/db';"
    
    # Update function signatures - pattern: functionName(parameters: Record<string, any>
    # Add db parameter: functionName(parameters: Record<string, any>, db: any = defaultDb
    $content = $content -replace "(\bexport async function \w+\(parameters: Record<string, any>)(\s*=\s*\{\})?\)", "`$1`$2, db: any = defaultDb)"
    
    # Also handle functions without default empty object
    $content = $content -replace "(\bexport async function \w+\(parameters: Record<string, any>)\)", "`$1, db: any = defaultDb)"
    
    # Save updated content
    Set-Content -Path $filePath -Value $content -NoNewline
    
    Write-Host "    ✅ Updated" -ForegroundColor Green
    $updated++
}

Write-Host ""
Write-Host "✅ Batch update complete!" -ForegroundColor Green
Write-Host "   Updated: $updated files" -ForegroundColor White
Write-Host "   Skipped: $skipped files" -ForegroundColor White
Write-Host ""
Write-Host "📝 Note: Please review the changes and test the booking API" -ForegroundColor Cyan
