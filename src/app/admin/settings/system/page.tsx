'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brain, Calendar, Shield, Eye, EyeOff, Save, Check, RefreshCw, AlertCircle, X } from 'lucide-react';
import { useOrganization } from '@/app/contexts/OrganizationContext';

const SYSTEM_INTEGRATIONS = {
  openai: {
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o-mini, Realtime API for voice',
    icon: Brain,
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-proj-...', required: true, helpText: 'Get from platform.openai.com/api-keys' },
    ],
    credentialType: 'openai',
  },
  anthropic: {
    name: 'Anthropic',
    description: 'Claude AI models',
    icon: Brain,
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-ant-api03-...', required: true, helpText: 'Get from console.anthropic.com' },
    ],
    credentialType: 'anthropic',
  },
  google_calendar_system: {
    name: 'Google Calendar (OAuth App)',
    description: 'Client ID & Secret from one Google Cloud project. Shared by all orgs.',
    icon: Calendar,
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', placeholder: '...apps.googleusercontent.com', required: true, helpText: 'From Google Cloud Console' },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: 'GOCSPX-...', required: true, helpText: 'Add redirect URI: [your-site]/api/integrations/google-calendar/oauth/callback' },
    ],
    credentialType: 'google_calendar',
  },
};

type SystemIntegrationKey = keyof typeof SYSTEM_INTEGRATIONS;

export default function SystemSettingsPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const isSystemOrgOwner = currentOrganization?.is_system_org && currentOrganization?.role === 'owner';

  const [credentials, setCredentials] = useState<Record<string, any>>({});
  const [editingValues, setEditingValues] = useState<Record<string, Record<string, string>>>({});
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!isSystemOrgOwner) {
      router.replace('/admin/settings');
      return;
    }
    fetchData();
  }, [isSystemOrgOwner, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/api-credentials');
      const data = await res.json();
      if (data.success && data.credentials) {
        const credMap: Record<string, any> = {};
        const editMap: Record<string, Record<string, string>> = {};
        data.credentials.forEach((cred: any) => {
          const isSystem = cred.organization_id === null;
          if (cred.credential_type === 'google_calendar' && isSystem) {
            credMap['google_calendar_system'] = cred;
            editMap['google_calendar_system'] = { ...cred.credentials };
          } else if (['openai', 'anthropic'].includes(cred.credential_type) && isSystem) {
            credMap[cred.credential_type] = cred;
            editMap[cred.credential_type] = { ...cred.credentials };
          }
        });
        setCredentials(credMap);
        Object.keys(SYSTEM_INTEGRATIONS).forEach(k => {
          if (!editMap[k]) editMap[k] = credMap[k] ? { ...credMap[k].credentials } : {};
        });
        setEditingValues(editMap);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: SystemIntegrationKey) => {
    const config = SYSTEM_INTEGRATIONS[key];
    const values = editingValues[key] || {};
    setSaving(key);
    setMessage(null);
    try {
      const payload = {
        credential_type: config.credentialType,
        credential_name: config.name,
        description: config.description,
        credentials: values,
        is_default: true,
        is_system: true,
      };
      const url = credentials[key]?.id ? `/api/admin/api-credentials/${credentials[key].id}` : '/api/admin/api-credentials';
      const res = await fetch(url, {
        method: credentials[key]?.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `${config.name} saved` });
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSaving(null);
    }
  };

  const handleTest = async (key: SystemIntegrationKey) => {
    const cred = credentials[key];
    if (!cred?.id) {
      setTestResults(prev => ({ ...prev, [key]: { success: false, message: 'Save first' } }));
      return;
    }
    setTesting(key);
    try {
      const res = await fetch('/api/admin/api-credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId: cred.id }),
      });
      const data = await res.json();
      setTestResults(prev => ({ ...prev, [key]: { success: data.success, message: data.message || (data.success ? 'OK' : 'Failed') } }));
    } catch {
      setTestResults(prev => ({ ...prev, [key]: { success: false, message: 'Network error' } }));
    } finally {
      setTesting(null);
    }
  };

  if (!isSystemOrgOwner) return null;
  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 rounded-lg" />
          <div className="h-32 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-7 h-7 text-blue-600" />
          System Settings
        </h1>
        <p className="text-gray-600 mt-1">Platform-wide configuration. Shared by all organizations.</p>
        <p className="text-sm text-amber-600 mt-2 bg-amber-50 border border-amber-200 rounded p-2">
          Only visible to the owner of the system org ({currentOrganization?.name}).
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg border flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          {message.type === 'success' ? <Check className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="space-y-3">
        {Object.entries(SYSTEM_INTEGRATIONS).map(([key, config]) => {
          const Icon = config.icon;
          const cred = credentials[key];
          const isConfigured = !!cred?.credentials && Object.values(cred.credentials).some((v: any) => v);
          const values = editingValues[key] ?? cred?.credentials ?? {};
          const isExpanded = expanded === key;

          return (
            <Card key={key} className={isExpanded ? 'ring-2 ring-blue-500' : ''}>
              <div
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(isExpanded ? null : key)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-lg ${isConfigured ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Icon className={`w-5 h-5 ${isConfigured ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{config.name}</h3>
                      <p className="text-sm text-gray-500">{config.description}</p>
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">{isConfigured ? 'Configured' : 'Not configured'}</span>
                </div>
              </div>

              {isExpanded && (
                <CardContent className="border-t pt-4 space-y-4">
                  {config.fields.map(field => {
                    const isSecret = field.type === 'password';
                    const fieldKey = `${key}-${field.key}`;
                    const isVisible = visibleFields[fieldKey];
                    return (
                      <div key={field.key} className="space-y-1.5">
                        <Label>{field.label} {field.required && '*'}</Label>
                        <div className="relative">
                          <Input
                            type={isSecret && !isVisible ? 'password' : 'text'}
                            value={values[field.key] || ''}
                            onChange={(e) => setEditingValues(prev => ({
                              ...prev, [key]: { ...(prev[key] || {}), [field.key]: e.target.value }
                            }))}
                            placeholder={field.placeholder}
                            className="pr-10"
                          />
                          {isSecret && (
                            <button
                              type="button"
                              onClick={() => setVisibleFields(p => ({ ...p, [fieldKey]: !p[fieldKey] }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                            >
                              {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                        {field.helpText && <p className="text-xs text-gray-500">{field.helpText}</p>}
                      </div>
                    );
                  })}

                  {testResults[key] && (
                    <div className={`p-3 rounded border text-sm ${testResults[key].success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      {testResults[key].message}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button onClick={() => handleSave(key)} disabled={saving === key}>
                      {saving === key ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Save
                    </Button>
                    <Button variant="outline" onClick={() => handleTest(key)} disabled={testing === key || !isConfigured}>
                      {testing === key ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                      Test
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
