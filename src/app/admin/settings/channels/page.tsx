'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Phone, 
  Mic,
  MessageSquare, 
  Globe,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Settings2,
  Zap,
  Database,
  Calendar,
  X,
  ExternalLink,
  Info,
  ArrowRight,
  Cpu,
  HardDrive,
  Activity,
  Bot,
  Users,
  FileText,
  Sparkles
} from 'lucide-react';

// Channel definitions with their configurations
const CHANNEL_CONFIGS = {
  twilio: {
    name: 'Twilio Voice',
    description: 'Inbound/outbound voice calls via Twilio',
    icon: Phone,
    color: 'red',
    aiBackendOptions: [], // Not used - uses VOICE_AGENT_MODES
    defaultBackend: 'openai_realtime',
    requiresCredential: 'twilio',
    supportsAgentMode: true, // Supports one/two agent modes
    settings: [
      { key: 'voice', label: 'Voice Preference', type: 'select', options: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'], helpText: 'OpenAI voice personality (optional)' },
    ],
  },
  retell: {
    name: 'Retell Voice',
    description: 'Voice AI platform with advanced TTS/STT',
    icon: Mic,
    color: 'purple',
    // Retell handles STT/TTS, so we only need text models
    aiBackendOptions: [
      { value: 'openai_gpt4o', label: 'GPT-4o', description: 'Best quality for complex logic', recommended: true },
      { value: 'openai_gpt4o_mini', label: 'GPT-4o-mini', description: 'Cost-effective, faster responses' },
      { value: 'anthropic_claude', label: 'Claude 3.5', description: 'Strong reasoning capabilities' },
    ],
    defaultBackend: 'openai_gpt4o',
    requiresCredential: 'retell',
    supportsAgentMode: false, // Retell is always single agent (Retell handles voice layer)
    settings: [],
  },
  whatsapp: {
    name: 'WhatsApp',
    description: 'Text messaging via WhatsApp Business',
    icon: MessageSquare,
    color: 'green',
    // WhatsApp is text-only
    aiBackendOptions: [
      { value: 'openai_gpt4o', label: 'GPT-4o', description: 'Best quality for conversations', recommended: true },
      { value: 'openai_gpt4o_mini', label: 'GPT-4o-mini', description: 'Cost-effective for high volume' },
      { value: 'anthropic_claude', label: 'Claude 3.5', description: 'Strong reasoning capabilities' },
    ],
    defaultBackend: 'openai_gpt4o',
    requiresCredential: 'evolution_api',
    supportsAgentMode: false, // WhatsApp is always single agent
    settings: [],
  },
  web: {
    name: 'Web',
    description: 'Browser-based voice/text interface',
    icon: Globe,
    color: 'blue',
    aiBackendOptions: [], // Not used - uses VOICE_AGENT_MODES
    defaultBackend: 'openai_realtime',
    requiresCredential: 'openai',
    supportsAgentMode: true, // Supports one/two agent modes like Twilio
    settings: [
      { key: 'embed_url', label: 'Embed URL', type: 'url', readOnly: true, helpText: 'Use this URL to embed the chat widget' },
    ],
  },
};

// One-agent model options for voice channels (Twilio & Web)
const ONE_AGENT_MODEL_OPTIONS = [
  { 
    value: 'gpt-4o-realtime', 
    label: 'GPT-4o Realtime', 
    description: 'Best quality - handles voice + complex logic',
    recommended: true,
    costLevel: 'High'
  },
  { 
    value: 'gpt-4o-mini-realtime', 
    label: 'GPT-4o-mini Realtime', 
    description: 'Cost-effective - handles voice + simpler logic',
    recommended: false,
    costLevel: 'Medium'
  },
];

// Voice channel agent modes (shared by Twilio & Web)
const VOICE_AGENT_MODES = {
  one_agent: {
    name: 'Single Agent Mode',
    description: 'One realtime agent handles everything: voice (STT/TTS) + conversation + booking logic',
    icon: Bot,
    recommended: true,
    hasModelSelection: true, // Can choose between gpt-4o-realtime and gpt-4o-mini-realtime
    twoAgentModels: null,
    instructions: [
      { key: 'one_agent_instructions', label: 'Agent Instructions', description: 'Complete instructions for voice + logic' }
    ]
  },
  two_agent: {
    name: 'Two Agent Mode',
    description: 'Receptionist (mini) handles voice naturally, Supervisor (GPT-4o) handles complex booking logic',
    icon: Users,
    recommended: false,
    hasModelSelection: false, // Fixed: mini-realtime + gpt-4o
    twoAgentModels: {
      receptionist: { model: 'gpt-4o-mini-realtime', label: 'GPT-4o-mini Realtime', description: 'Handles voice/STT/TTS' },
      supervisor: { model: 'gpt-4o', label: 'GPT-4o', description: 'Handles booking logic & tools' }
    },
    instructions: [
      { key: 'receptionist_instructions', label: 'Receptionist Instructions', description: 'Voice agent - natural conversation' },
      { key: 'supervisor_instructions', label: 'Supervisor Instructions', description: 'Logic agent - booking & tools' }
    ]
  }
};

// Legacy alias for backward compatibility
const TWILIO_AGENT_MODES = VOICE_AGENT_MODES;

// Data integrations that channels can use
const DATA_INTEGRATIONS = {
  embedded_booking: {
    name: 'Local Database',
    description: 'Built-in booking system (always enabled)',
    icon: HardDrive,
    dataTypes: ['patients', 'appointments', 'providers', 'schedules'],
    alwaysEnabled: true, // Cannot be disabled - source of truth
    credentialKey: null, // No credential needed
  },
  opendental: {
    name: 'OpenDental',
    description: 'Sync to OpenDental practice management',
    icon: Database,
    dataTypes: ['patients', 'appointments'],
    alwaysEnabled: false,
    credentialKey: 'opendental',
  },
  google_calendar: {
    name: 'Google Calendar',
    description: 'Sync appointments to Google Calendar',
    icon: Calendar,
    dataTypes: ['events', 'availability'],
    alwaysEnabled: false,
    credentialKey: 'google_calendar',
  },
};

// AI Backend descriptions with model info
const AI_BACKEND_INFO: Record<string, { model: string; features: string[]; costLevel: string }> = {
  openai_realtime: { 
    model: 'gpt-4o-realtime', 
    features: ['Native voice', 'Low latency', 'Function calling'],
    costLevel: 'High'
  },
  openai_gpt4o: { 
    model: 'gpt-4o', 
    features: ['Text processing', 'Function calling', 'Vision'],
    costLevel: 'Medium'
  },
  openai_gpt4o_mini: { 
    model: 'gpt-4o-mini', 
    features: ['Fast', 'Cost-effective', 'Function calling'],
    costLevel: 'Low'
  },
  anthropic_claude: { 
    model: 'claude-3.5-sonnet', 
    features: ['Long context', 'Reasoning', 'Safety'],
    costLevel: 'Medium'
  },
};

type AgentMode = keyof typeof TWILIO_AGENT_MODES;
type ChannelType = keyof typeof CHANNEL_CONFIGS;
type DataIntegrationType = keyof typeof DATA_INTEGRATIONS;

interface ChannelConfig {
  id?: string;
  channel: ChannelType;
  enabled: boolean;
  ai_backend: string;
  settings: Record<string, any>; // Changed to any to support nested objects
  data_integrations: DataIntegrationType[];
  instructions?: string;
  one_agent_instructions?: string;
  receptionist_instructions?: string;
  supervisor_instructions?: string;
}

// Helper to get agent mode from settings
const getAgentMode = (settings: Record<string, any>): AgentMode => {
  return settings?.agent_mode || 'one_agent';
};

// Helper to get one-agent model selection (for voice channels)
const getOneAgentModel = (settings: Record<string, any>): string => {
  return settings?.one_agent_model || 'gpt-4o-realtime';
};

// Helper to get agent instructions from settings
const getAgentInstructions = (settings: Record<string, any>, key: string): string => {
  return settings?.[key] || '';
};

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Record<ChannelType, ChannelConfig>>({
    twilio: { channel: 'twilio', enabled: false, ai_backend: 'openai_realtime', settings: { agent_mode: 'one_agent' }, data_integrations: [] },
    retell: { channel: 'retell', enabled: false, ai_backend: 'openai_gpt4o', settings: { agent_mode: 'one_agent' }, data_integrations: [] },
    whatsapp: { channel: 'whatsapp', enabled: false, ai_backend: 'openai_gpt4o', settings: { agent_mode: 'one_agent' }, data_integrations: [] },
    web: { channel: 'web', enabled: true, ai_backend: 'openai_realtime', settings: { agent_mode: 'one_agent' }, data_integrations: [] },
  });
  const [credentialStatus, setCredentialStatus] = useState<Record<string, boolean>>({});
  const [expandedChannel, setExpandedChannel] = useState<ChannelType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch both in parallel for better performance
      const [channelRes, credRes] = await Promise.all([
        fetch('/api/admin/channel-configs'),
        fetch('/api/admin/api-credentials/status')
      ]);

      // Process channel configurations
      if (channelRes.ok) {
        const channelData = await channelRes.json();
        if (channelData.success && channelData.configs) {
          const configMap = { ...channels };
          channelData.configs.forEach((config: ChannelConfig) => {
            if (configMap[config.channel]) {
              // Load instruction fields directly from database (no parsing needed!)
              const settings = { 
                ...config.settings,
                one_agent_instructions: config.one_agent_instructions || '',
                receptionist_instructions: config.receptionist_instructions || '',
                supervisor_instructions: config.supervisor_instructions || ''
              };
              
              configMap[config.channel] = { ...config, settings };
            }
          });
          setChannels(configMap);
        }
      }

      // Process credential status
      if (credRes.ok) {
        const credData = await credRes.json();
        if (credData.success) {
          setCredentialStatus(credData.status || {});
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChannel = (channelKey: ChannelType, enabled: boolean) => {
    setChannels(prev => ({
      ...prev,
      [channelKey]: { ...prev[channelKey], enabled }
    }));
  };

  const handleBackendChange = (channelKey: ChannelType, backend: string) => {
    setChannels(prev => ({
      ...prev,
      [channelKey]: { ...prev[channelKey], ai_backend: backend }
    }));
  };

  const handleSettingChange = (channelKey: ChannelType, settingKey: string, value: string) => {
    setChannels(prev => ({
      ...prev,
      [channelKey]: {
        ...prev[channelKey],
        settings: { ...prev[channelKey].settings, [settingKey]: value }
      }
    }));
  };

  const handleDataIntegrationToggle = (channelKey: ChannelType, integration: DataIntegrationType) => {
    setChannels(prev => {
      const current = prev[channelKey].data_integrations || [];
      const updated = current.includes(integration)
        ? current.filter(i => i !== integration)
        : [...current, integration];
      return {
        ...prev,
        [channelKey]: { ...prev[channelKey], data_integrations: updated }
      };
    });
  };

  const handleInstructionsChange = (channelKey: ChannelType, instructions: string) => {
    setChannels(prev => ({
      ...prev,
      [channelKey]: { ...prev[channelKey], instructions }
    }));
  };

  const handleAgentModeChange = (channelKey: ChannelType, mode: AgentMode) => {
    setChannels(prev => {
      const currentChannel = prev[channelKey];
      const currentSettings = currentChannel.settings || {};
      
      // Just update agent_mode - instructions are already in separate fields!
      const newSettings = { ...currentSettings, agent_mode: mode };
      
      console.log(`[Channels] Mode changed to ${mode}`);
      
      return {
        ...prev,
        [channelKey]: {
          ...currentChannel,
          settings: newSettings
        }
      };
    });
  };

  const handleOneAgentModelChange = (channelKey: ChannelType, model: string) => {
    setChannels(prev => ({
      ...prev,
      [channelKey]: {
        ...prev[channelKey],
        settings: { ...prev[channelKey].settings, one_agent_model: model }
      }
    }));
  };

  const handleAgentInstructionsChange = (channelKey: ChannelType, instructionKey: string, value: string) => {
    setChannels(prev => {
      const currentChannel = prev[channelKey];
      const currentSettings = currentChannel.settings || {};
      
      // Simply update the specific instruction field - no concatenation needed!
      const newSettings = { ...currentSettings, [instructionKey]: value };
      
      // Also update the root-level field for the channel config
      const updates: any = { settings: newSettings };
      if (instructionKey === 'one_agent_instructions') {
        updates.one_agent_instructions = value;
      } else if (instructionKey === 'receptionist_instructions') {
        updates.receptionist_instructions = value;
      } else if (instructionKey === 'supervisor_instructions') {
        updates.supervisor_instructions = value;
      }
      
      return {
        ...prev,
        [channelKey]: {
          ...currentChannel,
          ...updates
        }
      };
    });
  };

  const handleSaveChannel = async (channelKey: ChannelType) => {
    setSaving(channelKey);
    setMessage(null);

    try {
      const config = channels[channelKey];
      
      console.log(`[Channels] Saving ${channelKey} config:`, {
        agentMode: config.settings?.agent_mode,
        oneAgentLength: config.one_agent_instructions?.length || 0,
        receptionistLength: config.receptionist_instructions?.length || 0,
        supervisorLength: config.supervisor_instructions?.length || 0,
        settings: config.settings
      });
      
      const response = await fetch('/api/admin/channel-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          channel: channelKey, // Override to ensure correct channel
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `${CHANNEL_CONFIGS[channelKey].name} configuration saved` });
        console.log(`[Channels] ✅ Saved ${channelKey} config successfully`);
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save configuration' });
    } finally {
      setSaving(null);
    }
  };

  const getColorClasses = (color: string, enabled: boolean) => {
    if (!enabled) return 'bg-gray-100 text-gray-400';
    switch (color) {
      case 'red': return 'bg-red-100 text-red-600';
      case 'purple': return 'bg-purple-100 text-purple-600';
      case 'green': return 'bg-green-100 text-green-600';
      case 'blue': return 'bg-blue-100 text-blue-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Channels</h1>
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Channels</h1>
        <p className="text-gray-600 mt-1">Configure how users reach your AI agent</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg border flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Architecture Overview */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>How it works:</strong>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="bg-white px-2 py-1 rounded border">Channel (Input)</span>
                <span>→</span>
                <span className="bg-white px-2 py-1 rounded border">AI Backend (Processing)</span>
                <span>→</span>
                <span className="bg-white px-2 py-1 rounded border">Data Integrations (Actions)</span>
              </div>
              <p className="mt-2 text-xs">
                Each channel can use different AI backends and data integrations based on your needs.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Channel Cards */}
      <div className="space-y-4">
        {(Object.entries(CHANNEL_CONFIGS) as [ChannelType, typeof CHANNEL_CONFIGS[ChannelType]][]).map(([channelKey, config]) => {
          const Icon = config.icon;
          const channelData = channels[channelKey];
          const isExpanded = expandedChannel === channelKey;
          const hasCredential = credentialStatus[config.requiresCredential];

          return (
            <Card key={channelKey} className={`transition-all ${isExpanded ? 'ring-2 ring-blue-500' : ''} ${!channelData.enabled ? 'opacity-75' : ''}`}>
              {/* Channel Header */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div 
                    className="flex items-center gap-4 flex-1 cursor-pointer"
                    onClick={() => setExpandedChannel(isExpanded ? null : channelKey)}
                  >
                    <div className={`p-2.5 rounded-lg ${getColorClasses(config.color, channelData.enabled)}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold flex items-center gap-2">
                        {config.name}
                        {!hasCredential && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                            Needs credentials
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-500">{config.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`${channelKey}-toggle`} className="text-sm text-gray-600">
                        {channelData.enabled ? 'Enabled' : 'Disabled'}
                      </Label>
                      <Switch
                        id={`${channelKey}-toggle`}
                        checked={channelData.enabled}
                        onCheckedChange={(checked) => handleToggleChannel(channelKey, checked)}
                      />
                    </div>
                    <button onClick={() => setExpandedChannel(isExpanded ? null : channelKey)}>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Quick Status Bar */}
                {channelData.enabled && !isExpanded && (
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {config.aiBackendOptions.find(o => o.value === channelData.ai_backend)?.label || 'Not set'}
                    </span>
                    {channelData.data_integrations?.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        {channelData.data_integrations.length} integration(s)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Expanded Configuration */}
              {isExpanded && (
                <CardContent className="border-t pt-6 space-y-6">
                  {/* AI Model Selection - Only for non-Twilio channels */}
                  {channelKey !== 'twilio' && config.aiBackendOptions.length > 0 && (
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-amber-500" />
                        AI Model
                      </Label>
                      <p className="text-xs text-gray-500">
                        {channelKey === 'retell' 
                          ? 'Retell handles voice (STT/TTS). Choose the model for conversation logic.'
                          : channelKey === 'whatsapp'
                          ? 'Choose the model for text conversations.'
                          : 'Choose the AI model for this channel.'
                        }
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {config.aiBackendOptions.map(option => (
                          <div
                            key={option.value}
                            className={`p-3 border rounded-lg cursor-pointer transition-all ${
                              channelData.ai_backend === option.value
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => handleBackendChange(channelKey, option.value)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{option.label}</span>
                              {option.recommended && (
                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                  Recommended
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{option.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Data Integrations */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-blue-500" />
                      Data Layer Configuration
                    </Label>
                    <p className="text-xs text-gray-500">
                      Configure where booking data is stored and synced for this channel
                    </p>
                    <div className="space-y-3 mt-3">
                      {(Object.entries(DATA_INTEGRATIONS) as [DataIntegrationType, typeof DATA_INTEGRATIONS[DataIntegrationType]][]).map(([key, integration]) => {
                        const IntIcon = integration.icon;
                        const isAlwaysEnabled = integration.alwaysEnabled;
                        const isEnabled = isAlwaysEnabled || channelData.data_integrations?.includes(key);
                        const credentialKey = integration.credentialKey;
                        const hasCredential = credentialKey ? credentialStatus[credentialKey] : true;
                        const canToggle = !isAlwaysEnabled && hasCredential;

                        return (
                          <div
                            key={key}
                            className={`flex items-center justify-between p-3 border rounded-lg transition-all ${
                              isEnabled
                                ? 'border-green-200 bg-green-50/50'
                                : 'border-gray-200 bg-gray-50/30'
                            } ${!hasCredential && !isAlwaysEnabled ? 'opacity-60' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${isEnabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                                <IntIcon className={`w-4 h-4 ${isEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{integration.name}</span>
                                  {isAlwaysEnabled && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                                      ALWAYS ON
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">{integration.description}</p>
                                {!hasCredential && !isAlwaysEnabled && (
                                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                                    <AlertCircle className="w-3 h-3" />
                                    Configure credentials in Integrations first
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isEnabled && (
                                <span className="text-xs text-green-600 font-medium mr-2">
                                  {integration.dataTypes.join(', ')}
                                </span>
                              )}
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={() => canToggle && handleDataIntegrationToggle(channelKey, key)}
                                disabled={!canToggle}
                                className={isAlwaysEnabled ? 'opacity-50 cursor-not-allowed' : ''}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Data Flow Summary */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <Activity className="w-4 h-4" />
                        <span className="font-medium">Data Flow Summary</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {(() => {
                          const enabledIntegrations = ['embedded_booking', ...(channelData.data_integrations || [])];
                          const syncTargets = enabledIntegrations
                            .filter(i => i !== 'embedded_booking')
                            .map(i => DATA_INTEGRATIONS[i as DataIntegrationType]?.name)
                            .filter(Boolean);
                          
                          if (syncTargets.length === 0) {
                            return (
                              <span>
                                Bookings stored in <span className="font-medium text-gray-700">Local Database</span> only (no external sync)
                              </span>
                            );
                          }
                          
                          return (
                            <span>
                              Bookings stored in <span className="font-medium text-gray-700">Local Database</span> and synced to{' '}
                              <span className="font-medium text-gray-700">{syncTargets.join(' + ')}</span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Channel-Specific Settings */}
                  {config.settings.length > 0 && (
                    <div className="space-y-4">
                      <Label className="flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-gray-500" />
                        Channel Settings
                      </Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {config.settings.map(setting => (
                          <div key={setting.key} className="space-y-1.5">
                            <Label className="text-sm">{setting.label}</Label>
                            {setting.type === 'select' ? (
                              <Select
                                value={channelData.settings[setting.key] || ''}
                                onValueChange={(v) => handleSettingChange(channelKey, setting.key, v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {('options' in setting && setting.options) && setting.options.map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                type={setting.type}
                                value={channelData.settings[setting.key] || ''}
                                onChange={(e) => handleSettingChange(channelKey, setting.key, e.target.value)}
                                placeholder={'placeholder' in setting ? (setting as any).placeholder : undefined}
                                readOnly={'readOnly' in setting ? (setting as any).readOnly : false}
                                className={'readOnly' in setting && (setting as any).readOnly ? 'bg-gray-50' : ''}
                              />
                            )}
                            {setting.helpText && (
                              <p className="text-xs text-gray-500">{setting.helpText}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Agent Configuration */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-purple-500" />
                        Agent Configuration
                      </Label>
                      <span className="text-xs text-gray-500">
                        {config.supportsAgentMode
                          ? 'Choose agent mode and model'
                          : 'Configure agent instructions'
                        }
                      </span>
                    </div>

                    {/* VOICE CHANNELS (Twilio & Web): Agent Mode Selection with Model Options */}
                    {config.supportsAgentMode && (
                      <>
                        {/* Agent Mode Selection */}
                        <div className="space-y-3">
                          <Label className="text-sm text-gray-600">Agent Mode</Label>
                          <div className="grid grid-cols-1 gap-3">
                            {(Object.entries(VOICE_AGENT_MODES) as [AgentMode, typeof VOICE_AGENT_MODES[AgentMode]][]).map(([mode, modeConfig]) => {
                              const ModeIcon = modeConfig.icon;
                              const isSelected = getAgentMode(channelData.settings) === mode;
                              
                              return (
                                <div
                                  key={mode}
                                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                    isSelected
                                      ? 'border-purple-500 bg-purple-50'
                                      : 'border-gray-200 hover:border-gray-300'
                                  }`}
                                  onClick={() => handleAgentModeChange(channelKey, mode)}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-purple-100' : 'bg-gray-100'}`}>
                                      <ModeIcon className={`w-5 h-5 ${isSelected ? 'text-purple-600' : 'text-gray-500'}`} />
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">{modeConfig.name}</span>
                                        {modeConfig.recommended && (
                                          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                                            RECOMMENDED
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-500 mt-1">{modeConfig.description}</p>
                                      
                                      {/* Two-Agent Mode: Show fixed models */}
                                      {mode === 'two_agent' && modeConfig.twoAgentModels && (
                                        <div className="mt-3 pt-2 border-t border-gray-100">
                                          <div className="flex flex-wrap gap-2">
                                            {Object.entries(modeConfig.twoAgentModels).map(([role, modelInfo]) => (
                                              <div key={role} className="flex items-center gap-1.5 text-xs">
                                                <span className={`px-2 py-1 rounded ${isSelected ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                                  <span className="font-medium capitalize">{role}:</span> {modelInfo.label}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    {isSelected && <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0" />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* One-Agent Mode: Model Selection */}
                        {getAgentMode(channelData.settings) === 'one_agent' && (
                          <div className="space-y-3 p-4 border border-purple-200 rounded-lg bg-purple-50/50">
                            <Label className="text-sm text-purple-700 flex items-center gap-2">
                              <Cpu className="w-4 h-4" />
                              Single Agent Model
                            </Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {ONE_AGENT_MODEL_OPTIONS.map(option => {
                                const isSelected = getOneAgentModel(channelData.settings) === option.value;
                                return (
                                  <div
                                    key={option.value}
                                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                                      isSelected
                                        ? 'border-purple-500 bg-white'
                                        : 'border-purple-200 bg-white/50 hover:border-purple-300'
                                    }`}
                                    onClick={() => handleOneAgentModelChange(channelKey, option.value)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-sm">{option.label}</span>
                                      <div className="flex items-center gap-2">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                          option.costLevel === 'High' 
                                            ? 'bg-amber-100 text-amber-700'
                                            : 'bg-green-100 text-green-700'
                                        }`}>
                                          {option.costLevel} Cost
                                        </span>
                                        {option.recommended && (
                                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                                            Best Quality
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{option.description}</p>
                                    {isSelected && (
                                      <div className="mt-2 flex items-center gap-1 text-xs text-purple-600">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Selected
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Voice Channel Instructions based on mode */}
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <FileText className="w-4 h-4" />
                            <span className="font-medium">Agent Instructions</span>
                          </div>
                          
                          {VOICE_AGENT_MODES[getAgentMode(channelData.settings) as keyof typeof VOICE_AGENT_MODES].instructions.map((instruction) => (
                            <div key={instruction.key} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm">{instruction.label}</Label>
                                <span className="text-xs text-gray-400">{instruction.description}</span>
                              </div>
                              <Textarea
                                value={getAgentInstructions(channelData.settings, instruction.key)}
                                onChange={(e) => handleAgentInstructionsChange(channelKey, instruction.key, e.target.value)}
                                placeholder={`Enter ${instruction.label.toLowerCase()}...`}
                                className="min-h-[150px] font-mono text-sm"
                              />
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* TEXT-ONLY CHANNELS (Retell & WhatsApp): Simple single agent config */}
                    {!config.supportsAgentMode && (
                      <div className="space-y-4">
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-2 text-sm">
                            <Bot className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">Single Agent Mode</span>
                            {channelKey === 'retell' && (
                              <span className="text-xs text-gray-500">(Retell handles voice - you choose AI model above)</span>
                            )}
                            {channelKey === 'whatsapp' && (
                              <span className="text-xs text-gray-500">(Text-only conversations)</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              Agent Instructions
                            </Label>
                            <span className="text-xs text-gray-400">Customize agent behavior</span>
                          </div>
                          <Textarea
                            value={getAgentInstructions(channelData.settings, 'one_agent_instructions')}
                            onChange={(e) => handleAgentInstructionsChange(channelKey, 'one_agent_instructions', e.target.value)}
                            placeholder="Enter agent instructions..."
                            className="min-h-[150px] font-mono text-sm"
                          />
                        </div>
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" />
                      Leave empty to use system default instructions. Custom instructions override defaults entirely.
                    </p>
                  </div>

                  {/* Credential Warning */}
                  {!hasCredential && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">
                            Missing Credentials
                          </p>
                          <p className="text-xs text-amber-700 mt-1">
                            Configure {config.requiresCredential} credentials in the Integrations page before enabling this channel.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => window.location.href = '/admin/settings/integrations'}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Go to Integrations
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Save Button */}
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <Button
                      onClick={() => handleSaveChannel(channelKey)}
                      disabled={saving === channelKey}
                    >
                      {saving === channelKey ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save Configuration
                    </Button>
                    
                    {channelKey === 'web' && channelData.enabled && (
                      <Button
                        variant="outline"
                        onClick={() => window.open('/agent-ui', '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Test Web Channel
                      </Button>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Pipeline Summary with Visual Flow */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Active Pipelines
          </CardTitle>
          <CardDescription>Visual overview of how data flows through your system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(Object.entries(channels) as [ChannelType, ChannelConfig][])
            .filter(([_, config]) => config.enabled)
            .map(([key, config]) => {
              const channelConfig = CHANNEL_CONFIGS[key];
              const Icon = channelConfig.icon;
              const agentMode = getAgentMode(config.settings);
              const oneAgentModel = getOneAgentModel(config.settings);
              const isVoiceChannel = channelConfig.supportsAgentMode;
              
              // Get model info based on channel type
              let modelDisplay: { label: string; mode: string } = { label: '', mode: '' };
              
              if (isVoiceChannel) {
                // Voice channels (Twilio & Web) - use agent mode and model selection
                if (agentMode === 'one_agent') {
                  const modelOption = ONE_AGENT_MODEL_OPTIONS.find(o => o.value === oneAgentModel);
                  modelDisplay = { 
                    label: modelOption?.label || 'GPT-4o Realtime',
                    mode: '1 Agent'
                  };
                } else {
                  const twoAgentModels = VOICE_AGENT_MODES.two_agent.twoAgentModels!;
                  modelDisplay = { 
                    label: `${twoAgentModels.receptionist.label} + ${twoAgentModels.supervisor.label}`,
                    mode: '2 Agents'
                  };
                }
              } else {
                // Text-only channels (Retell & WhatsApp)
                const backendLabel = channelConfig.aiBackendOptions.find(o => o.value === config.ai_backend)?.label || config.ai_backend;
                modelDisplay = { 
                  label: backendLabel, 
                  mode: key === 'retell' ? 'Retell Voice' : '1 Agent'
                };
              }

              return (
                <div key={key} className="border rounded-lg p-4 bg-gradient-to-r from-gray-50 to-white">
                  {/* Pipeline Flow */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Channel */}
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${getColorClasses(channelConfig.color, true)}`}>
                      <Icon className="w-4 h-4" />
                      <span className="font-medium text-sm">{channelConfig.name}</span>
                    </div>
                    
                    <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    
                    {/* Agent Mode - Show for voice channels */}
                    {isVoiceChannel && (
                      <>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-100 text-violet-700">
                          {agentMode === 'one_agent' ? <Bot className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                          <span className="font-medium text-sm">{modelDisplay.mode}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </>
                    )}
                    
                    {/* AI Model(s) */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-100 text-purple-700">
                      <Cpu className="w-4 h-4" />
                      <div className="text-sm">
                        <span className="font-medium">{modelDisplay.label}</span>
                      </div>
                    </div>
                    
                    <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    
                    {/* Local DB (always) */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-100 text-blue-700">
                      <HardDrive className="w-4 h-4" />
                      <span className="font-medium text-sm">Local DB</span>
                    </div>
                    
                    {/* External Integrations (filter out embedded_booking as it's shown separately) */}
                    {(() => {
                      const externalIntegrations = (config.data_integrations || []).filter(i => i !== 'embedded_booking');
                      if (externalIntegrations.length === 0) return null;
                      
                      return (
                        <>
                          <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="flex items-center gap-1 flex-wrap">
                            {externalIntegrations.map(integrationKey => {
                              const integration = DATA_INTEGRATIONS[integrationKey];
                              if (!integration) return null;
                              const IntIcon = integration.icon;
                              return (
                                <div 
                                  key={integrationKey}
                                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-green-100 text-green-700 text-sm"
                                >
                                  <IntIcon className="w-3.5 h-3.5" />
                                  <span>{integration.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  
                  {/* Data types synced to external systems */}
                  {(() => {
                    const externalIntegrations = (config.data_integrations || []).filter(i => i !== 'embedded_booking');
                    if (externalIntegrations.length === 0) return null;
                    
                    const syncedDataTypes = [...new Set(
                      externalIntegrations.flatMap(i => DATA_INTEGRATIONS[i]?.dataTypes || [])
                    )];
                    
                    return (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>External sync:</span>
                          {syncedDataTypes.map((dt, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded">{dt}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          
          {!Object.values(channels).some(c => c.enabled) && (
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No channels enabled</p>
              <p className="text-sm">Enable a channel above to see the data flow</p>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 pt-4 border-t text-xs text-gray-500">
            <span className="font-medium">Legend:</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-100"></div>
              <span>Channel</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-violet-100"></div>
              <span>Agent Mode</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-purple-100"></div>
              <span>AI Model</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-100"></div>
              <span>Local Storage</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-100"></div>
              <span>External Sync</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
