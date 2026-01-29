'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Settings index page - redirects to organization settings
 */
export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/settings/organization');
  }, [router]);

  return (
    <div className="p-6 flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to settings...</p>
      </div>
    </div>
  );
}
