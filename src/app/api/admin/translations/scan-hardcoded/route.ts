import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface HardcodedText {
  file: string;
  line: number;
  text: string;
  context: string; // surrounding code for context
  suggestedKey: string;
}

interface HardcodedScanResult {
  success: boolean;
  hardcodedTexts: HardcodedText[];
  totalFilesScanned: number;
  totalStringsFound: number;
  error?: string;
}

// Patterns to detect hardcoded text in JSX/TSX
const JSX_TEXT_PATTERN = />([^<>{}\n]+)</g;
const JSX_ATTRIBUTE_PATTERN = /(?:placeholder|title|label|alt|aria-label)=["']([^"']+)["']/g;
const BUTTON_TEXT_PATTERN = /<[Bb]utton[^>]*>([^<]+)</g;

// Words to ignore (common technical terms, numbers, punctuation)
const IGNORE_PATTERNS = [
  /^\s*$/,  // Empty or whitespace only
  /^[\d\s\-:,.]+$/,  // Only numbers, spaces, and basic punctuation
  /^[A-Z_]+$/,  // All caps (likely constants)
  /^\$\{.*\}$/,  // Template literals
  /^[\W_]+$/,  // Only special characters
  /^(px|rem|em|vh|vw|ms|s)$/i,  // CSS units
  /^(true|false|null|undefined)$/i,  // JavaScript keywords
  /^(onClick|onChange|className|style|key|ref|id)$/i,  // React props
  /^https?:\/\//,  // URLs
  /^\/[a-z0-9\-_\/]*$/i,  // Paths
  /^\{.*\}$/,  // JSX expressions
  /^[a-z]+\([^)]*\)$/i,  // Function calls
];

// Common English words to detect (if text contains these, it's likely translatable)
const ENGLISH_INDICATORS = [
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can',
  'your', 'you', 'my', 'me', 'we', 'our', 'their', 'them', 'his', 'her',
];

async function getAllTsxFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip non-source directories
        if (['node_modules', '.next', 'dist', '.git', 'public'].includes(entry.name)) {
          continue;
        }
        files.push(...await getAllTsxFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  
  return files;
}

function isLikelyTranslatableText(text: string): boolean {
  const trimmed = text.trim();
  
  // Check ignore patterns
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }
  
  // Must be at least 2 characters
  if (trimmed.length < 2) return false;
  
  // Check if it contains English words
  const lowerText = trimmed.toLowerCase();
  const words = lowerText.split(/\s+/);
  
  for (const word of words) {
    if (ENGLISH_INDICATORS.includes(word)) {
      return true;
    }
  }
  
  // If it has letters and looks like a sentence/phrase
  if (/[a-zA-Z]{2,}/.test(trimmed) && !/^[a-z]+[A-Z]/.test(trimmed)) {
    return true;
  }
  
  return false;
}

function generateKeyFromText(text: string, context: string): string {
  // Extract section from file context or use 'common'
  let section = 'common';
  
  // Try to infer section from context
  if (context.includes('/admin/')) {
    section = 'admin';
  } else if (context.includes('/dashboard')) {
    section = 'dashboard';
  } else if (context.includes('/appointments')) {
    section = 'appointments';
  } else if (context.includes('/providers')) {
    section = 'providers';
  } else if (context.includes('/patients')) {
    section = 'patients';
  } else if (context.includes('/treatments')) {
    section = 'treatments';
  }
  
  // Generate key from text
  const key = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 30);
  
  return `${section}.${key}`;
}

function extractHardcodedText(content: string, filePath: string): HardcodedText[] {
  const results: HardcodedText[] = [];
  const lines = content.split('\n');
  const relativePath = filePath.replace(process.cwd(), '');
  
  lines.forEach((line, idx) => {
    const lineNumber = idx + 1;
    
    // Skip lines that already use translation
    if (line.includes('t(') || line.includes('useTranslations')) {
      return;
    }
    
    // Skip import statements, comments, and type definitions
    if (
      line.trim().startsWith('import ') ||
      line.trim().startsWith('//') ||
      line.trim().startsWith('/*') ||
      line.trim().startsWith('*') ||
      line.trim().startsWith('export type') ||
      line.trim().startsWith('interface ')
    ) {
      return;
    }
    
    // Find JSX text content: >text<
    let match;
    const jsxTextRegex = />([^<>{}\n]+)</g;
    while ((match = jsxTextRegex.exec(line)) !== null) {
      const text = match[1].trim();
      if (isLikelyTranslatableText(text)) {
        results.push({
          file: relativePath,
          line: lineNumber,
          text,
          context: line.trim(),
          suggestedKey: generateKeyFromText(text, filePath),
        });
      }
    }
    
    // Find JSX attributes: placeholder="...", title="...", etc.
    const attrRegex = /(?:placeholder|title|label|alt|aria-label|value)=["']([^"']+)["']/g;
    while ((match = attrRegex.exec(line)) !== null) {
      const text = match[1].trim();
      if (isLikelyTranslatableText(text)) {
        results.push({
          file: relativePath,
          line: lineNumber,
          text,
          context: line.trim(),
          suggestedKey: generateKeyFromText(text, filePath),
        });
      }
    }
  });
  
  return results;
}

export async function GET(request: NextRequest) {
  try {
    const srcDir = path.join(process.cwd(), 'src');
    
    console.log('[Hardcoded Scanner] Scanning for hardcoded text in TSX files...');
    const files = await getAllTsxFiles(srcDir);
    console.log(`[Hardcoded Scanner] Found ${files.length} TSX files to scan`);
    
    const allHardcodedTexts: HardcodedText[] = [];
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const hardcoded = extractHardcodedText(content, file);
        allHardcodedTexts.push(...hardcoded);
      } catch (error) {
        console.error(`[Hardcoded Scanner] Error reading file ${file}:`, error);
      }
    }
    
    // Remove duplicates based on text
    const uniqueTexts = new Map<string, HardcodedText>();
    for (const item of allHardcodedTexts) {
      if (!uniqueTexts.has(item.text)) {
        uniqueTexts.set(item.text, item);
      }
    }
    
    const uniqueHardcodedTexts = Array.from(uniqueTexts.values());
    
    console.log(`[Hardcoded Scanner] Found ${uniqueHardcodedTexts.length} unique hardcoded texts`);
    
    const result: HardcodedScanResult = {
      success: true,
      hardcodedTexts: uniqueHardcodedTexts,
      totalFilesScanned: files.length,
      totalStringsFound: uniqueHardcodedTexts.length,
    };
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Hardcoded Scanner] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to scan for hardcoded text',
        hardcodedTexts: [],
        totalFilesScanned: 0,
        totalStringsFound: 0,
      } as HardcodedScanResult,
      { status: 500 }
    );
  }
}
