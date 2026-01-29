'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Key, 
  Plus, 
  Eye, 
  EyeOff, 
  Trash2, 
  Check, 
  X, 
  Phone,
  Brain,
  MessageSquare,
  Database,
  AlertCircle,
  Calendar,
  Mic,
  Settings,
  RefreshCw,
  Pencil
} from 'lucide-react';

type CredentialType = 'openai' | 'anthropic' | 'twilio' | 'evolution_api' | 'opendental' | 'retell' | 'google_calendar' | 'other';

interface Credential {
  id: string;
  credential_type: CredentialType;
  credential_name: string;
  description?: string;
  credentials: Record<string, string>;
  is_active: boolean;
  is_default: boolean;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'textarea';
  placeholder: string;
  required: boolean;
  helpText?: string;
}

interface CredentialTemplate {
  fields: CredentialField[];
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  allowCustomFields: boolean;
}

const credentialTemplates: Record<CredentialType, CredentialTemplate> = {
  openai: {
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true, helpText: 'Get from platform.openai.com' },
    ],
    icon: Brain,
    label: 'OpenAI',
    description: 'GPT-4o, GPT-4o-mini models',
    allowCustomFields: true,
  },
  anthropic: {
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-ant-...', required: true, helpText: 'Get from console.anthropic.com' },
    ],
    icon: Brain,
    label: 'Anthropic',
    description: 'Claude models',
    allowCustomFields: true,
  },
  twilio: {
    fields: [
      { key: 'account_sid', label: 'Account SID', type: 'text', placeholder: 'AC...', required: true },
      { key: 'auth_token', label: 'Auth Token', type: 'password', placeholder: 'Your auth token', required: true },
      { key: 'phone_number', label: 'Phone Number', type: 'text', placeholder: '+1234567890', required: true, helpText: 'E.164 format' },
      { key: 'websocket_url', label: 'WebSocket URL', type: 'url', placeholder: 'wss://your-server.com/ws', required: false, helpText: 'For real-time voice' },
    ],
    icon: Phone,
    label: 'Twilio',
    description: 'Voice calls and SMS',
    allowCustomFields: true,
  },
  evolution_api: {
    fields: [
      { key: 'api_url', label: 'API URL', type: 'url', placeholder: 'https://api.evolution.com', required: true },
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Your API key', required: true },
    ],
    icon: MessageSquare,
    label: 'Evolution API',
    description: 'WhatsApp messaging',
    allowCustomFields: true,
  },
  opendental: {
    fields: [
      { key: 'api_url', label: 'API URL', type: 'url', placeholder: 'https://api.opendental.com/api/v1', required: true },
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Your OpenDental key', required: true, helpText: 'ODFHIR format' },
    ],
    icon: Database,
    label: 'OpenDental',
    description: 'Dental practice management',
    allowCustomFields: true,
  },
  retell: {
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Your Retell key', required: true },
    ],
    icon: Mic,
    label: 'Retell AI',
    description: 'Voice AI platform',
    allowCustomFields: true,
  },
  google_calendar: {
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', placeholder: '...apps.googleusercontent.com', required: true, helpText: 'From Google Cloud Console' },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: 'GOCSPX-...', required: true },
      { key: 'refresh_token', label: 'Refresh Token', type: 'password', placeholder: 'OAuth refresh token', required: true, helpText: 'Obtained during OAuth flow' },
      { key: 'calendar_id', label: 'Calendar ID', type: 'text', placeholder: 'primary or calendar@group.calendar.google.com', required: false, helpText: 'Default: primary calendar' },
    ],
    icon: Calendar,
    label: 'Google Calendar',
    description: 'Calendar sync and scheduling',
    allowCustomFields: true,
  },
  other: {
    fields: [],
    icon: Settings,
    label: 'Other',
    description: 'Custom integration',
    allowCustomFields: true,
  },
};

