'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu, X, Globe } from 'lucide-react';
import { useTranslation, useTranslations } from '@/lib/i18n/TranslationProvider';
import { SUPPORTED_LANGUAGES } from '@/lib/languages';
import { useAuth } from '@/app/contexts/AuthContext';
import { useOrganization } from '@/app/contexts/OrganizationContext';
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';

/**
 * Admin layout with Supabase authentication and organization context
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tCommon = useTranslations('common');
  const { t, locale, setLocale } = useTranslation('admin');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  
  // Use authentication and organization context
  const { user, loading: authLoading } = useAuth();
  const { currentOrganization, loading: orgLoading } = useOrganization();

  // Define navItems with translation keys
  const navItems = [
    { href: `/admin/booking`, key: 'dashboard' },
    { href: `/admin/booking/appointments`, key: 'appointments' },
    { href: `/admin/booking/providers`, key: 'providers' },
    { href: `/admin/booking/schedules`, key: 'schedules' },
    { href: `/admin/booking/operatories`, key: 'operatories' },
    { href: `/admin/booking/patients`, key: 'patients' },
    { href: `/admin/booking/treatments`, key: 'treatments', label: 'Treatment Plans' },
    { href: `/admin/booking/treatments-config`, key: 'treatmentsConfig', label: 'Treatments Config' },
    { href: `/admin/booking/calls`, key: 'calls' },
    { href: `/admin/booking/calls/statistics`, key: 'statistics' },
    { href: `/admin/booking/settings`, key: 'settings' },
    { href: `/admin/booking/translations`, key: 'translations' },
    { href: `/admin/booking/translations/hardcoded`, key: 'hardcodedScanner', label: 'Hardcoded Text Scanner' },
  ];

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/admin/booking');
    }
  }, [user, authLoading, router]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const switchLanguage = (newLocale: string) => {
    // Use the context's setLocale (saves to localStorage and loads messages)
    setLocale(newLocale);
    setShowLangMenu(false);
    // Force a page refresh to reload all components with new translations
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  // Show loading state while checking auth
  if (authLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect happens in useEffect above
  if (!user) {
    return null;
  }

  // Show error if no organization
  if (!currentOrganization) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full text-center space-y-4 p-8 bg-white rounded-lg shadow-md">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900">No Organization</h2>
          <p className="text-gray-600">
            You don't belong to any organization. Please contact your administrator.
          </p>
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
          <OrganizationSwitcher />
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="p-2 rounded-md hover:bg-gray-800 transition-colors"
            aria-label={tCommon('change_language')}
          >
            <Globe className="h-5 w-5" />
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-md hover:bg-gray-800 transition-colors"
            aria-label={tCommon('toggle_menu')}
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
            <span className="font-medium text-gray-900">{tCommon('select_language')}</span>
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
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-2 rounded-md hover:bg-gray-800 transition-colors"
              aria-label={tCommon('close_menu')}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <OrganizationSwitcher />
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const label = (item as any).label || t(item.key);
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
                {label}
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
        </div>
      </aside>

      {/* Main Content - top padding aligns with sidebar header */}
      <main className="lg:ml-64 pt-16 p-4 lg:p-8 lg:pt-10">
        {children}
      </main>
    </div>
  );
}

