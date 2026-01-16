import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import fs from 'fs/promises';
import path from 'path';

interface ScannedKey {
  key: string;
  section: string;
  fullKey: string;
  files: string[];
}

interface ScanResult {
  success: boolean;
  scannedKeys: ScannedKey[];
  missingKeys: string[];
  existingKeys: string[];
  totalFilesScanned: number;
  error?: string;
}

// Patterns to match translation function calls
const PATTERNS = [
  // t('key') or t("key")
  /\bt\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // t('key', 'section') or t("key", "section")
  /\bt\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g,
  // useTranslations('section') - captures section for context
  /useTranslations\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // tCommon('key'), tAdmin('key'), etc - any t prefixed function
  /\bt[A-Z][a-zA-Z]*\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

// Pattern to detect section from useTranslations hook usage
const SECTION_PATTERN = /const\s+t\s*=\s*useTranslations\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const SECTION_ALIAS_PATTERN = /const\s+(t[A-Z][a-zA-Z]*)\s*=\s*useTranslations\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

async function getAllTsxFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip node_modules, .next, and other non-source directories
      if (entry.isDirectory()) {
        if (['node_modules', '.next', 'dist', '.git', 'public'].includes(entry.name)) {
          continue;
        }
        files.push(...await getAllTsxFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
        // Skip type definition files and test files
        if (!entry.name.endsWith('.d.ts') && !entry.name.includes('.test.')) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  
  return files;
}

function extractTranslationKeys(content: string, filePath: string): Map<string, Set<string>> {
  const keysMap = new Map<string, Set<string>>(); // fullKey -> Set of file paths
  
  // First, find all section assignments in the file
  const sections: { varName: string; section: string }[] = [];
  
  // Match: const t = useTranslations('section')
  let sectionMatch;
  const sectionRegex = /const\s+t\s*=\s*useTranslations\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((sectionMatch = sectionRegex.exec(content)) !== null) {
    sections.push({ varName: 't', section: sectionMatch[1] });
  }
  
  // Match: const tAdmin = useTranslations('admin')
  const aliasRegex = /const\s+(t[A-Z][a-zA-Z]*)\s*=\s*useTranslations\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((sectionMatch = aliasRegex.exec(content)) !== null) {
    sections.push({ varName: sectionMatch[1], section: sectionMatch[2] });
  }
  
  // Now find all t('key') calls and map them to their sections
  for (const { varName, section } of sections) {
    // Create regex for this specific variable name
    const keyRegex = new RegExp(`\\b${varName}\\s*\\(\\s*['"]([^'"]+)['"]\\s*\\)`, 'g');
    let keyMatch;
    
    while ((keyMatch = keyRegex.exec(content)) !== null) {
      const key = keyMatch[1];
      const fullKey = `${section}.${key}`;
      
      if (!keysMap.has(fullKey)) {
        keysMap.set(fullKey, new Set());
      }
      keysMap.get(fullKey)!.add(filePath);
    }
  }
  
  // Also catch direct t('section.key') patterns without useTranslations
  const directKeyRegex = /\bt\s*\(\s*['"]([^'"]+\.[^'"]+)['"]\s*\)/g;
  let directMatch;
  while ((directMatch = directKeyRegex.exec(content)) !== null) {
    const fullKey = directMatch[1];
    if (!keysMap.has(fullKey)) {
      keysMap.set(fullKey, new Set());
    }
    keysMap.get(fullKey)!.add(filePath);
  }
  
  return keysMap;
}

function flattenExistingKeys(obj: Record<string, any>, prefix = ''): string[] {
  const keys: string[] = [];
  
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    
    if (typeof value === 'object' && value !== null) {
      keys.push(...flattenExistingKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const context = await getCurrentOrganization(request);
    if (!['owner', 'admin'].includes(context.role)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }
    
    const srcDir = path.join(process.cwd(), 'src');
    
    // Get all TSX/TS files
    console.log('[Translation Scanner] Scanning source directory:', srcDir);
    const files = await getAllTsxFiles(srcDir);
    console.log(`[Translation Scanner] Found ${files.length} files to scan`);
    
    // Extract all translation keys from files
    const allKeysMap = new Map<string, Set<string>>();
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const fileKeys = extractTranslationKeys(content, file.replace(process.cwd(), ''));
        
        // Merge into allKeysMap
        for (const [key, filePaths] of fileKeys) {
          if (!allKeysMap.has(key)) {
            allKeysMap.set(key, new Set());
          }
          for (const fp of filePaths) {
            allKeysMap.get(key)!.add(fp);
          }
        }
      } catch (error) {
        console.error(`[Translation Scanner] Error reading file ${file}:`, error);
      }
    }
    
    // Load existing en.json
    let existingMessages: Record<string, any> = {};
    try {
      const enPath = path.join(process.cwd(), 'messages', 'en.json');
      const enContent = await fs.readFile(enPath, 'utf-8');
      existingMessages = JSON.parse(enContent);
    } catch (error) {
      console.log('[Translation Scanner] en.json not found in messages/, trying public/messages/');
      try {
        const publicEnPath = path.join(process.cwd(), 'public', 'messages', 'en.json');
        const enContent = await fs.readFile(publicEnPath, 'utf-8');
        existingMessages = JSON.parse(enContent);
      } catch (e) {
        console.error('[Translation Scanner] Could not load en.json:', e);
      }
    }
    
    const existingKeys = flattenExistingKeys(existingMessages);
    const existingKeysSet = new Set(existingKeys);
    
    // Build scanned keys result
    const scannedKeys: ScannedKey[] = [];
    const missingKeys: string[] = [];
    
    for (const [fullKey, filePaths] of allKeysMap) {
      const parts = fullKey.split('.');
      const section = parts[0];
      const key = parts.slice(1).join('.');
      
      scannedKeys.push({
        key,
        section,
        fullKey,
        files: Array.from(filePaths),
      });
      
      if (!existingKeysSet.has(fullKey)) {
        missingKeys.push(fullKey);
      }
    }
    
    // Sort for consistent output
    scannedKeys.sort((a, b) => a.fullKey.localeCompare(b.fullKey));
    missingKeys.sort();
    
    console.log(`[Translation Scanner] Found ${scannedKeys.length} total keys, ${missingKeys.length} missing`);
    
    const result: ScanResult = {
      success: true,
      scannedKeys,
      missingKeys,
      existingKeys: existingKeys.sort(),
      totalFilesScanned: files.length,
    };
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Translation Scanner] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to scan translations',
        scannedKeys: [],
        missingKeys: [],
        existingKeys: [],
        totalFilesScanned: 0,
      } as ScanResult,
      { status: 500 }
    );
  }
}

