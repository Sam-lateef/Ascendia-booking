'use client';

import { useOrganization } from '@/app/contexts/OrganizationContext';
import { useAuth } from '@/app/contexts/AuthContext';
import { Building2, ChevronDown, LogOut } from 'lucide-react';
import { useState } from 'react';

export function OrganizationSwitcher() {
  const { currentOrganization, organizations, setCurrentOrganization } = useOrganization();
  const { signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!currentOrganization || organizations.length === 0) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        {currentOrganization.logo_url ? (
          <img
            src={currentOrganization.logo_url}
            alt={currentOrganization.name}
            className="w-5 h-5 rounded"
          />
        ) : (
          <Building2 className="w-5 h-5 text-gray-600" />
        )}
        <span className="text-sm font-medium text-gray-700">
          {currentOrganization.name}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            {/* Current Organization */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="text-xs text-gray-500 mb-1">Current Organization</div>
              <div className="font-medium text-gray-900">{currentOrganization.name}</div>
              <div className="text-xs text-gray-500 mt-1 capitalize">
                {currentOrganization.role} • {currentOrganization.plan || 'free'}
              </div>
            </div>

            {/* Switch Organization */}
            {organizations.length > 1 && (
              <>
                <div className="px-4 py-2 text-xs text-gray-500 font-medium">
                  Switch Organization
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {organizations
                    .filter((org) => org.id !== currentOrganization.id)
                    .map((org) => (
                      <button
                        key={org.id}
                        onClick={() => {
                          setCurrentOrganization(org);
                          setIsOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 transition-colors"
                      >
                        {org.logo_url ? (
                          <img
                            src={org.logo_url}
                            alt={org.name}
                            className="w-5 h-5 rounded"
                          />
                        ) : (
                          <Building2 className="w-5 h-5 text-gray-400" />
                        )}
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{org.name}</div>
                          <div className="text-xs text-gray-500 capitalize">{org.role}</div>
                        </div>
                      </button>
                    ))}
                </div>
              </>
            )}

            {/* Sign Out */}
            <div className="border-t border-gray-100">
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-b-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
