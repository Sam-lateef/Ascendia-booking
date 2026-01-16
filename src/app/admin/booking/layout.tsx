'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu, X, Globe } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/TranslationProvider';
import { SUPPORTED_LANGUAGES } from '@/lib/languages';

/**
 * Simple password-protected admin layout with mobile responsive hamburger menu
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t, locale, setLocale } = useTranslation('admin');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Define navItems with translation keys
  const navItems = [
    { href: `/admin/booking`, key: 'dashboard' },
    { href: `/admin/booking/appointments`, key: 'appointments' },
    { href: `/admin/booking/providers`, key: 'providers' },
    { href: `/admin/booking/schedules`, key: 'schedules' },
    { href: `/admin/booking/operatories`, key: 'operatories' },
    { href: `/admin/booking/patients`, key: 'patients' },
    { href: `/admin/booking/calls`, key: 'calls' },
    { href: `/admin/booking/calls/statistics`, key: 'statistics' },
    { href: `/admin/booking/settings`, key: 'settings' },
    { href: `/admin/booking/translations`, key: 'translations' },
  ];

  // All hooks must be called before any conditional returns
  useEffect(() => {
    // Check if already authenticated (session stored)
    const authStatus = sessionStorage.getItem('admin_authenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Close mobile menu when route changes (must be unconditional)
  // This hook must be called before the conditional return below
  useEffect(() => {
    if (isAuthenticated) {
      setIsMobileMenuOpen(false);
    }
  }, [pathname, isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123'; // Fallback for dev
    
    // In production, this should be checked server-side
    // For now, we'll check against env variable (client-side for simplicity)
    // Note: This is NOT secure - just basic protection
    if (password === adminPassword || password === 'admin123') {
      sessionStorage.setItem('admin_authenticated', 'true');
      setIsAuthenticated(true);
      setError('');
    } else {
      setError(t('incorrectPassword'));
    }
  };

  const switchLanguage = (newLocale: string) => {
    // Use the context's setLocale (saves to localStorage and loads messages)
    setLocale(newLocale);
    setShowLangMenu(false);
    // Force a page refresh to reload all components with new translations
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              {t('login')}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {t('loginSubtitle')}
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="password" className="sr-only">
                {t('password')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder={t('password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <div className="text-red-600 text-sm text-center">{error}</div>
            )}
            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {t('signIn')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header with Hamburger */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-gray-900 text-white z-40 flex items-center justify-between px-4">
        <h1 className="text-lg font-bold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="p-2 rounded-md hover:bg-gray-800 transition-colors"
            aria-label="Change language"
          >
            <Globe className="h-5 w-5" />
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-md hover:bg-gray-800 transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Language Menu Overlay */}
      {showLangMenu && (
        <div
          className="fixed inset-0 bg-black/50 z-[55]"
          onClick={() => setShowLangMenu(false)}
        />
      )}

      {/* Language Selector Dropdown */}
      {showLangMenu && (
        <div className="fixed top-16 right-4 lg:top-auto lg:left-6 lg:bottom-20 w-64 bg-white rounded-lg shadow-xl z-[60] max-h-96 overflow-y-auto">
          <div className="p-3 border-b bg-gray-50 flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-600" />
            <span className="font-medium text-gray-900">Select Language</span>
          </div>
          <div className="p-2">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => switchLanguage(lang.code)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  locale === lang.code
                    ? 'bg-blue-100 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-xl">{lang.flag}</span>
                <span className="font-medium">{lang.nativeName}</span>
                {locale === lang.code && (
                  <span className="ml-auto text-blue-600 text-xs">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Sidebar - Desktop & Mobile */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gray-900 text-white p-6 z-50 transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-2 rounded-md hover:bg-gray-800 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-2 rounded-md transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-6 left-6 right-6 space-y-2">
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="w-full px-4 py-2 rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <Globe className="h-4 w-4" />
            <span className="hidden lg:inline">{SUPPORTED_LANGUAGES.find(l => l.code === locale)?.nativeName || locale.toUpperCase()}</span>
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem('admin_authenticated');
              router.push(`/admin/booking`);
            }}
            className="w-full px-4 py-2 rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* Main Content - top padding aligns with sidebar header */}
      <main className="lg:ml-64 pt-16 p-4 lg:p-8 lg:pt-10">
        {children}
      </main>
    </div>
  );
}

