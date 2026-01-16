'use client';

/**
 * WhatsApp Admin Settings
 * 
 * Manage WhatsApp connection in admin panel
 * Allows admins to check status, reconnect, or disconnect
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type ConnectionStatus = 'open' | 'close' | 'connecting' | 'unknown';

export default function WhatsAppSettingsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ConnectionStatus>('unknown');
  const [loading, setLoading] = useState(true);
  const [instanceInfo, setInstanceInfo] = useState<any>(null);

  /**
   * Check WhatsApp connection status
   */
  const checkStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/setup?action=check_status');
      const data = await response.json();
      
      if (data.instance) {
        setStatus(data.instance.status || 'unknown');
        setInstanceInfo(data.instance);
      } else {
        setStatus('close');
      }
    } catch (error) {
      console.error('Error checking status:', error);
      setStatus('unknown');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Disconnect WhatsApp instance
   */
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp? Users will not be able to message via WhatsApp until you reconnect.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/whatsapp/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });

      if (response.ok) {
        setStatus('close');
        alert('WhatsApp disconnected successfully');
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (error: any) {
      console.error('Error disconnecting:', error);
      alert('Failed to disconnect WhatsApp: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Navigate to setup wizard for reconnection
   */
  const handleReconnect = () => {
    router.push('/setup/whatsapp');
  };

  // Check status on mount
  useEffect(() => {
    checkStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Get status badge
   */
  const getStatusBadge = () => {
    switch (status) {
      case 'open':
        return <Badge className="bg-green-500">Connected</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-500">Connecting</Badge>;
      case 'close':
        return <Badge className="bg-red-500">Disconnected</Badge>;
      default:
        return <Badge className="bg-gray-500">Unknown</Badge>;
    }
  };

  /**
   * Get status icon
   */
  const getStatusIcon = () => {
    switch (status) {
      case 'open':
        return '✅';
      case 'connecting':
        return '🔄';
      case 'close':
        return '❌';
      default:
        return '❓';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">WhatsApp Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your WhatsApp integration and connection status
        </p>
      </div>

      <div className="space-y-6">
        {/* Connection Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">{getStatusIcon()}</span>
              Connection Status
            </CardTitle>
            <CardDescription>
              Current status of your WhatsApp connection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 dark:border-gray-100"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Checking status...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">Status:</span>
                  {getStatusBadge()}
                </div>

                {instanceInfo && (
                  <div className="text-sm space-y-1">
                    <div className="flex gap-2">
                      <span className="font-semibold">Instance Name:</span>
                      <span className="text-gray-600 dark:text-gray-400">
                        {instanceInfo.instanceName || 'N/A'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  {status === 'open' ? (
                    <Button onClick={handleDisconnect} variant="destructive" disabled={loading}>
                      Disconnect
                    </Button>
                  ) : (
                    <Button onClick={handleReconnect} variant="default" disabled={loading}>
                      {status === 'close' ? 'Connect WhatsApp' : 'Reconnect'}
                    </Button>
                  )}
                  <Button onClick={checkStatus} variant="outline" disabled={loading}>
                    Refresh Status
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>About WhatsApp Integration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <h4 className="font-semibold mb-1">What is this?</h4>
              <p className="text-gray-600 dark:text-gray-400">
                This integration allows users to interact with your AI booking assistant via WhatsApp messages.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-1">How it works:</h4>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                <li>Users send messages to your WhatsApp number</li>
                <li>The AI assistant responds naturally with booking capabilities</li>
                <li>All conversations are logged in the admin dashboard</li>
                <li>Same functionality as phone calls and SMS</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Requirements:</h4>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                <li>Evolution API must be running and accessible</li>
                <li>WhatsApp account with active phone number</li>
                <li>Phone must stay connected (like WhatsApp Web)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => router.push('/admin/booking/calls')} 
              variant="outline"
              className="w-full justify-start"
            >
              📊 View WhatsApp Conversations
            </Button>
            <Button 
              onClick={() => router.push('/setup/whatsapp')} 
              variant="outline"
              className="w-full justify-start"
            >
              🔧 Setup/Reconnect WhatsApp
            </Button>
            <Button 
              onClick={() => router.push('/admin')} 
              variant="outline"
              className="w-full justify-start"
            >
              🏠 Back to Dashboard
            </Button>
          </CardContent>
        </Card>

        {/* Troubleshooting Card */}
        <Card>
          <CardHeader>
            <CardTitle>Troubleshooting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <p className="font-semibold">Connection shows "Disconnected":</p>
              <ul className="list-disc list-inside ml-4">
                <li>Check if Evolution API is running</li>
                <li>Verify your phone has internet connection</li>
                <li>Try reconnecting via the setup wizard</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold">Messages not being received:</p>
              <ul className="list-disc list-inside ml-4">
                <li>Confirm webhook URL is configured correctly</li>
                <li>Check Evolution API logs for errors</li>
                <li>Verify WhatsApp is still linked (not logged out)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold">QR code expired:</p>
              <ul className="list-inside ml-4">
                <li>QR codes expire after a few minutes</li>
                <li>Go to setup wizard to generate a new QR code</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


