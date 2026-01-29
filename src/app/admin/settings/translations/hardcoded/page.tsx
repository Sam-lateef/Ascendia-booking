'use client';

import { useState } from 'react';
import { useTranslations } from '@/lib/i18n/TranslationProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  Search, 
  AlertTriangle, 
  FileCode,
  ExternalLink,
  Copy,
  Check,
  ArrowLeft
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

interface HardcodedText {
  file: string;
  line: number;
  text: string;
  context: string;
  suggestedKey: string;
}

interface HardcodedScanResult {
  success: boolean;
  hardcodedTexts: HardcodedText[];
  totalFilesScanned: number;
  totalStringsFound: number;
  error?: string;
}

export default function HardcodedTextsPage() {
  const tCommon = useTranslations('common');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<HardcodedScanResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<any>(null);
  const [fixingComponents, setFixingComponents] = useState(false);
  const [componentFixResult, setComponentFixResult] = useState<any>(null);

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);

    try {
      const response = await fetch('/api/admin/translations/scan-hardcoded');
      const data: HardcodedScanResult = await response.json();

      if (data.success) {
        setScanResult(data);
      } else {
        alert(`Scan failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Scan error:', error);
      alert('Failed to scan for hardcoded text');
    } finally {
      setScanning(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleAutoFix = async () => {
    if (!scanResult || scanResult.hardcodedTexts.length === 0) return;

    const confirmed = confirm(
      `This will add ${scanResult.hardcodedTexts.length} translation keys to en.json.\n\n` +
      `A backup will be created automatically.\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    setFixing(true);
    setFixResult(null);

    try {
      const response = await fetch('/api/admin/translations/auto-fix-hardcoded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hardcodedTexts: scanResult.hardcodedTexts,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setFixResult(data);
        alert(
          `✅ Success!\n\n` +
          `Added: ${data.addedCount} keys\n` +
          `Skipped: ${data.skippedCount} (already exist)\n` +
          `Sections updated: ${data.sectionsUpdated.join(', ')}\n\n` +
          `Backup saved to: ${data.backupPath}\n\n` +
          `Next: Run "Scan Codebase" again to verify!`
        );
        await handleScan();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Auto-fix error:', error);
      alert('Failed to auto-fix hardcoded texts');
    } finally {
      setFixing(false);
    }
  };

  const handleFixComponents = async (dryRun: boolean = false) => {
    if (!scanResult || scanResult.hardcodedTexts.length === 0) return;

    const action = dryRun ? 'preview changes' : 'modify your component files';
    const confirmed = confirm(
      `This will ${action}:\n\n` +
      `• Add useTranslations imports if missing\n` +
      `• Add useTranslations hooks if missing\n` +
      `• Replace ${scanResult.hardcodedTexts.length} hardcoded texts with t() calls\n` +
      `${!dryRun ? '• Create .backup files for each modified file\n' : ''}\n` +
      `Continue?`
    );

    if (!confirmed) return;

    setFixingComponents(true);
    setComponentFixResult(null);

    try {
      const response = await fetch('/api/admin/translations/auto-fix-components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hardcodedTexts: scanResult.hardcodedTexts,
          dryRun,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setComponentFixResult(data);
        
        if (dryRun) {
          alert(
            `🔍 DRY RUN COMPLETE\n\n` +
            `Would modify: ${data.filesModified} files\n` +
            `Would make: ${data.totalChanges} changes\n\n` +
            `Review the changes below, then click "Apply Changes" to actually modify the files.`
          );
        } else {
          alert(
            `✅ COMPONENTS UPDATED!\n\n` +
            `Modified: ${data.filesModified} files\n` +
            `Total changes: ${data.totalChanges}\n\n` +
            `Backup files created with .backup extension.\n\n` +
            `Next: Test your app and run "npm run build" to check for errors.`
          );
          await handleScan();
        }
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Fix components error:', error);
      alert('Failed to fix components');
    } finally {
      setFixingComponents(false);
    }
  };

  const filteredResults = scanResult?.hardcodedTexts.filter(
    item =>
      item.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.file.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.suggestedKey.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const groupedByFile = filteredResults.reduce((acc, item) => {
    if (!acc[item.file]) {
      acc[item.file] = [];
    }
    acc[item.file].push(item);
    return acc;
  }, {} as Record<string, HardcodedText[]>);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header with back link */}
      <div>
        <Link 
          href="/admin/settings/translations" 
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Translations
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Hardcoded Text Scanner</h1>
        <p className="text-gray-600 mt-1">
          Find all hardcoded English text in your components that should be using the translation system
        </p>
      </div>

      {/* Scanner Card */}
      <Card className="border-2 border-orange-200 bg-orange-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <AlertTriangle className="h-5 w-5" />
            Hardcoded Text Detection
          </CardTitle>
          <CardDescription className="text-orange-700">
            Scans all .tsx files and identifies hardcoded English text that's NOT using t() or useTranslations().
            This finds text in JSX elements, placeholders, titles, and other attributes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleScan}
              disabled={scanning}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {scanning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Scan for Hardcoded Text
                </>
              )}
            </Button>

            {scanResult && scanResult.hardcodedTexts.length > 0 && (
              <>
                <Button
                  onClick={handleAutoFix}
                  disabled={fixing || fixingComponents}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {fixing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Step 1: Add to en.json
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => handleFixComponents(true)}
                  disabled={fixing || fixingComponents}
                  variant="outline"
                  className="border-purple-500 text-purple-700 hover:bg-purple-50"
                >
                  {fixingComponents ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Step 2: Preview Changes
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => handleFixComponents(false)}
                  disabled={fixing || fixingComponents}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {fixingComponents ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <FileCode className="mr-2 h-4 w-4" />
                      Step 2: Apply Changes
                    </>
                  )}
                </Button>
              </>
            )}
          </div>

          {/* Fix Result Message - Step 1 (en.json) */}
          {fixResult && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mt-4">
              <h3 className="font-semibold text-green-900 mb-2">Step 1 Complete: Keys Added to en.json</h3>
              <div className="text-sm text-green-800 space-y-1">
                <p>• Added: <strong>{fixResult.addedCount}</strong> new translation keys</p>
                <p>• Skipped: <strong>{fixResult.skippedCount}</strong> (already existed)</p>
                <p>• Sections updated: <strong>{fixResult.sectionsUpdated.join(', ')}</strong></p>
              </div>
              <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded text-sm">
                <p className="font-medium text-purple-900">Now click "Step 2: Apply Component Changes" to update your files</p>
              </div>
            </div>
          )}

          {/* Component Fix Result - Step 2 */}
          {componentFixResult && (
            <div className={`border-2 rounded-lg p-4 mt-4 ${componentFixResult.dryRun ? 'bg-purple-50 border-purple-200' : 'bg-green-50 border-green-200'}`}>
              <h3 className={`font-semibold mb-2 ${componentFixResult.dryRun ? 'text-purple-900' : 'text-green-900'}`}>
                {componentFixResult.dryRun ? '🔍 Preview: Component Changes' : '✅ Step 2 Complete: Components Updated!'}
              </h3>
              <div className={`text-sm space-y-1 ${componentFixResult.dryRun ? 'text-purple-800' : 'text-green-800'}`}>
                <p>• Files {componentFixResult.dryRun ? 'to be' : ''} modified: <strong>{componentFixResult.filesModified}</strong></p>
                <p>• Total changes: <strong>{componentFixResult.totalChanges}</strong></p>
                <p>• Files skipped (no changes): <strong>{componentFixResult.filesSkipped}</strong></p>
              </div>

              {/* Changes by file */}
              {componentFixResult.modifications && componentFixResult.modifications.length > 0 && (
                <div className="mt-3 max-h-64 overflow-y-auto">
                  <p className="text-sm font-medium mb-2">Changes by file:</p>
                  <div className="space-y-2">
                    {componentFixResult.modifications.filter((m: any) => m.changes.length > 0).map((mod: any, idx: number) => (
                      <div key={idx} className="bg-white rounded border p-2 text-xs">
                        <div className="font-mono text-gray-700 mb-1">{mod.file}</div>
                        <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                          {mod.changes.map((change: string, cidx: number) => (
                            <li key={cidx}>{change}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {componentFixResult.dryRun && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  <p className="font-medium text-yellow-900">This was a preview only. Click "Apply Changes" to actually modify the files.</p>
                </div>
              )}

              {!componentFixResult.dryRun && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                  <p className="font-medium text-blue-900 mb-2">All done! Next steps:</p>
                  <ol className="text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Run <code className="bg-white px-1 rounded">npm run build</code> to check for any errors</li>
                    <li>Go to <Link href="/admin/settings/translations" className="underline">Translations page</Link> and click "Auto-Translate All"</li>
                    <li>Test your app with different languages</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {scanResult && (
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-white rounded-lg p-3 border">
                <div className="text-2xl font-bold text-gray-900">{scanResult.totalFilesScanned}</div>
                <div className="text-sm text-gray-500">Files Scanned</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-orange-300">
                <div className="text-2xl font-bold text-orange-600">{scanResult.totalStringsFound}</div>
                <div className="text-sm text-gray-500">Hardcoded Texts</div>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <div className="text-2xl font-bold text-gray-900">{Object.keys(groupedByFile).length}</div>
                <div className="text-sm text-gray-500">Files with Issues</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {scanResult && scanResult.hardcodedTexts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Found {filteredResults.length} Hardcoded Texts
              </CardTitle>
              <div className="w-72">
                <Input
                  placeholder="Search by text, file or key..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
            <CardDescription>
              These texts should be replaced with translation function calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(groupedByFile).map(([file, items]) => (
                <div key={file} className="border rounded-lg">
                  {/* File header */}
                  <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-mono text-gray-700">
                      <FileCode className="h-4 w-4" />
                      {file}
                    </div>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                      {items.length} texts
                    </span>
                  </div>

                  {/* Items */}
                  <div className="divide-y">
                    {items.map((item, idx) => {
                      const globalIndex = scanResult.hardcodedTexts.indexOf(item);
                      return (
                        <div key={idx} className="p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              {/* The hardcoded text */}
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">Line {item.line}:</span>
                                <code className="text-sm font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                                  "{item.text}"
                                </code>
                              </div>

                              {/* Context (the actual code) */}
                              <div className="bg-gray-900 text-gray-100 rounded p-2 overflow-x-auto">
                                <code className="text-xs font-mono">{item.context}</code>
                              </div>

                              {/* Suggested replacement */}
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600">Suggested key:</span>
                                <code className="text-green-700 bg-green-50 px-2 py-0.5 rounded font-mono">
                                  {item.suggestedKey}
                                </code>
                              </div>

                              {/* How to fix */}
                              <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
                                <p className="text-blue-900 font-medium mb-1">How to fix:</p>
                                <ol className="text-blue-800 space-y-1 pl-4 list-decimal">
                                  <li>Add <code className="bg-white px-1 rounded">{item.suggestedKey}: "{item.text}"</code> to en.json</li>
                                  <li>Add <code className="bg-white px-1 rounded">const t = useTranslations('{item.suggestedKey.split('.')[0]}')</code> at top of component</li>
                                  <li>Replace hardcoded text with <code className="bg-white px-1 rounded">{`{t('${item.suggestedKey.split('.').slice(1).join('.')}')}`}</code></li>
                                </ol>
                              </div>
                            </div>

                            {/* Copy button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopy(item.text, globalIndex)}
                              className="shrink-0"
                            >
                              {copiedIndex === globalIndex ? (
                                <>
                                  <Check className="h-3 h-3 mr-1" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {scanResult && scanResult.hardcodedTexts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Hardcoded Text Found!
            </h3>
            <p className="text-gray-600">
              All text in your components is properly using the translation system.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
