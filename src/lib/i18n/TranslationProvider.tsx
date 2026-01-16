'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Messages = Record<string, any>;

interface TranslationContextType {
  locale: string;
  setLocale: (locale: string) => void;
  messages: Messages;
  t: (key: string, section?: string) => string;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

interface TranslationProviderProps {
  children: ReactNode;
  defaultLocale?: string;
}

export function TranslationProvider({ children, defaultLocale = 'en' }: TranslationProviderProps) {
  const [locale, setLocaleState] = useState<string>(defaultLocale);
  const [messages, setMessages] = useState<Messages>({});

  // Load locale from localStorage or URL param on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    const storedLang = localStorage.getItem('app_locale');
    
    const initialLocale = urlLang || storedLang || defaultLocale;
    setLocaleState(initialLocale);
    loadMessages(initialLocale);
  }, [defaultLocale]);

  // Load translation messages
  const loadMessages = async (loc: string) => {
    try {
      const response = await fetch(`/messages/${loc}.json`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      } else {
        // Fallback to English if locale not found
        const fallbackResponse = await fetch('/messages/en.json');
        const fallbackData = await fallbackResponse.json();
        setMessages(fallbackData);
      }
    } catch (error) {
      console.error(`Failed to load messages for locale: ${loc}`, error);
    }
  };

  // Set locale and persist to localStorage
  const setLocale = (newLocale: string) => {
    setLocaleState(newLocale);
    localStorage.setItem('app_locale', newLocale);
    loadMessages(newLocale);
  };

  // Translation function
  const t = (key: string, section?: string): string => {
    const fullKey = section ? `${section}.${key}` : key;
    const keys = fullKey.split('.');
    
    let value: any = messages;
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return fullKey; // Return key if not found
      }
    }
    
    return typeof value === 'string' ? value : fullKey;
  };

  return (
    <TranslationContext.Provider value={{ locale, setLocale, messages, t }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation(section?: string) {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within TranslationProvider');
  }

  const t = (key: string) => context.t(key, section);

  return {
    t,
    locale: context.locale,
    setLocale: context.setLocale,
  };
}

// Hook for getting current locale
export function useLocale() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useLocale must be used within TranslationProvider');
  }
  return context.locale;
}

// Hook for translations with specific section
export function useTranslations(section: string) {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslations must be used within TranslationProvider');
  }

  return (key: string) => context.t(key, section);
}





