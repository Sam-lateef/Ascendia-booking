import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { locale, messages, context } = await request.json();

    if (!locale || !messages) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Validate locale format (2-3 letter code)
    if (!/^[a-z]{2,3}$/.test(locale)) {
      return NextResponse.json(
        { success: false, error: 'Invalid locale format' },
        { status: 400 }
      );
    }

    const messagesDir = path.join(process.cwd(), 'public', 'messages');
    const filePath = path.join(messagesDir, `${locale}.json`);

    // Ensure messages directory exists
    try {
      await fs.access(messagesDir);
    } catch {
      await fs.mkdir(messagesDir, { recursive: true });
    }

    // Create backup if file exists
    try {
      await fs.access(filePath);
      const backupPath = path.join(messagesDir, `${locale}.json.backup`);
      await fs.copyFile(filePath, backupPath);
      console.log(`[Save Translations] Backup created: ${backupPath}`);
    } catch {
      // File doesn't exist, no backup needed
    }

    // Write the translation file
    await fs.writeFile(filePath, JSON.stringify(messages, null, 2), 'utf-8');
    console.log(`[Save Translations] Saved translations for locale: ${locale}`);

    // Save context if provided
    if (context) {
      const contextPath = path.join(messagesDir, 'context.json');
      try {
        await fs.access(contextPath);
        const backupContextPath = path.join(messagesDir, 'context.json.backup');
        await fs.copyFile(contextPath, backupContextPath);
      } catch {
        // Context file doesn't exist, no backup needed
      }

      await fs.writeFile(contextPath, JSON.stringify(context, null, 2), 'utf-8');
      console.log('[Save Translations] Updated context file');
    }

    return NextResponse.json({
      success: true,
      message: `Translations saved successfully for ${locale}`,
    });
  } catch (error: any) {
    console.error('[Save Translations] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to save translations',
      },
      { status: 500 }
    );
  }
}


