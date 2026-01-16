'use client';

/**
 * WhatsApp Instances Admin Interface
 * 
 * Manage WhatsApp numbers connected via Evolution API
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppInstance {
  id: string;
  organization_id: string;
  organization_name?: string;
  instance_name: string;
  phone_number?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'failed' | 'qr_code';
  qr_code?: string;
  qr_code_expires_at?: string;
  connected_at?: string;
  messages_sent: number;
  messages_received: number;
  active_conversations?: number;
  is_active?: boolean;
  created_at: string;
}

export default function WhatsAppAdminPage() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [currentOrgId, setCurrentOrgId] = useState<string>('');
  const [autoCreateAttempted, setAutoCreateAttempted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (skipAutoCreate = false) => {
    try {
      setLoading(true);
      
      // Load current org and instances
      const [currentOrgRes, instancesRes] = await Promise.all([
        fetch('/api/admin/current-org'),
        fetch('/api/admin/whatsapp/instances'),
      ]);

      // Get current organization
      let orgId = '';
      if (currentOrgRes.ok) {
        const currentOrgData = await currentOrgRes.json();
        console.log('📡 Current org response:', currentOrgData);
        
        // API returns { success: true, organization: { id, name, ... } }
        orgId = currentOrgData.organization?.id || '';
        setCurrentOrgId(orgId);
        console.log('✅ Current org ID extracted:', orgId);
      } else {
        console.error('❌ Failed to get current org, status:', currentOrgRes.status);
      }

      const instancesData = await instancesRes.json();
      const allInstances = instancesData.instances || [];
      setInstances(allInstances);
      console.log('📦 All instances:', allInstances);
      
      console.log('📊 Found instances:', allInstances.length, 'for org:', orgId);

      // Auto-create instance if current org doesn't have one (only on first load)
      if (orgId && !skipAutoCreate && !autoCreateAttempted) {
        const orgHasInstance = allInstances.some((inst: WhatsAppInstance) => 
          inst.organization_id === orgId
        );

        if (!orgHasInstance && !creating) {
          console.log('📱 No instance found for current org, auto-creating...');
          setAutoCreateAttempted(true);
          await autoCreateInstance(orgId);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load WhatsApp instances',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const autoCreateInstance = async (organizationId: string) => {
    try {
      setCreating(true);
      console.log('🔨 Creating instance for org:', organizationId);
      
      const response = await fetch('/api/admin/whatsapp/create-instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Create failed:', data.error);
        throw new Error(data.error || 'Failed to create instance');
      }

      console.log('✅ Instance created successfully:', data);
      
      toast({
        title: 'Success!',
        description: 'WhatsApp instance created. Scan the QR code to connect.',
      });
      
      // Reload to show the new instance (skip auto-create)
      await loadData(true);
    } catch (error: any) {
      console.error('Auto-create instance error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Could not create WhatsApp instance',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const manualCreateInstance = async () => {
    console.log('🎯 Manual create clicked, currentOrgId:', currentOrgId);
    
    if (!currentOrgId) {
      console.error('❌ No org ID found!');
      toast({
        title: 'Error',
        description: 'No organization found',
        variant: 'destructive',
      });
      return;
    }

    console.log('▶️ Calling autoCreateInstance...');
    await autoCreateInstance(currentOrgId);
  };

  const refreshQRCode = async (instanceId: string) => {
    try {
      console.log('🔄 Refreshing QR for instance:', instanceId);
      
      const response = await fetch(`/api/admin/whatsapp/${instanceId}/refresh-qr`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh QR code');
      }

      toast({
        title: 'Success',
        description: 'QR code refreshed',
      });

      await loadData(true);
    } catch (error: any) {
      console.error('❌ Refresh QR error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const restartInstance = async (instanceId: string) => {
    try {
      const response = await fetch(`/api/admin/whatsapp/${instanceId}/restart`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to restart instance');
      }

      toast({
        title: 'Success',
        description: 'Instance restarted',
      });

      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const disconnectInstance = async (instanceId: string) => {
    if (!confirm('Are you sure you want to disconnect this WhatsApp number?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/whatsapp/${instanceId}/disconnect`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disconnect instance');
      }

      toast({
        title: 'Success',
        description: data.message || 'Instance disconnected',
      });

      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      connected: 'default',
      connecting: 'secondary',
      qr_code: 'secondary',
      disconnected: 'outline',
      failed: 'destructive',
    };

    const labels: Record<string, string> = {
      connected: '✅ Connected',
      connecting: '🔄 Connecting',
      qr_code: '📱 Scan QR Code',
      disconnected: '⭕ Disconnected',
      failed: '❌ Failed',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading || creating) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">WhatsApp Integration</h1>
        <p>{creating ? 'Setting up your WhatsApp instance...' : 'Loading instances...'}</p>
      </div>
    );
  }

  // Filter to show only current org's instance
  const currentOrgInstances = instances.filter(inst => inst.organization_id === currentOrgId);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">WhatsApp Integration</h1>
        <p className="text-muted-foreground">
          Manage WhatsApp numbers connected via Evolution API
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Your Instances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{currentOrgInstances.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {currentOrgInstances.filter(i => i.status === 'connected').length > 0 ? '✅' : '📱'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Messages Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {currentOrgInstances.reduce((sum, i) => sum + i.messages_sent, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Messages Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {currentOrgInstances.reduce((sum, i) => sum + i.messages_received, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex gap-4">
        <Button onClick={() => loadData(true)} disabled={loading || creating}>
          🔄 Refresh
        </Button>
        
        {currentOrgInstances.length === 0 && (
          <Button onClick={manualCreateInstance} disabled={creating || loading}>
            {creating ? 'Creating Instance...' : '📱 Create WhatsApp Instance'}
          </Button>
        )}
      </div>

      {/* Instances List */}
      {currentOrgInstances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-6xl mb-4">📱</div>
            <h3 className="text-xl font-semibold mb-2">
              {creating ? 'Creating Your WhatsApp Instance...' : 'No WhatsApp Instance Found'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {creating 
                ? 'Please wait while we set up your WhatsApp connection...' 
                : 'Click the button below to create your WhatsApp instance'}
            </p>
            {!creating && (
              <Button onClick={manualCreateInstance} size="lg">
                📱 Create WhatsApp Instance
              </Button>
            )}
            {creating && (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {currentOrgInstances.map((instance) => (
            <Card key={instance.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      {instance.phone_number || instance.instance_name}
                      {getStatusBadge(instance.status)}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {instance.organization_name || instance.organization_id}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {instance.status === 'qr_code' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refreshQRCode(instance.id)}
                      >
                        🔄 Refresh QR
                      </Button>
                    )}
                    {instance.status === 'connected' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restartInstance(instance.id)}
                        >
                          🔄 Restart
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => disconnectInstance(instance.id)}
                        >
                          🔌 Disconnect
                        </Button>
                      </>
                    )}
                    {instance.status === 'disconnected' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refreshQRCode(instance.id)}
                      >
                        📱 Get QR Code
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground mb-1">Instance Name</div>
                    <div className="font-mono text-xs">{instance.instance_name}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Messages Sent</div>
                    <div className="font-semibold">{instance.messages_sent.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Messages Received</div>
                    <div className="font-semibold">{instance.messages_received.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Active Chats</div>
                    <div className="font-semibold">{instance.active_conversations || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Connected</div>
                    <div className="text-xs">
                      {instance.connected_at
                        ? new Date(instance.connected_at).toLocaleDateString()
                        : 'Not connected'}
                    </div>
                  </div>
                </div>

                {/* QR Code Display */}
                {instance.status === 'qr_code' && instance.qr_code && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-lg border-2 border-blue-200">
                    <h4 className="font-semibold mb-2 text-blue-900">📱 Scan QR Code to Connect</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
                    </p>
                    <div className="flex justify-center">
                      <img
                        src={instance.qr_code}
                        alt="QR Code"
                        className="w-64 h-64 bg-white p-4 rounded border-2 border-gray-200"
                        style={{ 
                          filter: 'grayscale(100%) contrast(1.2)',  // Makes QR code black for better scanning
                        }}
                      />
                    </div>
                    {instance.qr_code_expires_at && (
                      <p className="text-xs text-center mt-2 text-muted-foreground">
                        Expires: {new Date(instance.qr_code_expires_at).toLocaleTimeString()}
                      </p>
                    )}
                    <div className="mt-3 text-center">
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => refreshQRCode(instance.id)}
                      >
                        🔄 Refresh QR Code
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Documentation Link */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>📚 Documentation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            For detailed setup instructions, troubleshooting, and API documentation, see:
          </p>
          <div className="space-y-2">
            <div>
              <code className="text-sm bg-slate-100 px-3 py-1 rounded">
                /docs/WHATSAPP_QUICK_START.md
              </code>
              <span className="text-sm text-muted-foreground ml-2">- Quick setup guide</span>
            </div>
            <div>
              <code className="text-sm bg-slate-100 px-3 py-1 rounded">
                /docs/WHATSAPP-IMPLEMENTATION-PLAN.md
              </code>
              <span className="text-sm text-muted-foreground ml-2">- Complete technical docs</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
