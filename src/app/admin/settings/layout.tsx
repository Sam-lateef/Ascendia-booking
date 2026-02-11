'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Building2, 
  Bot, 
  Plug, 
  Settings,
  Menu,
  X,
  Radio,
  MessageSquare,
  Languages,
  Globe,
  FlaskConical,
  Bell,
  Phone,
  Shield
} from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useOrganization } from '@/app/contexts/OrganizationContext';

/**
 * Settings Layout with sub-navigation
 * Consolidates all configuration pages under /admin/settings/*
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  
  const { user, loading: authLoading } = useAuth();
  const { currentOrganization, loading: orgLoading } = useOrganization();
  const isSystemOrgOwner = currentOrganization?.is_system_org && currentOrganization?.role === 'owner';

  const settingsNavItems = [
    { 
      href: '/admin/settings/organization', 
      label: 'Organization', 
      icon: Building2,
      description: 'Business info, branding, industry type'
    },
    { 
      href: '/admin/settings/phone-numbers', 
      label: 'Phone Numbers', 
      icon: Phone,
      description: 'Setup & manage Vapi voice numbers'
    },
    { 
      href: '/admin/settings/channels', 
      label: 'Channels & Agents', 
      icon: Radio,
      description: 'Voice, chat, AI mode & instructions'
    },
    { 
      href: '/admin/settings/integrations', 
      label: 'Integrations', 
      icon: Plug,
      description: 'Org API keys, credentials & sync settings'
    },
    ...(isSystemOrgOwner ? [{
      href: '/admin/settings/system',
      label: 'System Settings',
      icon: Shield,
      description: 'Platform-wide config (OpenAI, Google OAuth)',
      isSystem: true,
    }] : []),
    { 
      href: '/admin/settings/notifications', 
      label: 'Notifications', 
      icon: Bell,
      description: 'Email alerts, call ended notifications'
    },
    // { 
    //   href: '/admin/settings/whatsapp', 
    //   label: 'WhatsApp', 
    //   icon: MessageSquare,
    //   description: 'QR code, instances & connection'
    // },
    // { 
    //   href: '/admin/settings/translations', 
    //   label: 'Translations', 
    //   icon: Languages,
    //   description: 'Multilingual content & AI translate'
    // },
    // { 
    //   href: '/admin/settings/preferences', 
    //   label: 'Preferences', 
    //   icon: Globe,
    //   description: 'Language, timezone & display settings'
    // },
    { 
      href: '/agent-ui', 
      label: 'Testing Lab', 
      icon: FlaskConical,
      description: 'Test Retell vs Realtime, Premium vs Standard'
    },
  ];

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/admin/settings');
    }
  }, [user, authLoading, router]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Show loading state
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

  if (!user) {
    return null;
  }

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
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-gray-900 text-white z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link href="/admin/booking" className="p-2 hover:bg-gray-800 rounded-md">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold">Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          {currentOrganization && (
            <span className="text-xs text-gray-400">
              {currentOrganization.name}
            </span>
          )}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-md hover:bg-gray-800 transition-colors"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
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

      {/* Settings Sidebar - Desktop & Mobile */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-gray-900 text-white z-50 transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6">
          {/* Header with back button */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link 
                href="/admin/booking" 
                className="p-2 hover:bg-gray-800 rounded-md transition-colors"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Settings
                </h1>
              </div>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-2 rounded-md hover:bg-gray-800 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Organization badge */}
          {currentOrganization && (
            <div className="mb-6 p-3 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <Building2 className="w-3 h-3" />
                <span>Current Organization</span>
              </div>
              <p className="font-medium text-white">{currentOrganization.name}</p>
              <p className="text-xs text-gray-500 capitalize">{currentOrganization.plan} plan</p>
              <p className="text-[10px] text-gray-600 font-mono mt-1">ID: {currentOrganization.id}</p>
            </div>
          )}

          {/* Navigation */}
          <nav className="space-y-1">
            {settingsNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block p-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">{item.label}</p>
                      <p className={`text-xs truncate ${isActive ? 'text-blue-100' : 'text-gray-500'}`}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Bottom link back to booking */}
          <div className="absolute bottom-6 left-6 right-6">
            <Link
              href="/admin/booking"
              className="flex items-center gap-2 p-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 pt-16 lg:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
