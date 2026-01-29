'use client';

/**
 * Translations Management Page
 * 
 * AI-powered translation management with codebase scanning
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslations } from '@/lib/i18n/TranslationProvider';
import { SUPPORTED_LANGUAGES } from '@/lib/languages';
import { 
  Loader2, 
  Search, 
  Globe, 
  Save, 
  Wand2, 
  ScanSearch, 
  AlertTriangle, 
  CheckCircle2,
  Plus,
  FileCode,
  ChevronDown,
  ChevronRight,
  Languages
} from 'lucide-react';

interface TranslationEntry {
  key: string;
  english: string;
  translated: string;
}

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

export default function TranslationsSettingsPage() {
  const t = useTranslations('translations');
  const tCommon = useTranslations('common');
  const [context, setContext] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('ar');
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [filteredTranslations, setFilteredTranslations] = useState<TranslationEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showScanResults, setShowScanResults] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [missingKeyPlaceholders, setMissingKeyPlaceholders] = useState<Record<string, string>>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadContext();
  }, []);

  useEffect(() => {
    if (targetLanguage) {
      loadTranslations(targetLanguage);
    }
  }, [targetLanguage]);

  useEffect(() => {
    filterTranslations();
  }, [searchQuery, translations]);

  const loadContext = async () => {
    try {
      const response = await fetch('/messages/context.json');
      const data = await response.json();
      setContext(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to load context:', error);
    }
  };

  const loadTranslations = async (locale: string) => {
    setLoading(true);
    try {
      const enResponse = await fetch('/messages/en.json');
      const enData = await enResponse.json();

      let targetData: Record<string, any> = {};
      try {
        const targetResponse = await fetch(`/messages/${locale}.json`);
        if (targetResponse.ok) {
          targetData = await targetResponse.json();
        }
      } catch (e) {
        // Target language doesn't exist yet
      }

      const entries = flattenTranslations(enData, targetData);
      setTranslations(entries);
    } catch (error) {
      console.error('Failed to load translations:', error);
      setMessage({ type: 'error', text: 'Failed to load translations' });
    } finally {
      setLoading(false);
    }
  };

  const flattenTranslations = (
    enData: Record<string, any>,
    targetData: Record<string, any>,
    prefix = ''
  ): TranslationEntry[] => {
    const entries: TranslationEntry[] = [];

    for (const key in enData) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const enValue = enData[key];
      const targetValue = targetData[key];

      if (typeof enValue === 'object' && enValue !== null) {
        entries.push(
          ...flattenTranslations(enValue, targetValue || {}, fullKey)
        );
      } else {
        entries.push({
          key: fullKey,
          english: String(enValue),
          translated: typeof targetValue === 'string' ? targetValue : '',
        });
      }
    }

    return entries;
  };

  const unflattenTranslations = (entries: TranslationEntry[]): Record<string, any> => {
    const result: Record<string, any> = {};

    for (const entry of entries) {
      const keys = entry.key.split('.');
      let current = result;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = entry.translated || entry.english;
    }

    return result;
  };

  const filterTranslations = () => {
    if (!searchQuery.trim()) {
      setFilteredTranslations(translations);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = translations.filter(
      (entry) =>
        entry.key.toLowerCase().includes(query) ||
        entry.english.toLowerCase().includes(query) ||
        entry.translated.toLowerCase().includes(query)
    );
    setFilteredTranslations(filtered);
  };

  const handleAutoTranslate = async () => {
    setTranslating(true);
    setMessage(null);

    try {
      const enResponse = await fetch('/messages/en.json');
      const enData = await enResponse.json();
      const contextObj = JSON.parse(context);

      const response = await fetch('/api/admin/translations/ai-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLanguage,
          context: contextObj,
          sourceMessages: enData,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const entries = flattenTranslations(enData, data.translatedMessages);
        setTranslations(entries);
        const langName = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.nativeName;
        setMessage({
          type: 'success',
          text: `Successfully translated to ${langName}`,
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Translation failed' });
      }
    } catch (error) {
      console.error('Translation error:', error);
      setMessage({ type: 'error', text: 'Translation failed' });
    } finally {
      setTranslating(false);
    }
  };

  const handleSaveTranslations = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const messages = unflattenTranslations(translations);
      let contextObj;
      try {
        contextObj = JSON.parse(context);
      } catch (e) {
        contextObj = undefined;
      }

      const response = await fetch('/api/admin/translations/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: targetLanguage,
          messages,
          context: contextObj,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Translations saved successfully' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (error) {
      console.error('Save error:', error);
      setMessage({ type: 'error', text: 'Failed to save translations' });
    } finally {
      setSaving(false);
    }
  };

  const updateTranslation = (key: string, value: string) => {
    setTranslations((prev) =>
      prev.map((entry) => (entry.key === key ? { ...entry, translated: value } : entry))
    );
  };

  const handleScanCodebase = async () => {
    setScanning(true);
    setMessage(null);
    setScanResult(null);

    try {
      const response = await fetch('/api/admin/translations/scan');
      const data: ScanResult = await response.json();

      if (data.success) {
        setScanResult(data);
        setShowScanResults(true);
        
        const placeholders: Record<string, string> = {};
        for (const key of data.missingKeys) {
          const parts = key.split('.');
          const leafKey = parts[parts.length - 1];
          placeholders[key] = generatePlaceholder(leafKey);
        }
        setMissingKeyPlaceholders(placeholders);
        
        if (data.missingKeys.length === 0) {
          setMessage({ type: 'success', text: `All ${data.scannedKeys.length} keys are in sync!` });
        } else {
          setMessage({ 
            type: 'error', 
            text: `Found ${data.missingKeys.length} missing keys` 
          });
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to scan codebase' });
      }
    } catch (error) {
      console.error('Scan error:', error);
      setMessage({ type: 'error', text: 'Failed to scan codebase' });
    } finally {
      setScanning(false);
    }
  };

  const handleSyncMissingKeys = async () => {
    if (!scanResult?.missingKeys.length) return;

    setSyncing(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/translations/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missingKeys: scanResult.missingKeys,
          placeholders: missingKeyPlaceholders,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        await loadTranslations(targetLanguage);
        await handleScanCodebase();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to sync keys' });
      }
    } catch (error) {
      console.error('Sync error:', error);
      setMessage({ type: 'error', text: 'Failed to sync keys' });
    } finally {
      setSyncing(false);
    }
  };

  const generatePlaceholder = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/^\s+/, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const updatePlaceholder = (fullKey: string, value: string) => {
    setMissingKeyPlaceholders(prev => ({
      ...prev,
      [fullKey]: value,
    }));
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const getMissingKeysBySection = () => {
    if (!scanResult?.missingKeys) return {};
    
    const grouped: Record<string, string[]> = {};
    for (const key of scanResult.missingKeys) {
      const section = key.split('.')[0];
      if (!grouped[section]) {
        grouped[section] = [];
      }
      grouped[section].push(key);
    }
    return grouped;
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Translations</h1>
            <p className="text-gray-600 mt-1">
              Manage multilingual content with AI-powered translations
            </p>
          </div>
          <Button
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
            onClick={() => window.location.href = '/admin/settings/translations/hardcoded'}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Find Hardcoded Text
          </Button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg border flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Scanner Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <ScanSearch className="h-5 w-5" />
            Code Scanner
          </CardTitle>
          <CardDescription className="text-blue-700">
            Scan your codebase to find all translation keys and detect missing entries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleScanCodebase}
              disabled={scanning}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {scanning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <ScanSearch className="mr-2 h-4 w-4" />
                  Scan Codebase
                </>
              )}
            </Button>

            {scanResult && scanResult.missingKeys.length > 0 && (
              <Button
                onClick={handleSyncMissingKeys}
                disabled={syncing}
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                {syncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add {scanResult.missingKeys.length} Missing Keys
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Scan Results Summary */}
          {scanResult && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-white rounded-lg p-3 border">
                <div className="text-2xl font-bold text-gray-900">{scanResult.totalFilesScanned}</div>
                <div className="text-xs text-gray-500">Files Scanned</div>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <div className="text-2xl font-bold text-gray-900">{scanResult.scannedKeys.length}</div>
                <div className="text-xs text-gray-500">Keys Found</div>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <div className="text-2xl font-bold text-green-600">{scanResult.existingKeys.length}</div>
                <div className="text-xs text-gray-500">In en.json</div>
              </div>
              <div className={`bg-white rounded-lg p-3 border ${scanResult.missingKeys.length > 0 ? 'border-orange-300' : ''}`}>
                <div className={`text-2xl font-bold ${scanResult.missingKeys.length > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {scanResult.missingKeys.length}
                </div>
                <div className="text-xs text-gray-500">Missing Keys</div>
              </div>
            </div>
          )}

          {/* Missing Keys Details */}
          {scanResult && scanResult.missingKeys.length > 0 && showScanResults && (
            <div className="mt-4 bg-white rounded-lg border max-h-[300px] overflow-y-auto">
              <div className="p-3 border-b bg-orange-50 flex items-center justify-between sticky top-0">
                <div className="flex items-center gap-2 text-orange-800 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Missing Translation Keys
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowScanResults(false)}
                >
                  Hide
                </Button>
              </div>
              {Object.entries(getMissingKeysBySection()).map(([section, keys]) => (
                <div key={section} className="border-b last:border-b-0">
                  <button
                    onClick={() => toggleSection(section)}
                    className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 text-left"
                  >
                    <div className="flex items-center gap-2">
                      {expandedSections.has(section) ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="font-medium text-gray-700">{section}</span>
                      <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
                        {keys.length} missing
                      </span>
                    </div>
                  </button>
                  {expandedSections.has(section) && (
                    <div className="px-4 pb-3 space-y-2">
                      {keys.map(fullKey => (
                        <div key={fullKey} className="bg-gray-50 rounded p-3 flex items-center justify-between gap-4">
                          <code className="text-sm font-mono text-orange-700">{fullKey}</code>
                          <Input
                            value={missingKeyPlaceholders[fullKey] || ''}
                            onChange={(e) => updatePlaceholder(fullKey, e.target.value)}
                            placeholder="English text"
                            className="w-64 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* All Synced Message */}
          {scanResult && scanResult.missingKeys.length === 0 && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
              <CheckCircle2 className="h-5 w-5" />
              <span>All translation keys are in sync!</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Business Context Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Business Context
          </CardTitle>
          <CardDescription>
            Provide context about your business to improve AI translation quality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder='{"industry": "dental", "tone": "professional", ...}'
            className="min-h-[100px] font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Translation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="w-5 h-5" />
            Translation Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Target Language</Label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {SUPPORTED_LANGUAGES.filter((l) => l.code !== 'en').map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <div className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.nativeName}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search keys or text..."
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleAutoTranslate}
              disabled={translating || !targetLanguage}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {translating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Translating...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  AI Translate All
                </>
              )}
            </Button>

            <Button
              onClick={handleSaveTranslations}
              disabled={saving || translations.length === 0}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Translations
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Translations Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filteredTranslations.length} Translation Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredTranslations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No translations found</div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {filteredTranslations.map((entry) => (
                <div
                  key={entry.key}
                  className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <Label className="text-xs text-gray-500">Key</Label>
                    <div className="font-mono text-sm text-gray-700 mt-1">{entry.key}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">English</Label>
                    <div className="text-sm text-gray-900 mt-1">{entry.english}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Translated</Label>
                    <Input
                      value={entry.translated}
                      onChange={(e) => updateTranslation(entry.key, e.target.value)}
                      placeholder={entry.english}
                      className="mt-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
