'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plug,
  Database, 
  Phone,
  MessageSquare,
  Calendar,
  Brain,
  Mic,
  Settings, 
  Check, 
  X,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Plus
} from 'lucide-react';

// System vs org: Platform credentials are one-time, shared across all orgs. Org credentials are per-tenant.
type IntegrationLevel = 'system' | 'org' | 'mixed';

interface IntegrationConfig {
  name: string;
  description: string;
  icon: any;
  required?: boolean;
  category: string;
  level: IntegrationLevel;
  credentialType?: string;
  fields: Array<{ key: string; label: string; type: string; placeholder: string; required: boolean; helpText?: string; options?: string[] }>;
  testEndpoint?: string;
  hasSyncConfig?: boolean;
  hasOAuthConnect?: boolean;
  systemFields?: string[];
  orgFields?: string[];
}

// Org-only integrations. Platform (OpenAI, Anthropic, Google OAuth App) are in System Settings.
const INTEGRATION_CONFIGS: Record<string, IntegrationConfig> = {
  twilio: {
    name: 'Twilio',
    description: 'Voice calls and SMS messaging',
    icon: Phone,
    required: false,
    category: 'Organization',
    level: 'org',
    fields: [
      { key: 'account_sid', label: 'Account SID', type: 'text', placeholder: 'AC...', required: true, helpText: 'From Twilio Console Dashboard' },
      { key: 'auth_token', label: 'Auth Token', type: 'password', placeholder: 'Your auth token', required: true },
      { key: 'phone_number', label: 'Phone Number', type: 'text', placeholder: '+1234567890', required: true, helpText: 'E.164 format with country code' },
      { key: 'websocket_url', label: 'WebSocket URL', type: 'url', placeholder: 'wss://your-server.com/twilio-media-stream', required: false, helpText: 'For real-time voice streaming' },
    ],
    testEndpoint: '/api/admin/api-credentials/test',
  },
  evolution_api: {
    name: 'WhatsApp (Evolution API)',
    description: 'WhatsApp messaging integration',
    icon: MessageSquare,
    required: false,
    category: 'Organization',
    level: 'org',
    fields: [
      { key: 'api_url', label: 'API URL', type: 'url', placeholder: 'https://api.evolution.com', required: true },
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Your Evolution API key', required: true },
      { key: 'instance_name', label: 'Instance Name', type: 'text', placeholder: 'default', required: false, helpText: 'WhatsApp instance name' },
    ],
    testEndpoint: '/api/admin/api-credentials/test',
  },
  opendental: {
    name: 'OpenDental',
    description: 'Dental practice management system',
    icon: Database,
    required: false,
    category: 'Organization',
    level: 'org',
    hasSyncConfig: true,
    fields: [
      { key: 'api_url', label: 'API Base URL', type: 'url', placeholder: 'https://api.opendental.com/api/v1/', required: true },
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'ODFHIR your-key-here', required: true, helpText: 'ODFHIR format from OpenDental' },
      { key: 'mock_mode', label: 'Mock Mode', type: 'select', options: ['false', 'true'], required: false, helpText: 'Use mock data instead of real API' },
    ],
    testEndpoint: '/api/admin/api-credentials/test',
  },
  retell: {
    name: 'Retell AI',
    description: 'Voice AI platform for phone calls',
    icon: Mic,
    required: false,
    category: 'Organization',
    level: 'org',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'key_...', required: true },
      { key: 'agent_id', label: 'Agent ID', type: 'text', placeholder: 'agent_...', required: false, helpText: 'Default Retell agent to use' },
      { key: 'websocket_port', label: 'WebSocket Port', type: 'text', placeholder: '8080', required: false, helpText: 'Default: 8080' },
    ],
    testEndpoint: '/api/admin/api-credentials/test',
  },
  google_calendar: {
    name: 'Google Calendar (Connect)',
    description: 'Connect this org\'s Google Calendar. Requires OAuth App in System Settings first.',
    icon: Calendar,
    required: false,
    category: 'Organization',
    level: 'org',
    hasSyncConfig: true,
    hasOAuthConnect: true,
    fields: [
      { key: 'refresh_token', label: 'Refresh Token', type: 'password', placeholder: 'Click Connect below', required: false, helpText: 'Obtained via Connect Google Calendar button (OAuth)' },
      { key: 'calendar_id', label: 'Calendar ID', type: 'text', placeholder: 'primary', required: false, helpText: 'Default: primary calendar' },
    ],
    testEndpoint: '/api/integrations/google-calendar',
  },
};

