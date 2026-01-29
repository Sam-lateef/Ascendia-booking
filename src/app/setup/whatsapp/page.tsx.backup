'use client';

/**
 * WhatsApp Setup Wizard
 * 
 * Provides QR code setup for Evolution API WhatsApp integration
 * This page allows clients to connect their WhatsApp number to the booking agent
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export default function WhatsAppSetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState<NodeJS.Timeout | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (polling) {
        clearInterval(polling);
      }
    };
  }, [polling]);

  /**
   * Initialize WhatsApp connection
   */
  const initializeWhatsApp = async () => {
    try {
      setStatus('connecting');
      setError(null);

      // First, try to create/ensure instance exists
      try {
        const createResponse = await fetch('/api/whatsapp/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_instance' }),
        });
        
        if (createResponse.ok) {
          console.log('Instance created or already exists');
        }
      } catch (createError) {
        console.log('Instance might already exist, continuing...');
      }

      // Request QR code from Evolution API
      const response = await fetch('/api/whatsapp/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_qr_code' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get QR code');
      }

      const data = await response.json();

      if (data.qrCode || data.base64) {
        setQrCode(data.qrCode || data.base64);

        // Start polling for connection status
        const interval = setInterval(async () => {
          try {
            const statusResponse = await fetch('/api/whatsapp/setup?action=check_status');
            const statusData = await statusResponse.json();

            if (statusData.status === 'open' || statusData.status === 'connected') {
              setStatus('connected');
              if (interval) {
                clearInterval(interval);
              }
              setPolling(null);
            }
          } catch (err) {
            console.error('Error checking status:', err);
          }
        }, 3000); // Poll every 3 seconds

        setPolling(interval);
      } else {
        throw new Error('No QR code returned from API');
      }
    } catch (err: any) {
      console.error('Error initializing WhatsApp:', err);
      setStatus('error');
      setError(err.message || 'Failed to initialize WhatsApp connection');
    }
  };

  /**
   * Check current connection status
   */
  const checkStatus = async () => {
    try {
      const response = await fetch('/api/whatsapp/setup?action=check_status');
      const data = await response.json();

      if (data.status === 'open' || data.status === 'connected') {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
    } catch (err) {
      console.error('Error checking status:', err);
    }
  };

  // Check status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center text-4xl">
              📱
            </div>
          </div>
          <CardTitle className="text-2xl">WhatsApp Setup</CardTitle>
          <CardDescription>
            Connect your WhatsApp number to enable AI booking assistant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Disconnected State */}
          {status === 'disconnected' && (
            <div className="text-center space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                Click the button below to generate a QR code. Scan it with WhatsApp on your phone to connect.
              </p>
              <Button onClick={initializeWhatsApp} size="lg" className="w-full sm:w-auto">
                Connect WhatsApp
              </Button>
            </div>
          )}

          {/* Connecting State */}
          {status === 'connecting' && qrCode && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Scan QR Code</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Open WhatsApp on your phone and scan this QR code:
                </p>
              </div>

              {/* QR Code Display */}
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg shadow-lg">
                  {qrCode.startsWith('data:image') ? (
                    <Image
                      src={qrCode}
                      alt="WhatsApp QR Code"
                      width={256}
                      height={256}
                      className="w-64 h-64"
                    />
                  ) : (
                    <div className="w-64 h-64 flex items-center justify-center bg-gray-100 rounded">
                      <p className="text-sm text-gray-500">QR Code Loading...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <span>📱</span>
                  How to scan:
                </h4>
                <ol className="text-sm space-y-1 list-decimal list-inside text-gray-700 dark:text-gray-300">
                  <li>Open WhatsApp on your phone</li>
                  <li>Tap Menu (⋮) or Settings</li>
                  <li>Tap "Linked Devices"</li>
                  <li>Tap "Link a Device"</li>
                  <li>Point your phone at this screen to scan the QR code</li>
                </ol>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                  Waiting for authentication...
                </div>
              </div>
            </div>
          )}

          {/* Connected State */}
          {status === 'connected' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-4xl">
                  ✅
                </div>
              </div>
              <h3 className="text-lg font-semibold text-green-600 dark:text-green-400">
                WhatsApp Connected Successfully!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Your WhatsApp number is now connected. Users can now interact with your AI booking agent via WhatsApp.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button onClick={() => router.push('/admin')} variant="default">
                  Go to Dashboard
                </Button>
                <Button onClick={() => router.push('/admin/booking/calls')} variant="outline">
                  View Conversations
                </Button>
              </div>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">
                  Connection Error
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {error || 'Failed to connect to WhatsApp. Please try again.'}
                </p>
              </div>
              <div className="text-center">
                <Button onClick={initializeWhatsApp} variant="default">
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Help Section */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold mb-2 text-sm">Need Help?</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Make sure Evolution API is running and accessible</li>
              <li>• Check that your phone has an active internet connection</li>
              <li>• The QR code expires after a few minutes - generate a new one if needed</li>
              <li>• Contact support if you continue to experience issues</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


