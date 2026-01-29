'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Agent Settings Page - DEPRECATED
 * 
 * All agent configuration (mode, instructions) is now per-channel.
 * Redirects to the Channels page.
 */
export default function AgentSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to channels page where all agent config now lives
    router.replace('/admin/settings/channels');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to Channels settings...</p>
        <p className="text-sm text-gray-500 mt-2">
          Agent configuration is now per-channel
        </p>
      </div>
    </div>
  );
}