type IntegrationType = keyof typeof INTEGRATION_CONFIGS;

interface CredentialData {
  id?: string;
  credential_type: string;
  credential_name: string;
  credentials: Record<string, string>;
  is_active: boolean;
  is_default: boolean;
}

interface SyncConfig {
  id: string;
  sync_enabled: boolean;
  sync_direction: string;
  sync_on_create: boolean;
  sync_on_update: boolean;
  sync_on_delete: boolean;
  always_keep_local_copy: boolean;
  conflict_resolution: string;
  last_sync_at?: string;
  last_sync_status?: string;
}

export default function IntegrationsPage() {
  const [credentials, setCredentials] = useState<Record<string, CredentialData>>({});
  const [syncConfigs, setSyncConfigs] = useState<Record<string, SyncConfig>>({});
  const [loading, setLoading] = useState(true);
  const [expandedIntegration, setExpandedIntegration] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, Record<string, string>>>({});
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [hasGoogleOAuthAppConfigured, setHasGoogleOAuthAppConfigured] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gcalSuccess = params.get('gcal_success');
    const gcalError = params.get('gcal_error');
    if (gcalSuccess) {
      setMessage({ type: 'success', text: 'Google Calendar connected successfully!' });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (gcalError) {
      setMessage({ type: 'error', text: decodeURIComponent(gcalError) });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch credentials, sync configs, and Google OAuth app status (for non-system-org Connect button)
      const [credResponse, syncResponse, oauthStatusResponse] = await Promise.all([
        fetch('/api/admin/api-credentials'),
        fetch('/api/admin/integration-settings'),
        fetch('/api/integrations/google-calendar/oauth-status')
      ]);

      const [credData, syncData, oauthStatusData] = await Promise.all([
        credResponse.json(),
        syncResponse.json(),
        oauthStatusResponse.json()
      ]);

      if (oauthStatusData.success && oauthStatusData.configured) {
        setHasGoogleOAuthAppConfigured(true);
      }
      
      // Process credentials: map by config key (e.g. google_calendar_system, google_calendar, openai)
      if (credData.success && credData.credentials) {
        const credMap: Record<string, CredentialData> = {};
        const editMap: Record<string, Record<string, string>> = {};

        credData.credentials.forEach((cred: CredentialData & { organization_id?: string | null }) => {
          const isSystem = cred.organization_id === null;
          // Map credential_type to our config keys
          if (cred.credential_type === 'google_calendar') {
            const key = isSystem ? 'google_calendar_system' : 'google_calendar';
            credMap[key] = cred;
            editMap[key] = { ...cred.credentials };
          } else {
            const key = cred.credential_type;
            if (isSystem || !credMap[key]) {
              credMap[key] = cred;
              editMap[key] = { ...cred.credentials };
            }
          }
        });
        setCredentials(credMap);

        Object.keys(INTEGRATION_CONFIGS).forEach((key) => {
          if (!editMap[key]) editMap[key] = credMap[key] ? { ...credMap[key].credentials } : {};
        });
        setEditingValues(editMap);
      }

      // Process sync configs
      if (syncData.success && syncData.configs) {
        const syncMap: Record<string, SyncConfig> = {};
        syncData.configs.forEach((config: any) => {
          if (config.external_integrations?.provider_key) {
            syncMap[config.external_integrations.provider_key] = config;
          }
        });
        setSyncConfigs(syncMap);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (type: string) => {
    if (expandedIntegration === type) {
      setExpandedIntegration(null);
    } else {
      setExpandedIntegration(type);
      // Initialize editing values if not exists
      if (!editingValues[type]) {
        setEditingValues(prev => ({
          ...prev,
          [type]: credentials[type]?.credentials || {}
        }));
      }
    }
  };

  const handleFieldChange = (type: string, field: string, value: string) => {
    setEditingValues(prev => ({
      ...prev,
      [type]: {
        ...(prev[type] || {}),
        [field]: value
      }
    }));
  };

  const toggleFieldVisibility = (key: string) => {
    setVisibleFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async (type: IntegrationType) => {
    setSaving(type);
    setMessage(null);

    try {
      const config = INTEGRATION_CONFIGS[type];
      const existingCred = credentials[type];
      const values = editingValues[type] || {};
      const credentialType = config.credentialType || type;
      const isSystem = config.level === 'system';

      const payload = {
        credential_type: credentialType,
        credential_name: config.name,
        description: config.description,
        credentials: values,
        is_default: true,
        is_system: isSystem,
      };

      const url = existingCred?.id 
        ? `/api/admin/api-credentials/${existingCred.id}`
        : '/api/admin/api-credentials';

      const response = await fetch(url, {
        method: existingCred?.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      console.log('[Integrations] Save response:', data);

      if (data.success) {
        setMessage({ type: 'success', text: `${config.name} configuration saved` });
        fetchData(); // Refresh data
      } else {
        console.error('[Integrations] Save failed:', data);
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save configuration' });
    } finally {
      setSaving(null);
    }
  };

  const handleTest = async (type: IntegrationType) => {
    setTesting(type);
    setTestResults(prev => ({ ...prev, [type]: { success: false, message: 'Testing...' } }));

    try {
      const existingCred = credentials[type];
      
      if (!existingCred?.id) {
        setTestResults(prev => ({
          ...prev,
          [type]: { success: false, message: 'Save configuration first before testing' }
        }));
        return;
      }

      const response = await fetch('/api/admin/api-credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId: existingCred.id }),
      });

      const data = await response.json();

      setTestResults(prev => ({
        ...prev,
        [type]: {
          success: data.success,
          message: data.message || (data.success ? 'Connection successful!' : 'Connection failed')
        }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [type]: { success: false, message: 'Test failed: Network error' }
      }));
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (type: IntegrationType) => {
    const config = INTEGRATION_CONFIGS[type];
    const existingCred = credentials[type];
    
    if (!existingCred?.id) return;
    
    if (!confirm(`Delete ${config.name} configuration? This cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/admin/api-credentials/${existingCred.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `${config.name} configuration deleted` });
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to delete' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete configuration' });
    }
  };

  const updateSyncConfig = async (type: string, updates: Partial<SyncConfig>) => {
    const config = syncConfigs[type];
    if (!config?.id) return;

    try {
      const response = await fetch(`/api/admin/integration-settings/${config.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to update sync config:', error);
    }
  };

  const maskValue = (value: string) => {
    if (!value) return '';
    if (value.length <= 8) return '••••••••';
    return `${value.substring(0, 4)}${'•'.repeat(Math.min(20, value.length - 8))}${value.substring(value.length - 4)}`;
  };

  // Group integrations by category
  const categories = Object.entries(INTEGRATION_CONFIGS).reduce((acc, [key, config]) => {
    const cat = config.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push({ key, ...config });
    return acc;
  }, {} as Record<string, Array<{ key: string } & typeof INTEGRATION_CONFIGS[IntegrationType]>>);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Integrations</h1>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-600 mt-1">Configure all external service connections</p>
          <p className="text-sm text-gray-500 mt-2">
            Org-specific credentials. Platform config (OpenAI, Anthropic, Google OAuth) is in System Settings (system org owner only).
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg border flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
          <button 
            onClick={() => setMessage(null)}
            className="ml-auto text-current opacity-60 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Integrations by Category */}
      {Object.entries(categories).map(([category, integrations]) => (
        <div key={category} className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{category}</h2>
          
          <div className="space-y-3">
            {integrations.map(integration => {
              const Icon = integration.icon;
              const isExpanded = expandedIntegration === integration.key;
              const cred = credentials[integration.key];
              const isConfigured = !!cred?.credentials && Object.values(cred.credentials).some(v => v);
              const syncConfig = syncConfigs[integration.key];
              const values = editingValues[integration.key] ?? cred?.credentials ?? {};

              return (
                <Card key={integration.key} className={`transition-all ${isExpanded ? 'ring-2 ring-blue-500' : ''}`}>
                  {/* Header - Always visible */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleExpand(integration.key)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-lg ${isConfigured ? 'bg-green-100' : 'bg-gray-100'}`}>
                          <Icon className={`w-5 h-5 ${isConfigured ? 'text-green-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold flex items-center gap-2">
                            {integration.name}
                            {integration.required && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Required</span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-500">{integration.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {isConfigured ? (
                          <span className="flex items-center gap-1.5 text-sm text-green-600">
                            <CheckCircle2 className="w-4 h-4" />
                            Configured
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-sm text-gray-400">
                            <AlertCircle className="w-4 h-4" />
                            Not configured
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <CardContent className="border-t pt-4 space-y-6">
                      {/* Credential Fields */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900">Configuration</h4>
                        
                        {integration.fields.map(field => {
                          const fieldKey = `${integration.key}-${field.key}`;
                          const isSecret = field.type === 'password';
                          const isVisible = visibleFields[fieldKey];
                          const value = values[field.key] || '';

                          return (
                            <div key={field.key} className="space-y-1.5">
                              <Label className="flex items-center gap-1">
                                {field.label}
                                {field.required && <span className="text-red-500">*</span>}
                              </Label>
                              
                              {field.type === 'select' ? (
                                <Select
                                  value={value || ('options' in field ? (field as any).options?.[0] : undefined)}
                                  onValueChange={(v) => handleFieldChange(integration.key, field.key, v)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {('options' in field && (field as any).options) && (field as any).options.map((opt: string) => (
                                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="relative">
                                  <Input
                                    type={isSecret && !isVisible ? 'password' : 'text'}
                                    value={value}
                                    onChange={(e) => handleFieldChange(integration.key, field.key, e.target.value)}
                                    placeholder={field.placeholder}
                                    className="pr-10"
                                  />
                                  {isSecret && (
                                    <button
                                      type="button"
                                      onClick={() => toggleFieldVisibility(fieldKey)}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                    >
                                      {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                  )}
                                </div>
                              )}
                              
                              {field.helpText && (
                                <p className="text-xs text-gray-500">{field.helpText}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Sync Configuration (for integrations that support it) */}
                      {('hasSyncConfig' in integration && (integration as any).hasSyncConfig) && syncConfig && (
                        <div className="space-y-4 pt-4 border-t">
                          <h4 className="font-medium text-gray-900">Sync Settings</h4>
                          
                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <Label>Enable Sync</Label>
                              <p className="text-xs text-gray-500">Synchronize data with {integration.name}</p>
                            </div>
                            <Button
                              variant={syncConfig.sync_enabled ? "destructive" : "default"}
                              size="sm"
                              onClick={() => updateSyncConfig(integration.key, { sync_enabled: !syncConfig.sync_enabled })}
                            >
                              {syncConfig.sync_enabled ? 'Disable' : 'Enable'}
                            </Button>
                          </div>

                          {syncConfig.sync_enabled && (
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <Label>Sync Direction</Label>
                                <Select
                                  value={syncConfig.sync_direction}
                                  onValueChange={(v) => updateSyncConfig(integration.key, { sync_direction: v })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="local_only">Local Only (no sync)</SelectItem>
                                    <SelectItem value="to_external">To External (dual-write)</SelectItem>
                                    <SelectItem value="from_external">From External (pull)</SelectItem>
                                    <SelectItem value="bidirectional">Bidirectional</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {syncConfig.last_sync_at && (
                                <p className="text-xs text-gray-500">
                                  Last sync: {new Date(syncConfig.last_sync_at).toLocaleString()}
                                  {syncConfig.last_sync_status && (
                                    <span className={`ml-2 ${syncConfig.last_sync_status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                      ({syncConfig.last_sync_status})
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Test Result */}
                      {testResults[integration.key] && (
                        <div className={`p-3 rounded-lg border ${
                          testResults[integration.key].success 
                            ? 'bg-green-50 border-green-200 text-green-800' 
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                          <div className="flex items-center gap-2">
                            {testResults[integration.key].success ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <AlertTriangle className="w-4 h-4" />
                            )}
                            <span className="text-sm">{testResults[integration.key].message}</span>
                          </div>
                        </div>
                      )}

                      {/* Google Calendar OAuth Connect */}
                      {integration.key === 'google_calendar' && ('hasOAuthConnect' in integration && (integration as any).hasOAuthConnect) && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                          <p className="text-sm text-blue-800 font-medium">OAuth Connection</p>
                          <p className="text-xs text-blue-700">
                            Save Client ID and Client Secret first, then click Connect to authorize via Google.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-300 text-blue-700 hover:bg-blue-100"
                            onClick={async () => {
                              const systemCred = credentials.google_calendar_system;
                              const hasClientCredsInUI = (systemCred?.credentials?.client_id && systemCred?.credentials?.client_secret)
                                || (cred?.credentials?.client_id && cred?.credentials?.client_secret);
                              if (!hasClientCredsInUI && !hasGoogleOAuthAppConfigured) {
                                setMessage({ type: 'error', text: 'Configure Google Calendar (OAuth App) in System Settings first' });
                                return;
                              }
                              try {
                                const res = await fetch('/api/integrations/google-calendar/oauth', { method: 'POST' });
                                const data = await res.json();
                                if (data.success && data.authUrl) {
                                  window.location.href = data.authUrl;
                                } else {
                                  setMessage({ type: 'error', text: data.error || 'Failed to start OAuth' });
                                }
                              } catch {
                                setMessage({ type: 'error', text: 'Failed to connect to server' });
                              }
                            }}
                          >
                            <Plug className="w-4 h-4 mr-2" />
                            Connect Google Calendar
                          </Button>
                          {syncConfig?.sync_enabled && (syncConfig.sync_direction === 'from_external' || syncConfig.sync_direction === 'bidirectional') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-2 border-gray-300"
                              onClick={async () => {
                                try {
                                  const res = await fetch('/api/integrations/google-calendar', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'include',
                                    body: JSON.stringify({ action: 'syncFromGoogle' }),
                                  });
                                  const data = await res.json();
                                  if (data.success) {
                                    setMessage({ type: 'success', text: `Synced: ${data.created} created, ${data.updated} updated, ${data.cancelled} cancelled` });
                                    fetchData();
                                  } else {
                                    setMessage({ type: 'error', text: data.error || 'Sync failed' });
                                  }
                                } catch (e) {
                                  setMessage({ type: 'error', text: 'Sync request failed' });
                                }
                              }}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Sync from Google
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-3 pt-4 border-t">
                        <Button 
                          onClick={() => handleSave(integration.key as IntegrationType)}
                          disabled={saving === integration.key}
                        >
                          {saving === integration.key ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Save
                        </Button>
                        
                        <Button 
                          variant="outline"
                          onClick={() => handleTest(integration.key as IntegrationType)}
                          disabled={testing === integration.key || !isConfigured}
                        >
                          {testing === integration.key ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 mr-2" />
                          )}
                          Test Connection
                        </Button>

                        {isConfigured && (
                          <Button 
                            variant="outline"
                            onClick={() => handleDelete(integration.key as IntegrationType)}
                            className="ml-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Help Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Plug className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Quick Start:</strong>
              <ol className="mt-2 ml-4 list-decimal space-y-1">
                <li>Click on an integration to expand it</li>
                <li>Fill in the required fields (marked with *)</li>
                <li>Click Save to store the configuration</li>
                <li>Click Test Connection to verify it works</li>
                <li><strong>Platform</strong> configs (OpenAI, Anthropic, Google OAuth App) apply to all orgs – set once</li>
                <li>You must be <strong>Owner</strong> or <strong>Admin</strong> to save</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
