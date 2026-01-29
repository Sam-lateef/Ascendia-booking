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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Lock, Unlock, Eye, EyeOff, ExternalLink, Phone, MessageSquare, Globe, Key, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTranslations, useLocale } from '@/lib/i18n/TranslationProvider';
import { useRouter } from 'next/navigation';

type AgentMode = 'premium' | 'standard';
type Channel = 'twilio' | 'web' | 'whatsapp';

const HARDCODED_PASSWORD = 'lexi2026'; // Change this to your preferred password

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const [mode, setMode] = useState<AgentMode>('standard');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Organization settings
  const [dentalMode, setDentalMode] = useState(true);
  const [orgSettingsLoading, setOrgSettingsLoading] = useState(false);
  
  // API credentials status
  const [credentialsStatus, setCredentialsStatus] = useState<Record<string, boolean>>({});
  
  // Channel selection
  const [activeChannel, setActiveChannel] = useState<Channel>('twilio');
  
  // Password protection for instructions
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  
  // Instructions state
  const [premiumInstructions, setPremiumInstructions] = useState('');
  const [receptionistInstructions, setReceptionistInstructions] = useState('');
  const [supervisorInstructions, setSupervisorInstructions] = useState('');
  const [whatsappInstructions, setWhatsappInstructions] = useState('');
  const [instructionsLoading, setInstructionsLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    fetchCurrentMode();
    fetchCredentialsStatus();
    fetchOrganizationSettings();
  }, []);

  useEffect(() => {
    if (isUnlocked) {
      fetchInstructions();
    }
  }, [isUnlocked]);

  const fetchCredentialsStatus = async () => {
    try {
      const response = await fetch('/api/admin/api-credentials/status');
      const data = await response.json();
      
      if (data.success) {
        setCredentialsStatus(data.status || {});
      }
    } catch (error) {
      console.error('Error fetching credentials status:', error);
    }
  };

  const fetchOrganizationSettings = async () => {
    try {
      const response = await fetch('/api/admin/organization-settings');
      const data = await response.json();
      
      if (data.success && data.settings) {
        setDentalMode(data.settings.dental_mode ?? true);
      }
    } catch (error) {
      console.error('Error fetching organization settings:', error);
    }
  };

  const handleSaveOrganizationSettings = async () => {
    setOrgSettingsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/organization-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dental_mode: dentalMode,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: '✅ Organization settings saved successfully'
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: `❌ Failed to save: ${data.error}`
        });
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: '❌ Failed to save organization settings'
      });
    } finally {
      setOrgSettingsLoading(false);
    }
  };

  const fetchCurrentMode = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/agent-mode');
      const data = await response.json();
      
      if (data.success) {
        setMode(data.mode);
      }
    } catch (error) {
      console.error('Error fetching agent mode:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInstructions = async () => {
    setInstructionsLoading(true);
    try {
      const response = await fetch('/api/admin/agent-instructions');
      const data = await response.json();
      
      if (data.success) {
        setPremiumInstructions(data.premiumInstructions || '');
        setReceptionistInstructions(data.receptionistInstructions || '');
        setSupervisorInstructions(data.supervisorInstructions || '');
        setWhatsappInstructions(data.whatsappInstructions || '');
      }
    } catch (error) {
      console.error('Error fetching instructions:', error);
    } finally {
      setInstructionsLoading(false);
    }
  };

  const handleSeedInstructions = async () => {
    if (!confirm('This will populate the database with current hardcoded instructions. Continue?')) {
      return;
    }

    setSeeding(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/seed-instructions', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: '✅ Instructions seeded successfully. Refreshing...'
        });
        // Reload instructions from DB
        await fetchInstructions();
      } else {
        setMessage({ 
          type: 'error', 
          text: `❌ Failed to seed: ${data.error}`
        });
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: '❌ Failed to seed instructions'
      });
    } finally {
      setSeeding(false);
    }
  };

  const handleUnlock = () => {
    if (passwordInput === HARDCODED_PASSWORD) {
      setIsUnlocked(true);
      setPasswordError('');
      setPasswordInput('');
    } else {
      setPasswordError('Incorrect password');
    }
  };

  const handleSaveMode = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/agent-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: `✅ Successfully switched to ${mode === 'premium' ? 'Premium' : 'Standard'} mode`
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: `❌ Failed to save: ${data.error}`
        });
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: '❌ Failed to save settings'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInstructions = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/agent-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          premiumInstructions,
          receptionistInstructions,
          supervisorInstructions,
          whatsappInstructions,
          channel: activeChannel,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: '✅ Changes saved successfully'
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: `❌ Failed to save: ${data.error}`
        });
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: '❌ Failed to save changes'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
        <p>{tCommon('loading')}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Organization Settings - Industry Type */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
          <CardDescription>
            Configure your organization type and industry-specific features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="dental-mode" className="text-base font-medium">
                Dental Mode
              </Label>
              <p className="text-sm text-gray-600">
                Enable dental-specific features like tooth charts and tooth selection in treatment plans. 
                Disable this for salons, spas, or other non-dental businesses.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                id="dental-mode"
                onClick={() => setDentalMode(!dentalMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  dentalMode ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    dentalMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-gray-700">
                {dentalMode ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {!dentalMode && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> With dental mode disabled, tooth charts and tooth selection 
                will be hidden throughout the system. Treatment plans will work for general services 
                like salon treatments, spa services, or any other non-dental business.
              </p>
            </div>
          )}

          <Button 
            onClick={handleSaveOrganizationSettings}
            disabled={orgSettingsLoading}
          >
            {orgSettingsLoading ? 'Saving...' : 'Save Organization Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Agent Mode Card */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t('agentMode')}</CardTitle>
          <CardDescription>
            {t('agentModeSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="agent-mode">{t('agentModeLabel')}</Label>
            <Select value={mode} onValueChange={(value: AgentMode) => setMode(value)}>
              <SelectTrigger id="agent-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{tCommon('standard_recommended')}</span>
                    <span className="text-xs text-gray-500">
                      Cost Effective
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="premium">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{tCommon('premium')}</span>
                    <span className="text-xs text-gray-500">
                      Expensive
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
            <div className="font-medium text-gray-900">{tCommon('how_it_works')}</div>
            <ul className="space-y-1 text-gray-600 list-disc list-inside">
              <li>
                <strong>{tCommon('standard')}</strong> Cost Effective - Optimized for best value
              </li>
              <li>
                <strong>{tCommon('premium')}</strong> Expensive - Maximum performance
              </li>
              <li>
                Changes take effect immediately for new calls
              </li>
              <li>
                No need to update Twilio webhooks - routing is automatic
              </li>
            </ul>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              onClick={handleSaveMode} 
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? t('saving') : t('saveMode')}
            </Button>

            {message && (
              <div className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {message.text}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Configuration Card */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            API Configuration
          </CardTitle>
          <CardDescription>
            Manage API credentials for Twilio, OpenAI, WhatsApp, and other services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Credentials Status */}
          <div className="grid grid-cols-2 gap-3">
            {['openai', 'twilio', 'evolution_api', 'opendental'].map(type => {
              const isConfigured = credentialsStatus[type];
              return (
                <div key={type} className="flex items-center gap-2 p-2 rounded bg-gray-50">
                  {isConfigured ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  )}
                  <span className="text-sm font-medium">
                    {type === 'openai' ? 'OpenAI' : 
                     type === 'twilio' ? 'Twilio' : 
                     type === 'evolution_api' ? 'WhatsApp' : 
                     'OpenDental'}
                  </span>
                </div>
              );
            })}
          </div>

          <Button 
            onClick={() => router.push('/admin/booking/api-keys')}
            className="bg-blue-600 hover:bg-blue-700 text-white w-full"
          >
            <Key className="w-4 h-4 mr-2" />
            Manage API Keys
          </Button>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              💡 Configure organization-specific API keys for multi-tenant support. 
              Falls back to environment variables if not configured.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Web Testing Card */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t('webTesting')}</CardTitle>
          <CardDescription>
            {t('webTestingSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => window.open(`/agent-ui?agentConfig=dental`, '_blank')}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {t('openWebTesting')}
          </Button>
        </CardContent>
      </Card>

      {/* Instructions Editor Card */}
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isUnlocked ? <Unlock className="w-5 h-5 text-green-600" /> : <Lock className="w-5 h-5 text-gray-400" />}
            Workflows
          </CardTitle>
          <CardDescription>
            Advanced configuration settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isUnlocked ? (
            <div className="space-y-4">
              <div className="space-y-3 max-w-md">
                <Label htmlFor="password">{tCommon('password_required')}</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                      placeholder={tCommon('enter_password')}
                      className={passwordError ? 'border-red-500' : ''}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button onClick={handleUnlock}>
                    Unlock
                  </Button>
                </div>
                {passwordError && (
                  <p className="text-sm text-red-600">{passwordError}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {instructionsLoading ? (
                <p>{tCommon('loading')}</p>
              ) : (
                <>
                  {/* Seed Instructions Button */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900 mb-1">
                          Sync Current Instructions
                        </p>
                        <p className="text-xs text-blue-700">
                          Copy all current hardcoded instructions to database. Only needed once or after code updates.
                        </p>
                      </div>
                      <Button 
                        onClick={handleSeedInstructions}
                        disabled={seeding}
                        variant="outline"
                        size="sm"
                        className="whitespace-nowrap"
                      >
                        {seeding ? 'Syncing...' : 'Sync Instructions'}
                      </Button>
                    </div>
                  </div>

                  {/* Channel Tabs */}
                  <Tabs value={activeChannel} onValueChange={(v) => setActiveChannel(v as Channel)}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="twilio" className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <span>Twilio Voice</span>
                      </TabsTrigger>
                      <TabsTrigger value="web" className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        <span>Web Agent</span>
                      </TabsTrigger>
                      <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        <span>WhatsApp</span>
                      </TabsTrigger>
                    </TabsList>

                    {/* Twilio Voice Tab */}
                    <TabsContent value="twilio" className="space-y-6 mt-6">
                      {/* Premium Instructions */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="premium-instructions" className="text-base font-semibold">
                            Premium Configuration
                          </Label>
                          <span className="text-xs text-gray-500 bg-purple-100 px-2 py-1 rounded">Single Agent</span>
                        </div>
                        <Textarea
                          id="premium-instructions"
                          value={premiumInstructions}
                          onChange={(e) => setPremiumInstructions(e.target.value)}
                          placeholder="Premium agent instructions (gpt-4o-realtime)"
                          className="min-h-[200px] font-mono text-sm"
                        />
                      </div>

                      <div className="border-t pt-6" />

                      {/* Standard Mode Instructions */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-semibold">Standard Configuration</h3>
                          <span className="text-xs text-gray-500 bg-blue-100 px-2 py-1 rounded">Two-Agent System</span>
                        </div>

                        {/* Receptionist Instructions */}
                        <div className="space-y-3">
                          <Label htmlFor="receptionist-instructions" className="text-sm font-medium">
                            Receptionist Agent (gpt-4o-mini)
                          </Label>
                          <Textarea
                            id="receptionist-instructions"
                            value={receptionistInstructions}
                            onChange={(e) => setReceptionistInstructions(e.target.value)}
                            placeholder="Receptionist agent instructions"
                            className="min-h-[200px] font-mono text-sm"
                          />
                        </div>

                        {/* Supervisor Instructions */}
                        <div className="space-y-3">
                          <Label htmlFor="supervisor-instructions" className="text-sm font-medium">
                            Supervisor Agent (gpt-4o)
                          </Label>
                          <Textarea
                            id="supervisor-instructions"
                            value={supervisorInstructions}
                            onChange={(e) => setSupervisorInstructions(e.target.value)}
                            placeholder="Supervisor agent instructions"
                            className="min-h-[200px] font-mono text-sm"
                          />
                        </div>
                      </div>
                    </TabsContent>

                    {/* Web Agent Tab */}
                    <TabsContent value="web" className="space-y-6 mt-6">
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-purple-800">
                          Web agent supports both Premium (single-agent) and Standard (two-agent) modes, same as Twilio Voice. 
                          The mode selector above controls which configuration is used.
                        </p>
                      </div>
                      
                      {/* Premium Instructions */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="web-premium-instructions" className="text-base font-semibold">
                            Premium Configuration
                          </Label>
                          <span className="text-xs text-gray-500 bg-purple-100 px-2 py-1 rounded">Single Agent</span>
                        </div>
                        <Textarea
                          id="web-premium-instructions"
                          value={premiumInstructions}
                          onChange={(e) => setPremiumInstructions(e.target.value)}
                          placeholder="Web agent premium instructions (gpt-4o)"
                          className="min-h-[200px] font-mono text-sm"
                        />
                      </div>

                      <div className="border-t pt-6" />

                      {/* Standard Mode Instructions */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-semibold">Standard Configuration</h3>
                          <span className="text-xs text-gray-500 bg-blue-100 px-2 py-1 rounded">Two-Agent System</span>
                        </div>

                        {/* Receptionist Instructions */}
                        <div className="space-y-3">
                          <Label htmlFor="web-receptionist-instructions" className="text-sm font-medium">
                            Receptionist Agent (gpt-4o-mini)
                          </Label>
                          <Textarea
                            id="web-receptionist-instructions"
                            value={receptionistInstructions}
                            onChange={(e) => setReceptionistInstructions(e.target.value)}
                            placeholder="Web receptionist agent instructions"
                            className="min-h-[200px] font-mono text-sm"
                          />
                        </div>

                        {/* Supervisor Instructions */}
                        <div className="space-y-3">
                          <Label htmlFor="web-supervisor-instructions" className="text-sm font-medium">
                            Supervisor Agent (gpt-4o)
                          </Label>
                          <Textarea
                            id="web-supervisor-instructions"
                            value={supervisorInstructions}
                            onChange={(e) => setSupervisorInstructions(e.target.value)}
                            placeholder="Web supervisor agent instructions"
                            className="min-h-[200px] font-mono text-sm"
                          />
                        </div>
                      </div>
                    </TabsContent>

                    {/* WhatsApp Tab */}
                    <TabsContent value="whatsapp" className="space-y-6 mt-6">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-green-800">
                          <strong>WhatsApp Configuration:</strong> Uses gpt-4o (single-agent, text-only). 
                          Similar to Premium mode but optimized for text messaging.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="whatsapp-instructions" className="text-base font-semibold">
                          WhatsApp Agent Instructions
                        </Label>
                        <Textarea
                          id="whatsapp-instructions"
                          value={whatsappInstructions}
                          onChange={(e) => setWhatsappInstructions(e.target.value)}
                          placeholder="WhatsApp agent instructions (gpt-4o, text-based)"
                          className="min-h-[400px] font-mono text-sm"
                        />
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="border-t pt-6" />

                  {/* Save Button */}
                  <div className="flex items-center gap-3">
                    <Button 
                      onClick={handleSaveInstructions} 
                      disabled={saving}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button 
                      onClick={() => setIsUnlocked(false)} 
                      variant="outline"
                    >
                      Lock Editor
                    </Button>

                    {message && (
                      <div className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        {message.text}
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      💡 <strong>{tCommon('tip')}</strong> Changes take effect immediately for new calls/messages.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
