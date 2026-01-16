'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useTranslations } from '@/lib/i18n/TranslationProvider';
import { SUPPORTED_LANGUAGES } from '@/lib/languages';
import { Loader2, Search, Globe, Save, Wand2 } from 'lucide-react';

interface TranslationEntry {
  key: string;
  english: string;
  translated: string;
}

export default function TranslationsPage() {
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

  // Load context and existing translations
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
      // Load English (source)
      const enResponse = await fetch('/messages/en.json');
      const enData = await enResponse.json();

      // Try to load target language (may not exist yet)
      let targetData: Record<string, any> = {};
      try {
        const targetResponse = await fetch(`/messages/${locale}.json`);
        if (targetResponse.ok) {
          targetData = await targetResponse.json();
        }
      } catch (e) {
        // Target language doesn't exist yet, that's okay
      }

      // Flatten the nested JSON structure
      const entries = flattenTranslations(enData, targetData);
      setTranslations(entries);
    } catch (error) {
      console.error('Failed to load translations:', error);
      setMessage({ type: 'error', text: t('errorLoad') });
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
        // Recursively flatten nested objects
        entries.push(
          ...flattenTranslations(
            enValue,
            targetValue || {},
            fullKey
          )
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
      // Load English messages
      const enResponse = await fetch('/messages/en.json');
      const enData = await enResponse.json();

      // Parse context
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
        // Reload translations with the new data
        const entries = flattenTranslations(enData, data.translatedMessages);
        setTranslations(entries);
        setMessage({
          type: 'success',
          text: `${t('successTranslated')} ${SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.nativeName}`,
        });
      } else {
        setMessage({ type: 'error', text: data.error || t('errorTranslate') });
      }
    } catch (error) {
      console.error('Translation error:', error);
      setMessage({ type: 'error', text: t('errorTranslate') });
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
        setMessage({ type: 'success', text: t('successSaved') });
      } else {
        setMessage({ type: 'error', text: data.error || t('errorSave') });
      }
    } catch (error) {
      console.error('Save error:', error);
      setMessage({ type: 'error', text: t('errorSave') });
    } finally {
      setSaving(false);
    }
  };

  const updateTranslation = (key: string, value: string) => {
    setTranslations((prev) =>
      prev.map((entry) => (entry.key === key ? { ...entry, translated: value } : entry))
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-600 mt-2">{t('subtitle')}</p>
      </div>

      {/* Business Context Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('businessContext')}
          </CardTitle>
          <CardDescription>{t('tipContext')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={t('businessContextPlaceholder')}
            className="min-h-[120px] font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Translation Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Translation Controls</CardTitle>
          <CardDescription>{t('tipAutoTranslate')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target-language">{t('targetLanguage')}</Label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger id="target-language">
                  <SelectValue placeholder={t('selectLanguage')} />
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
              <Label htmlFor="search">{tCommon('search')}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
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
                  {t('translating')}
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  {t('autoTranslate')}
                </>
              )}
            </Button>

            <Button
              onClick={handleSaveTranslations}
              disabled={saving || translations.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {t('saveTranslations')}
                </>
              )}
            </Button>

            {message && (
              <div
                className={`text-sm ${
                  message.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {message.text}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Translations Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('entriesShowing').replace('{count}', String(filteredTranslations.length))}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredTranslations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">{t('noTranslations')}</div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredTranslations.map((entry) => (
                <div
                  key={entry.key}
                  className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <Label className="text-xs text-gray-500">{t('key')}</Label>
                    <div className="font-mono text-sm text-gray-700 mt-1">{entry.key}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">{t('english')}</Label>
                    <div className="text-sm text-gray-900 mt-1">{entry.english}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">{t('translated')}</Label>
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

