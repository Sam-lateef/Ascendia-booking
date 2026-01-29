'use client';

import { useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/TranslationProvider';
import { SUPPORTED_LANGUAGES } from '@/lib/languages';

/**
 * Preferences Settings Page
 * Language selection and other user preferences
 */
export default function PreferencesPage() {
  const { locale, setLocale } = useTranslation('admin');
  const [isChanging, setIsChanging] = useState(false);

  const handleLanguageChange = (newLocale: string) => {
    setIsChanging(true);
    setLocale(newLocale);
    
    // Force page reload to apply new language across all components
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const currentLanguage = SUPPORTED_LANGUAGES.find(lang => lang.code === locale);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Globe className="w-6 h-6" />
          Preferences
        </h1>
        <p className="text-gray-600 mt-1">
          Customize your language and display settings
        </p>
      </div>

      {/* Language Selection Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            Language / اللغة
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Select your preferred language for the interface
          </p>
        </div>

        <div className="p-6">
          {/* Current Language Display */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-medium mb-1">Current Language</p>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{currentLanguage?.flag}</span>
              <div>
                <p className="font-semibold text-blue-900">{currentLanguage?.nativeName}</p>
                <p className="text-sm text-blue-700">{currentLanguage?.name}</p>
              </div>
            </div>
          </div>

          {/* Language Options Grid */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Available Languages
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isActive = locale === lang.code;
                
                return (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    disabled={isActive || isChanging}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all text-left
                      ${isActive 
                        ? 'border-blue-600 bg-blue-50 cursor-default' 
                        : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50 cursor-pointer'
                      }
                      ${isChanging ? 'opacity-50 cursor-wait' : ''}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{lang.flag}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold ${isActive ? 'text-blue-900' : 'text-gray-900'}`}>
                          {lang.nativeName}
                        </p>
                        <p className={`text-sm ${isActive ? 'text-blue-700' : 'text-gray-600'}`}>
                          {lang.name}
                        </p>
                      </div>
                      {isActive && (
                        <div className="flex-shrink-0">
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Info Message */}
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Note:</span> Changing the language will reload the page to apply the new language across the entire application.
            </p>
          </div>
        </div>
      </div>

      {/* Future Settings Placeholder */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Additional Preferences
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            More customization options coming soon
          </p>
        </div>
        <div className="p-6">
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">Timezone, date format, and other preferences will be added here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
