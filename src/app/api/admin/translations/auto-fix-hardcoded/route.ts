import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface HardcodedText {
  file: string;
  line: number;
  text: string;
  context: string;
  suggestedKey: string;
}

/**
 * Phase 1: Add all hardcoded texts to en.json
 * POST /api/admin/translations/auto-fix-hardcoded
 */
export async function POST(request: NextRequest) {
  try {
    const { hardcodedTexts } = await request.json();

    if (!hardcodedTexts || !Array.isArray(hardcodedTexts)) {
      return NextResponse.json(
        { success: false, error: 'hardcodedTexts array required' },
        { status: 400 }
      );
    }

    console.log(`[Auto-Fix] Processing ${hardcodedTexts.length} hardcoded texts...`);

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
    const backupPath = enPath.replace('.json', `.backup.${Date.now()}.json`);
    await fs.writeFile(backupPath, JSON.stringify(existingMessages, null, 2), 'utf-8');
    console.log('[Auto-Fix] Created backup:', backupPath);

    // Group hardcoded texts by section
    const textsBySection: Record<string, Array<{ key: string; text: string }>> = {};
    const addedKeys: string[] = [];
    const skippedKeys: string[] = [];

    for (const item of hardcodedTexts as HardcodedText[]) {
      const parts = item.suggestedKey.split('.');
      const section = parts[0];
      const key = parts.slice(1).join('.');

      // Skip if key already exists
      if (existingMessages[section] && existingMessages[section][key]) {
        skippedKeys.push(item.suggestedKey);
        continue;
      }

      if (!textsBySection[section]) {
        textsBySection[section] = [];
      }

      textsBySection[section].push({
        key: key || section, // fallback if no key after section
        text: item.text,
      });

      addedKeys.push(item.suggestedKey);
    }

    // Add new keys to en.json organized by section
    for (const [section, items] of Object.entries(textsBySection)) {
      if (!existingMessages[section]) {
        existingMessages[section] = {};
      }

      for (const item of items) {
        // Clean up the key (remove leading underscores, etc.)
        const cleanKey = item.key.replace(/^_+/, '').replace(/_+$/, '');
        
        if (cleanKey && !existingMessages[section][cleanKey]) {
          existingMessages[section][cleanKey] = item.text;
        }
      }
    }

    // Save updated en.json
    await fs.writeFile(enPath, JSON.stringify(existingMessages, null, 2), 'utf-8');

    // Also save to public/messages for runtime access
    const publicEnPath = path.join(process.cwd(), 'public', 'messages', 'en.json');
    await fs.writeFile(publicEnPath, JSON.stringify(existingMessages, null, 2), 'utf-8');

    console.log(`[Auto-Fix] Added ${addedKeys.length} new keys, skipped ${skippedKeys.length} existing keys`);

    return NextResponse.json({
      success: true,
      addedCount: addedKeys.length,
      skippedCount: skippedKeys.length,
      addedKeys,
      skippedKeys,
      sectionsUpdated: Object.keys(textsBySection),
      backupPath,
      message: `Successfully added ${addedKeys.length} translation keys to en.json`,
    });
  } catch (error: any) {
    console.error('[Auto-Fix] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fix hardcoded texts' },
      { status: 500 }
    );
  }
}

/**
 * Phase 2: Generate replacement instructions for component files
 * GET /api/admin/translations/auto-fix-hardcoded
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File path required' },
        { status: 400 }
      );
    }

    // Read the file
    const fullPath = path.join(process.cwd(), file);
    const content = await fs.readFile(fullPath, 'utf-8');

    // TODO: Generate a diff showing before/after
    // For now, just return the original content
    return NextResponse.json({
      success: true,
      filePath: file,
      originalContent: content,
      message: 'File content retrieved. Manual replacement recommended for safety.',
    });
  } catch (error: any) {
    console.error('[Auto-Fix] Error reading file:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to read file' },
      { status: 500 }
    );
  }
}
