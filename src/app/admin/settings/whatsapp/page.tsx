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
import { useOrganization } from '@/app/contexts/OrganizationContext';
import { MessageSquare, Phone, RefreshCw, Power, QrCode, Plus, ExternalLink } from 'lucide-react';

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

export default function WhatsAppSettingsPage() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [autoCreateAttempted, setAutoCreateAttempted] = useState(false);
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();
  
  const currentOrgId = currentOrganization?.id || '';

  useEffect(() => {
    if (currentOrgId) {
      loadData();
    }
  }, [currentOrgId]);

  const loadData = async (skipAutoCreate = false) => {
    try {
      setLoading(true);
      
      if (!currentOrgId) {
        setLoading(false);
        return;
      }
      
      const instancesRes = await fetch('/api/admin/whatsapp/instances');
      const instancesData = await instancesRes.json();
      const allInstances = instancesData.instances || [];
      setInstances(allInstances);

      // Auto-create instance if current org doesn't have one (only on first load)
      if (!skipAutoCreate && !autoCreateAttempted) {
        const orgHasInstance = allInstances.some((inst: WhatsAppInstance) => 
          inst.organization_id === currentOrgId
        );

        if (!orgHasInstance && !creating) {
          setAutoCreateAttempted(true);
          await autoCreateInstance(currentOrgId);
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
      
      const response = await fetch('/api/admin/whatsapp/create-instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create instance');
      }
      
      toast({
        title: 'Success!',
        description: 'WhatsApp instance created. Scan the QR code to connect.',
      });
      
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
    if (!currentOrgId) {
      toast({
        title: 'Error',
        description: 'No organization found',
        variant: 'destructive',
      });
      return;
    }

    await autoCreateInstance(currentOrgId);
  };

  const refreshQRCode = async (instanceId: string) => {
    try {
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
    const config: Record<string, { variant: any; label: string; className: string }> = {
      connected: { variant: 'default', label: 'Connected', className: 'bg-green-100 text-green-700' },
      connecting: { variant: 'secondary', label: 'Connecting...', className: 'bg-yellow-100 text-yellow-700' },
      qr_code: { variant: 'secondary', label: 'Scan QR Code', className: 'bg-blue-100 text-blue-700' },
      disconnected: { variant: 'outline', label: 'Disconnected', className: 'bg-gray-100 text-gray-600' },
      failed: { variant: 'destructive', label: 'Failed', className: 'bg-red-100 text-red-700' },
    };

    const cfg = config[status] || config.disconnected;

    return (
      <Badge className={cfg.className}>
        {cfg.label}
      </Badge>
    );
  };

  if (loading || creating) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">WhatsApp Integration</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">
            {creating ? 'Setting up your WhatsApp instance...' : 'Loading instances...'}
          </span>
        </div>
      </div>
    );
  }

  const currentOrgInstances = instances.filter(inst => inst.organization_id === currentOrgId);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Integration</h1>
        <p className="text-gray-600 mt-1">
          Connect and manage WhatsApp Business numbers via Evolution API
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{currentOrgInstances.length}</p>
                <p className="text-xs text-gray-500">Instances</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Phone className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {currentOrgInstances.filter(i => i.status === 'connected').length}
                </p>
                <p className="text-xs text-gray-500">Connected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div>
              <p className="text-2xl font-bold">
                {currentOrgInstances.reduce((sum, i) => sum + i.messages_sent, 0)}
              </p>
              <p className="text-xs text-gray-500">Messages Sent</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div>
              <p className="text-2xl font-bold">
                {currentOrgInstances.reduce((sum, i) => sum + i.messages_received, 0)}
              </p>
              <p className="text-xs text-gray-500">Messages Received</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={() => loadData(true)} variant="outline" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        
        {currentOrgInstances.length === 0 && (
          <Button onClick={manualCreateInstance} disabled={creating}>
            <Plus className="w-4 h-4 mr-2" />
            Create WhatsApp Instance
          </Button>
        )}
      </div>

      {/* Instances List */}
      {currentOrgInstances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No WhatsApp Instance</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Create a WhatsApp instance to connect your business number and start receiving messages
            </p>
            <Button onClick={manualCreateInstance} size="lg" disabled={creating}>
              <Plus className="w-4 h-4 mr-2" />
              Create WhatsApp Instance
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {currentOrgInstances.map((instance) => (
            <Card key={instance.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-green-600" />
                      {instance.phone_number || instance.instance_name}
                      {getStatusBadge(instance.status)}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Instance: {instance.instance_name}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {instance.status === 'qr_code' && (
                      <Button variant="outline" size="sm" onClick={() => refreshQRCode(instance.id)}>
                        <QrCode className="w-4 h-4 mr-1" />
                        Refresh QR
                      </Button>
                    )}
                    {instance.status === 'connected' && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => restartInstance(instance.id)}>
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Restart
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => disconnectInstance(instance.id)}>
                          <Power className="w-4 h-4 mr-1" />
                          Disconnect
                        </Button>
                      </>
                    )}
                    {instance.status === 'disconnected' && (
                      <Button variant="outline" size="sm" onClick={() => refreshQRCode(instance.id)}>
                        <QrCode className="w-4 h-4 mr-1" />
                        Get QR Code
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Messages Sent</p>
                    <p className="font-semibold">{instance.messages_sent.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Messages Received</p>
                    <p className="font-semibold">{instance.messages_received.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Active Chats</p>
                    <p className="font-semibold">{instance.active_conversations || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Connected Since</p>
                    <p className="font-semibold">
                      {instance.connected_at
                        ? new Date(instance.connected_at).toLocaleDateString()
                        : 'Not connected'}
                    </p>
                  </div>
                </div>

                {/* QR Code Display */}
                {instance.status === 'qr_code' && instance.qr_code && (
                  <div className="mt-6 p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
                    <h4 className="font-semibold mb-2 text-blue-900 flex items-center gap-2">
                      <QrCode className="w-5 h-5" />
                      Scan QR Code to Connect
                    </h4>
                    <p className="text-sm text-blue-700 mb-4">
                      Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
                    </p>
                    <div className="flex justify-center">
                      <img
                        src={instance.qr_code}
                        alt="QR Code"
                        className="w-64 h-64 bg-white p-4 rounded-lg border-2 border-gray-200"
                        style={{ filter: 'grayscale(100%) contrast(1.2)' }}
                      />
                    </div>
                    {instance.qr_code_expires_at && (
                      <p className="text-xs text-center mt-3 text-blue-600">
                        Expires: {new Date(instance.qr_code_expires_at).toLocaleTimeString()}
                      </p>
                    )}
                    <div className="mt-3 text-center">
                      <Button variant="link" size="sm" onClick={() => refreshQRCode(instance.id)}>
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Refresh QR Code
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Help Card */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="text-base">Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <p>
            <strong>Evolution API</strong> is required to connect WhatsApp Business numbers.
            Make sure you have configured the Evolution API credentials in the Integrations page.
          </p>
          <Button variant="link" className="p-0 h-auto" asChild>
            <a href="/admin/settings/integrations">
              <ExternalLink className="w-3 h-3 mr-1" />
              Go to Integrations
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
