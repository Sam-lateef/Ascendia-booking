import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import fs from 'fs/promises';
import path from 'path';

interface HardcodedText {
  file: string;
  line: number;
  text: string;
  context: string;
  suggestedKey: string;
}

interface FileModification {
  file: string;
  originalContent: string;
  modifiedContent: string;
  changes: string[];
  success: boolean;
  error?: string;
}

/**
 * Auto-fix components by replacing hardcoded text with translation calls
 * POST /api/admin/translations/auto-fix-components
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const context = await getCurrentOrganization(request);
    if (!['owner', 'admin'].includes(context.role)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }
    
    const { hardcodedTexts, dryRun = false } = await request.json();

    if (!hardcodedTexts || !Array.isArray(hardcodedTexts)) {
      return NextResponse.json(
        { success: false, error: 'hardcodedTexts array required' },
        { status: 400 }
      );
    }

    console.log(`[Auto-Fix Components] Processing ${hardcodedTexts.length} items, dryRun=${dryRun}`);

    // Group by file
    const byFile: Record<string, HardcodedText[]> = {};
    for (const item of hardcodedTexts as HardcodedText[]) {
      if (!byFile[item.file]) {
        byFile[item.file] = [];
      }
      byFile[item.file].push(item);
    }

    const modifications: FileModification[] = [];
    let totalChanges = 0;
    let filesModified = 0;
    let filesSkipped = 0;

    for (const [relativeFile, items] of Object.entries(byFile)) {
      const filePath = path.join(process.cwd(), relativeFile);
      
      try {
        // Read the file
        let content = await fs.readFile(filePath, 'utf-8');
        const originalContent = content;
        const changes: string[] = [];

        // Determine which sections are needed
        const sectionsNeeded = new Set<string>();
        for (const item of items) {
          const section = item.suggestedKey.split('.')[0];
          sectionsNeeded.add(section);
        }

        // Check if 'use client' directive exists (needed for hooks)
        const hasUseClient = content.includes("'use client'") || content.includes('"use client"');

        // Check existing imports and hooks
        const hasTranslationImport = content.includes('useTranslations') || content.includes('useTranslation');
        
        // Find existing useTranslations hooks
        const existingHooks = new Map<string, string>();
        const hookMatches = content.matchAll(/const\s+(\w+)\s*=\s*useTranslations\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
        for (const match of hookMatches) {
          existingHooks.set(match[2], match[1]); // section -> variable name
        }

        // Determine which sections need new hooks
        const sectionsNeedingHooks: string[] = [];
        for (const section of sectionsNeeded) {
          if (!existingHooks.has(section)) {
            sectionsNeedingHooks.push(section);
          }
        }

        // Add import if needed
        if (sectionsNeedingHooks.length > 0) {
          // Check if useTranslations is already imported (could be in a combined import)
          const hasUseTranslationsImport = /import\s*\{[^}]*useTranslations[^}]*\}\s*from\s*['"]@\/lib\/i18n\/TranslationProvider['"]/.test(content);
          
          if (!hasUseTranslationsImport) {
            // Check if there's an existing import from TranslationProvider (like useTranslation without 's')
            const existingTranslationImport = content.match(/import\s*\{([^}]*)\}\s*from\s*['"]@\/lib\/i18n\/TranslationProvider['"]/);
            
            if (existingTranslationImport) {
              // Add useTranslations to existing import
              const existingImports = existingTranslationImport[1];
              if (!existingImports.includes('useTranslations')) {
                const newImports = existingImports.trim() + ', useTranslations';
                content = content.replace(
                  /import\s*\{([^}]*)\}\s*from\s*['"]@\/lib\/i18n\/TranslationProvider['"]/,
                  `import { ${newImports} } from '@/lib/i18n/TranslationProvider'`
                );
                changes.push(`Added useTranslations to existing TranslationProvider import`);
              }
            } else {
              // No existing import, add new one
              if (hasUseClient) {
                content = content.replace(
                  /(['"]use client['"];?\n)/,
                  `$1\nimport { useTranslations } from '@/lib/i18n/TranslationProvider';\n`
                );
              } else {
                // Add after the last import statement
                const importMatches = [...content.matchAll(/^import .+;?\n/gm)];
                if (importMatches.length > 0) {
                  const lastImport = importMatches[importMatches.length - 1];
                  const lastImportEnd = lastImport.index! + lastImport[0].length;
                  content = 
                    content.slice(0, lastImportEnd) + 
                    `import { useTranslations } from '@/lib/i18n/TranslationProvider';\n` +
                    content.slice(lastImportEnd);
                } else {
                  content = `import { useTranslations } from '@/lib/i18n/TranslationProvider';\n` + content;
                }
              }
              changes.push(`Added import for useTranslations`);
            }
          }
        }

        // Add hooks if needed - find the MAIN component function body
        // IMPORTANT: We must find the actual React component, not any nested function
        if (sectionsNeedingHooks.length > 0) {
          let hookInsertIndex = -1;

          // Strategy 1: Look for "export default function ComponentName" - this is the safest
          const exportDefaultFnMatch = content.match(/export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{/);
          if (exportDefaultFnMatch && exportDefaultFnMatch.index !== undefined) {
            hookInsertIndex = exportDefaultFnMatch.index + exportDefaultFnMatch[0].length;
          }

          // Strategy 2: Look for "export default function()" (anonymous)
          if (hookInsertIndex < 0) {
            const exportDefaultAnonMatch = content.match(/export\s+default\s+function\s*\([^)]*\)\s*\{/);
            if (exportDefaultAnonMatch && exportDefaultAnonMatch.index !== undefined) {
              hookInsertIndex = exportDefaultAnonMatch.index + exportDefaultAnonMatch[0].length;
            }
          }

          // Strategy 3: Look for "export const ComponentName = " or "export function ComponentName"
          if (hookInsertIndex < 0) {
            const exportConstMatch = content.match(/export\s+(?:const|function)\s+\w+\s*(?:=\s*(?:\([^)]*\)|[^=])*=>|(?:\([^)]*\)))\s*\{/);
            if (exportConstMatch && exportConstMatch.index !== undefined) {
              hookInsertIndex = exportConstMatch.index + exportConstMatch[0].length;
            }
          }

          // Strategy 4: Look for React component pattern - function starting with capital letter after imports
          // Only use this if we're sure it's the main component
          if (hookInsertIndex < 0) {
            // Find position after all imports
            const importMatches = [...content.matchAll(/^import .+;?\n/gm)];
            const afterImportsPos = importMatches.length > 0 
              ? importMatches[importMatches.length - 1].index! + importMatches[importMatches.length - 1][0].length
              : 0;
            
            // Look for first function/const with capital letter name (React component convention)
            const componentMatch = content.slice(afterImportsPos).match(/(?:function|const)\s+([A-Z]\w+)\s*(?:=\s*(?:\([^)]*\)|[^=])*=>|(?:\([^)]*\)))\s*\{/);
            if (componentMatch && componentMatch.index !== undefined) {
              hookInsertIndex = afterImportsPos + componentMatch.index + componentMatch[0].length;
            }
          }

          if (hookInsertIndex > 0) {
            // Build hooks to insert
            const hooksToInsert = sectionsNeedingHooks.map(section => {
              const varName = section === 'common' ? 'tCommon' : `t${section.charAt(0).toUpperCase() + section.slice(1)}`;
              existingHooks.set(section, varName);
              return `\n  const ${varName} = useTranslations('${section}');`;
            }).join('');

            content = 
              content.slice(0, hookInsertIndex) + 
              hooksToInsert +
              content.slice(hookInsertIndex);

            changes.push(`Added useTranslations hooks for: ${sectionsNeedingHooks.join(', ')}`);
          } else {
            changes.push(`WARNING: Could not find main component function to add hooks`);
          }
        }

        // Now replace hardcoded texts
        for (const item of items) {
          const section = item.suggestedKey.split('.')[0];
          const key = item.suggestedKey.split('.').slice(1).join('.').replace(/^_+/, '').replace(/_+$/, '');
          
          // Get the variable name for this section
          let varName = existingHooks.get(section);
          if (!varName) {
            // Fallback - use 't' if section matches an existing 't' or create a name
            varName = section === 'common' ? 'tCommon' : `t${section.charAt(0).toUpperCase() + section.slice(1)}`;
          }

          // Escape special regex characters in the text
          const escapedText = item.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

          // Pattern 1: JSX text content >text<
          const jsxTextPattern = new RegExp(`>\\s*${escapedText}\\s*<`, 'g');
          const jsxTextReplacement = `>{${varName}('${key}')}<`;
          
          if (jsxTextPattern.test(content)) {
            content = content.replace(jsxTextPattern, jsxTextReplacement);
            changes.push(`Replaced JSX text: "${item.text.substring(0, 30)}..." → {${varName}('${key}')}`);
          }

          // Pattern 2: Attributes with double quotes placeholder="text"
          const attrPatternDouble = new RegExp(`(placeholder|title|label|alt|aria-label)="${escapedText}"`, 'g');
          const attrReplacementDouble = `$1={${varName}('${key}')}`;
          
          if (attrPatternDouble.test(content)) {
            content = content.replace(attrPatternDouble, attrReplacementDouble);
            changes.push(`Replaced attribute: "${item.text.substring(0, 30)}..." → {${varName}('${key}')}`);
          }

          // Pattern 3: Attributes with single quotes placeholder='text'
          const attrPatternSingle = new RegExp(`(placeholder|title|label|alt|aria-label)='${escapedText}'`, 'g');
          const attrReplacementSingle = `$1={${varName}('${key}')}`;
          
          if (attrPatternSingle.test(content)) {
            content = content.replace(attrPatternSingle, attrReplacementSingle);
            changes.push(`Replaced attribute: "${item.text.substring(0, 30)}..." → {${varName}('${key}')}`);
          }

          // Pattern 4: Direct string in JSX expressions {"text"} - less common but handle it
          const jsxExprPattern = new RegExp(`\\{\\s*["']${escapedText}["']\\s*\\}`, 'g');
          const jsxExprReplacement = `{${varName}('${key}')}`;
          
          if (jsxExprPattern.test(content)) {
            content = content.replace(jsxExprPattern, jsxExprReplacement);
            changes.push(`Replaced JSX expression: "${item.text.substring(0, 30)}..." → {${varName}('${key}')}`);
          }
        }

        // Check if content actually changed
        if (content !== originalContent) {
          if (!dryRun) {
            // Create backup
            const backupPath = filePath + '.backup';
            await fs.writeFile(backupPath, originalContent, 'utf-8');
            
            // Write modified content
            await fs.writeFile(filePath, content, 'utf-8');
          }

          modifications.push({
            file: relativeFile,
            originalContent: originalContent.substring(0, 500) + '...',
            modifiedContent: content.substring(0, 500) + '...',
            changes,
            success: true,
          });

          totalChanges += changes.length;
          filesModified++;
        } else {
          filesSkipped++;
        }
      } catch (fileError: any) {
        modifications.push({
          file: relativeFile,
          originalContent: '',
          modifiedContent: '',
          changes: [],
          success: false,
          error: fileError.message,
        });
      }
    }

    console.log(`[Auto-Fix Components] Modified ${filesModified} files, skipped ${filesSkipped}, total changes: ${totalChanges}`);

    return NextResponse.json({
      success: true,
      dryRun,
      filesModified,
      filesSkipped,
      totalChanges,
      modifications: modifications.map(m => ({
        file: m.file,
        changes: m.changes,
        success: m.success,
        error: m.error,
      })),
      message: dryRun 
        ? `DRY RUN: Would modify ${filesModified} files with ${totalChanges} changes`
        : `Successfully modified ${filesModified} files with ${totalChanges} changes`,
    });
  } catch (error: any) {
    console.error('[Auto-Fix Components] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to auto-fix components' },
      { status: 500 }
    );
  }
}