// POST endpoint to sync missing keys to en.json
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
    
    const { missingKeys, placeholders } = await request.json();
    
    if (!missingKeys || !Array.isArray(missingKeys)) {
      return NextResponse.json(
        { success: false, error: 'Missing keys array required' },
        { status: 400 }
      );
    }
    
    // Load existing en.json
    const enPath = path.join(process.cwd(), 'messages', 'en.json');
    let existingMessages: Record<string, any> = {};
    
    try {
      const enContent = await fs.readFile(enPath, 'utf-8');
      existingMessages = JSON.parse(enContent);
    } catch (error) {
      // Try public/messages
      const publicEnPath = path.join(process.cwd(), 'public', 'messages', 'en.json');
      const enContent = await fs.readFile(publicEnPath, 'utf-8');
      existingMessages = JSON.parse(enContent);
    }
    
    // Create backup
    const backupPath = enPath.replace('.json', '.json.backup');
    await fs.writeFile(backupPath, JSON.stringify(existingMessages, null, 2), 'utf-8');
    console.log('[Translation Scanner] Created backup:', backupPath);
    
    // Add missing keys with placeholders
    let addedCount = 0;
    for (const fullKey of missingKeys) {
      const parts = fullKey.split('.');
      let current = existingMessages;
      
      // Navigate/create nested structure
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      
      const leafKey = parts[parts.length - 1];
      if (current[leafKey] === undefined) {
        // Use provided placeholder or generate one
        const placeholder = placeholders?.[fullKey] || generatePlaceholder(leafKey);
        current[leafKey] = placeholder;
        addedCount++;
      }
    }
    
    // Save updated en.json
    await fs.writeFile(enPath, JSON.stringify(existingMessages, null, 2), 'utf-8');
    
    // Also save to public/messages for runtime access
    const publicEnPath = path.join(process.cwd(), 'public', 'messages', 'en.json');
    await fs.writeFile(publicEnPath, JSON.stringify(existingMessages, null, 2), 'utf-8');
    
    console.log(`[Translation Scanner] Added ${addedCount} new keys to en.json`);
    
    return NextResponse.json({
      success: true,
      addedCount,
      message: `Successfully added ${addedCount} new translation keys`,
    });
  } catch (error: any) {
    console.error('[Translation Scanner] Sync error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to sync translations' },
      { status: 500 }
    );
  }
}

// Generate a human-readable placeholder from a key
function generatePlaceholder(key: string): string {
  // Convert camelCase or snake_case to Title Case with spaces
  return key
    .replace(/([A-Z])/g, ' $1') // camelCase -> camel Case
    .replace(/[_-]/g, ' ')       // snake_case -> snake case
    .replace(/^\s+/, '')         // trim leading space
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