interface CustomField {
  key: string;
  value: string;
}

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  // Form state
  const [formType, setFormType] = useState<CredentialType>('openai');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCredentials, setFormCredentials] = useState<Record<string, string>>({});
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/api-credentials');
      const data = await response.json();
      
      if (data.success) {
        setCredentials(data.credentials || []);
      }
    } catch (error) {
      console.error('Error fetching credentials:', error);
      setMessage({ type: 'error', text: 'Failed to load credentials' });
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type: CredentialType) => {
    setFormType(type);
    const template = credentialTemplates[type];
    const newCredentials: Record<string, string> = {};
    
    template.fields.forEach(field => {
      newCredentials[field.key] = '';
    });
    
    setFormCredentials(newCredentials);
    setCustomFields([]);
  };

  const handleAddCustomField = () => {
    setCustomFields([...customFields, { key: '', value: '' }]);
  };

  const handleCustomFieldChange = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customFields];
    updated[index][field] = value;
    setCustomFields(updated);
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    // Combine template fields with custom fields
    const allCredentials = { ...formCredentials };
    customFields.forEach(cf => {
      if (cf.key && cf.value) {
        allCredentials[cf.key] = cf.value;
      }
    });

    try {
      const url = editingId 
        ? `/api/admin/api-credentials/${editingId}` 
        : '/api/admin/api-credentials';
      
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential_type: formType,
          credential_name: formName,
          description: formDescription,
          credentials: allCredentials,
          is_default: formIsDefault,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: editingId ? 'Credential updated successfully' : 'Credential created successfully' 
        });
        resetForm();
        fetchCredentials();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save credential' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save credential' });
    }
  };

  const handleEdit = (credential: Credential) => {
    const template = credentialTemplates[credential.credential_type];
    const templateKeys = template.fields.map(f => f.key);
    
    // Separate template fields from custom fields
    const templateCreds: Record<string, string> = {};
    const extraFields: CustomField[] = [];
    
    Object.entries(credential.credentials).forEach(([key, value]) => {
      if (templateKeys.includes(key)) {
        templateCreds[key] = value;
      } else {
        extraFields.push({ key, value });
      }
    });

    setFormType(credential.credential_type);
    setFormName(credential.credential_name);
    setFormDescription(credential.description || '');
    setFormCredentials(templateCreds);
    setFormIsDefault(credential.is_default);
    setCustomFields(extraFields);
    setEditingId(credential.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credential?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/api-credentials/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Credential deleted successfully' });
        fetchCredentials();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to delete credential' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete credential' });
    }
  };

  const handleTestConnection = async (credentialId: string) => {
    setTestingId(credentialId);
    setTestResults(prev => ({ ...prev, [credentialId]: { success: false, message: 'Testing...' } }));

    try {
      const response = await fetch('/api/admin/api-credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId }),
      });

      const data = await response.json();

      setTestResults(prev => ({
        ...prev,
        [credentialId]: {
          success: data.success,
          message: data.message || (data.success ? 'Connection successful' : 'Connection failed'),
        },
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [credentialId]: { success: false, message: 'Test failed: Network error' },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const resetForm = () => {
    setFormType('openai');
    setFormName('');
    setFormDescription('');
    setFormCredentials({});
    setFormIsDefault(false);
    setCustomFields([]);
    setEditingId(null);
    setShowForm(false);
  };

  const toggleSecretVisibility = (credId: string, field: string) => {
    const key = `${credId}-${field}`;
    setVisibleSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const maskSecret = (value: string) => {
    if (!value) return '';
    if (value.length <= 8) return '***';
    return `${value.substring(0, 4)}${'*'.repeat(Math.min(value.length - 8, 20))}${value.substring(value.length - 4)}`;
  };

  const isSecretField = (field: string) => {
    return field.includes('key') || field.includes('token') || field.includes('secret') || field.includes('password');
  };

  // Group credentials by type
  const groupedCredentials = credentials.reduce((acc, cred) => {
    const type = cred.credential_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(cred);
    return acc;
  }, {} as Record<string, Credential[]>);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">API Credentials</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Credentials</h1>
          <p className="text-gray-600 mt-1">Manage API keys and tokens for all integrations</p>
        </div>
        <Button onClick={() => { setShowForm(true); resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Credential
        </Button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg border flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Security Notice */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <strong>Security Notice:</strong> API credentials are stored securely with encryption. 
              Rotate keys regularly and never share credentials publicly.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit' : 'Add'} API Credential</CardTitle>
            <CardDescription>
              Configure credentials for external service integrations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Type and Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Service Type</Label>
                <Select 
                  value={formType} 
                  onValueChange={(v) => handleTypeChange(v as CredentialType)}
                  disabled={!!editingId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(credentialTemplates).map(([key, template]) => {
                      const Icon = template.icon;
                      return (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <div>
                              <span>{template.label}</span>
                              <span className="text-xs text-gray-500 ml-2">{template.description}</span>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Credential Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Production OpenAI Key"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Notes about this credential..."
                rows={2}
              />
            </div>

            {/* Template Fields */}
            {credentialTemplates[formType].fields.length > 0 && (
              <div className="border-t pt-4 space-y-4">
                <h3 className="font-medium">Required Fields</h3>
                {credentialTemplates[formType].fields.map(field => (
                  <div key={field.key} className="space-y-2">
                    <Label>
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {field.type === 'textarea' ? (
                      <Textarea
                        value={formCredentials[field.key] || ''}
                        onChange={(e) => setFormCredentials({ ...formCredentials, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        rows={3}
                      />
                    ) : (
                      <Input
                        type={field.type === 'password' ? 'password' : 'text'}
                        value={formCredentials[field.key] || ''}
                        onChange={(e) => setFormCredentials({ ...formCredentials, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                      />
                    )}
                    {field.helpText && (
                      <p className="text-xs text-gray-500">{field.helpText}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Custom Fields */}
            {credentialTemplates[formType].allowCustomFields && (
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Additional Fields</h3>
                    <p className="text-xs text-gray-500">Add any extra key-value pairs needed</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleAddCustomField}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Field
                  </Button>
                </div>

                {customFields.map((cf, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        value={cf.key}
                        onChange={(e) => handleCustomFieldChange(index, 'key', e.target.value)}
                        placeholder="Field name (e.g., webhook_url)"
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        type={isSecretField(cf.key) ? 'password' : 'text'}
                        value={cf.value}
                        onChange={(e) => handleCustomFieldChange(index, 'value', e.target.value)}
                        placeholder="Value"
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleRemoveCustomField(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Default Toggle */}
            <div className="flex items-center gap-2 border-t pt-4">
              <input
                type="checkbox"
                id="is_default"
                checked={formIsDefault}
                onChange={(e) => setFormIsDefault(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="is_default" className="cursor-pointer">
                Set as default for this service type
              </Label>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button onClick={handleSave}>
                <Check className="w-4 h-4 mr-2" />
                {editingId ? 'Update' : 'Create'}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credentials List by Type */}
      {Object.keys(groupedCredentials).length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Key className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No API credentials configured yet.</p>
            <p className="text-sm text-gray-500 mt-1">Click "Add Credential" to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedCredentials).map(([type, creds]) => {
            const template = credentialTemplates[type as CredentialType];
            const Icon = template?.icon || Settings;
            
            return (
              <div key={type} className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                  <Icon className="w-5 h-5" />
                  {template?.label || type}
                </h2>
                
                <div className="grid gap-3">
                  {creds.map(cred => (
                    <Card key={cred.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-medium">{cred.credential_name}</h3>
                            {cred.description && (
                              <p className="text-sm text-gray-500">{cred.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              {cred.is_default && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Default</span>
                              )}
                              {!cred.is_active && (
                                <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">Inactive</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleTestConnection(cred.id)}
                              disabled={testingId === cred.id}
                            >
                              {testingId === cred.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                'Test'
                              )}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleEdit(cred)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDelete(cred.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Credential Fields */}
                        <div className="grid gap-2 text-sm">
                          {Object.entries(cred.credentials).map(([field, value]) => {
                            const isSecret = isSecretField(field);
                            const key = `${cred.id}-${field}`;
                            const isVisible = visibleSecrets[key];
                            
                            return (
                              <div key={field} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium text-gray-700">
                                    {field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}:
                                  </span>
                                  <span className="text-gray-900 ml-2 font-mono truncate">
                                    {isSecret && !isVisible ? maskSecret(value) : value}
                                  </span>
                                </div>
                                {isSecret && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleSecretVisibility(cred.id, field)}
                                    className="ml-2"
                                  >
                                    {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Test Result */}
                        {testResults[cred.id] && (
                          <div className={`mt-3 p-3 rounded-lg border ${
                            testResults[cred.id].success 
                              ? 'bg-green-50 border-green-200 text-green-800' 
                              : 'bg-red-50 border-red-200 text-red-800'
                          }`}>
                            <div className="flex items-center gap-2">
                              {testResults[cred.id].success ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                              <span className="text-sm">{testResults[cred.id].message}</span>
                            </div>
                          </div>
                        )}

                        {/* Last Used */}
                        {cred.last_used_at && (
                          <p className="text-xs text-gray-500 mt-3">
                            Last used: {new Date(cred.last_used_at).toLocaleString()}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
