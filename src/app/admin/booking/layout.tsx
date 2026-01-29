'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu, X, LogOut, Building2 } from 'lucide-react';
import { useTranslation, useTranslations } from '@/lib/i18n/TranslationProvider';
import { useAuth } from '@/app/contexts/AuthContext';
import { useOrganization } from '@/app/contexts/OrganizationContext';

/**
 * Admin layout with Supabase authentication and organization context
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tCommon = useTranslations('common');
  const { t } = useTranslation('admin');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  
  // Use authentication and organization context
  const { user, loading: authLoading, signOut } = useAuth();
  const { currentOrganization, loading: orgLoading } = useOrganization();

  // Define navItems with translation keys
  const navItems = [
    { href: `/admin/booking`, key: 'dashboard' },
    { href: `/admin/booking/appointments`, key: 'appointments' },
    { href: `/admin/booking/providers`, key: 'providers' },
    { href: `/admin/booking/schedules`, key: 'schedules' },
    { href: `/admin/booking/operatories`, key: 'operatories' },
    { href: `/admin/booking/patients`, key: 'patients' },
    // { href: `/admin/booking/treatments`, key: 'treatments', label: 'Treatment Plans' },
    // { href: `/admin/booking/treatments-config`, key: 'treatmentsConfig', label: 'Treatments Config' },
    { href: `/admin/booking/calls`, key: 'calls' },
    { href: `/admin/booking/calls/statistics`, key: 'statistics' },
    // Settings section - consolidated under /admin/settings (includes WhatsApp, Translations, Notifications, etc.)
    { href: `/admin/settings`, key: 'settings', label: '⚙️ Settings' },
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

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/landing');
    } catch (error) {
      console.error('Logout error:', error);
    }
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
          {currentOrganization && (
            <div className="px-2 py-1 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-400">
                  {currentOrganization.name}
                </span>
              </div>
              <div className="text-[10px] text-gray-500 font-mono">
                ID: {currentOrganization.id}
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="p-2 rounded-md hover:bg-gray-800 transition-colors"
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5" />
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
          {currentOrganization && (
            <div className="px-2 py-1 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-400">
                  {currentOrganization.name}
                </span>
              </div>
              <div className="text-[10px] text-gray-500 font-mono pl-4">
                ID: {currentOrganization.id}
              </div>
            </div>
          )}
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
            onClick={handleLogout}
            className="w-full px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
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

