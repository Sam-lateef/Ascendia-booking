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
  AlertCircle 
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/TranslationProvider';

type CredentialType = 'openai' | 'anthropic' | 'twilio' | 'evolution_api' | 'opendental' | 'retell' | 'other';

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

interface CredentialFormData {
  credential_type: CredentialType;
  credential_name: string;
  description: string;
  credentials: Record<string, string>;
  is_default: boolean;
}

const credentialTemplates: Record<CredentialType, { fields: string[]; icon: any; label: string }> = {
  openai: {
    fields: ['api_key'],
    icon: Brain,
    label: 'OpenAI',
  },
  anthropic: {
    fields: ['api_key'],
    icon: Brain,
    label: 'Anthropic (Claude)',
  },
  twilio: {
    fields: ['account_sid', 'auth_token', 'phone_number', 'websocket_url'],
    icon: Phone,
    label: 'Twilio',
  },
  evolution_api: {
    fields: ['api_url', 'api_key'],
    icon: MessageSquare,
    label: 'Evolution API (WhatsApp)',
  },
  opendental: {
    fields: ['api_url', 'api_key'],
    icon: Database,
    label: 'OpenDental',
  },
  retell: {
    fields: ['api_key'],
    icon: Phone,
    label: 'Retell AI',
  },
  other: {
    fields: ['key', 'value'],
    icon: Key,
    label: 'Other',
  },
};

export default function APIKeysPage() {
  const t = useTranslations('common');
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const [formData, setFormData] = useState<CredentialFormData>({
    credential_type: 'openai',
    credential_name: '',
    description: '',
    credentials: {},
    is_default: false,
  });

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
      setMessage({ type: 'error', text: 'Failed to load API credentials' });
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type: CredentialType) => {
    const template = credentialTemplates[type];
    const newCredentials: Record<string, string> = {};
    
    template.fields.forEach(field => {
      newCredentials[field] = '';
    });
    
    setFormData({
      ...formData,
      credential_type: type,
      credentials: newCredentials,
    });
  };

  const handleCredentialFieldChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      credentials: {
        ...formData.credentials,
        [field]: value,
      },
    });
  };

  const handleSave = async () => {
    try {
      const url = editingId 
        ? `/api/admin/api-credentials/${editingId}` 
        : '/api/admin/api-credentials';
      
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: editingId ? 'Credential updated successfully' : 'Credential created successfully' 
        });
        setShowForm(false);
        setEditingId(null);
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
    setFormData({
      credential_type: credential.credential_type,
      credential_name: credential.credential_name,
      description: credential.description || '',
      credentials: credential.credentials,
      is_default: credential.is_default,
    });
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

  const toggleSecretVisibility = (credId: string, field: string) => {
    const key = `${credId}-${field}`;
    setVisibleSecrets(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
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

      if (data.success) {
        setMessage({ type: 'success', text: 'Connection test successful!' });
      } else {
        setMessage({ type: 'error', text: `Connection test failed: ${data.message}` });
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [credentialId]: {
          success: false,
          message: 'Test failed: Network error',
        },
      }));
      setMessage({ type: 'error', text: 'Failed to test connection' });
    } finally {
      setTestingId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      credential_type: 'openai',
      credential_name: '',
      description: '',
      credentials: {},
      is_default: false,
    });
  };

  const maskSecret = (value: string) => {
    if (!value) return '';
    if (value.length <= 8) return '***';
    return `${value.substring(0, 4)}${'*'.repeat(value.length - 8)}${value.substring(value.length - 4)}`;
  };

  const isSecretField = (field: string) => {
    return field.includes('key') || field.includes('token') || field.includes('secret') || field.includes('password');
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">API Keys & Credentials</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys & Credentials</h1>
          <p className="text-gray-600 mt-1">Manage API credentials for third-party integrations</p>
        </div>
        <Button onClick={() => { setShowForm(true); resetForm(); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Credential
        </Button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg border ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Warning about security */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <strong>Security Notice:</strong> API credentials are stored securely but should be treated as sensitive data. 
              Only share with authorized personnel and rotate keys regularly.
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
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Service Type</Label>
                <Select 
                  value={formData.credential_type} 
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
                            {template.label}
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
                  value={formData.credential_name}
                  onChange={(e) => setFormData({ ...formData, credential_name: e.target.value })}
                  placeholder="e.g., Production OpenAI Key"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Notes about this credential..."
                rows={2}
              />
            </div>

            <div className="border-t pt-4 space-y-3">
              <h3 className="font-medium">Credentials</h3>
              {credentialTemplates[formData.credential_type].fields.map(field => (
                <div key={field} className="space-y-2">
                  <Label>{field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</Label>
                  <Input
                    type={isSecretField(field) ? 'password' : 'text'}
                    value={formData.credentials[field] || ''}
                    onChange={(e) => handleCredentialFieldChange(field, e.target.value)}
                    placeholder={`Enter ${field}...`}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_default"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="is_default" className="cursor-pointer">
                Set as default for this service type
              </Label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={handleSave}>
                <Check className="w-4 h-4 mr-2" />
                {editingId ? 'Update' : 'Create'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credentials List */}
      <div className="grid gap-4">
        {credentials.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-gray-500">
              No API credentials configured yet. Click "Add Credential" to get started.
            </CardContent>
          </Card>
        ) : (
          credentials.map(cred => {
            const template = credentialTemplates[cred.credential_type];
            const Icon = template.icon;
            
            return (
              <Card key={cred.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-gray-600" />
                      <div>
                        <CardTitle className="text-lg">{cred.credential_name}</CardTitle>
                        <CardDescription>
                          {template.label}
                          {cred.is_default && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Default</span>
                          )}
                          {!cred.is_active && (
                            <span className="ml-2 text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">Inactive</span>
                          )}
                        </CardDescription>
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
                          <>Testing...</>
                        ) : (
                          <>Test</>
                        )}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(cred)}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(cred.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {cred.description && (
                    <p className="text-sm text-gray-600 mb-4">{cred.description}</p>
                  )}
                  <div className="grid gap-2">
                    {Object.entries(cred.credentials).map(([field, value]) => {
                      const isSecret = isSecretField(field);
                      const key = `${cred.id}-${field}`;
                      const isVisible = visibleSecrets[key];
                      
                      return (
                        <div key={field} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-700">
                              {field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}:
                            </span>
                            <span className="text-sm text-gray-900 ml-2 font-mono">
                              {isSecret && !isVisible ? maskSecret(value) : value}
                            </span>
                          </div>
                          {isSecret && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSecretVisibility(cred.id, field)}
                            >
                              {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {testResults[cred.id] && (
                    <div className={`mt-4 p-3 rounded-lg border ${
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
                        <span className="text-sm font-medium">{testResults[cred.id].message}</span>
                      </div>
                    </div>
                  )}
                  {cred.last_used_at && (
                    <p className="text-xs text-gray-500 mt-4">
                      Last used: {new Date(cred.last_used_at).toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
