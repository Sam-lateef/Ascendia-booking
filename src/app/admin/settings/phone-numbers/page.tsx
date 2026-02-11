'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Settings,
  Trash2,
  Pencil,
  Save,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface PhoneNumber {
  id: string;
  phone_number: string;
  channel: string;
  is_active: boolean;
  metadata: {
    assistant_id?: string;
    assistant_name?: string;
    voice_provider?: string;
    vapi_phone_number_id?: string;
    vapi_status?: string;
  };
  created_at: string;
}

interface VapiOptions {
  voiceProviders: Array<{ value: string; label: string }>;
  voicesByProvider: Record<string, Array<{ value: string; label: string }>>;
  modelProviders: Array<{ value: string; label: string }>;
  modelsByProvider: Record<string, Array<{ value: string; label: string }>>;
  transcribers: Array<{ value: string; label: string }>;
  transcriberModels: Record<string, Array<{ value: string; label: string }>>;
  languages: Array<{ value: string; label: string }>;
  firstMessageModes: Array<{ value: string; label: string }>;
  countries: Array<{ value: string; label: string }>;
  elevenLabsModels: Array<{ value: string; label: string }>;
}

export default function PhoneNumbersPage() {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<'config' | 'creating' | 'complete'>('config');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [vapiOptions, setVapiOptions] = useState<VapiOptions | null>(null);
  const [templateConfig, setTemplateConfig] = useState<any>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Basic form state
  const [assistantName, setAssistantName] = useState('');
  const [areaCode, setAreaCode] = useState('');
  const [country, setCountry] = useState('US');

  // Model settings
  const [modelProvider, setModelProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState('0.5');
  const [maxTokens, setMaxTokens] = useState('250');

  // Voice settings
  const [voiceProvider, setVoiceProvider] = useState('vapi');
  const [voiceId, setVoiceId] = useState('');
  const [voiceModel, setVoiceModel] = useState('');

  // Transcriber settings
  const [transcriberProvider, setTranscriberProvider] = useState('deepgram');
  const [transcriberModel, setTranscriberModel] = useState('nova-3');
  const [language, setLanguage] = useState('en');

  // Message settings
  const [firstMessage, setFirstMessage] = useState('');
  const [firstMessageMode, setFirstMessageMode] = useState('assistant-speaks-first');
  const [systemPrompt, setSystemPrompt] = useState('');

  // Advanced settings
  const [backgroundDenoising, setBackgroundDenoising] = useState(true);
  const [endCallPhrases, setEndCallPhrases] = useState<string[]>([]);
  const [endCallMessage, setEndCallMessage] = useState('');
  
  // Result state
  const [createdAssistantId, setCreatedAssistantId] = useState('');
  const [createdPhoneNumber, setCreatedPhoneNumber] = useState('');

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editPhoneId, setEditPhoneId] = useState('');
  const [editAssistantName, setEditAssistantName] = useState('');
  const [editFirstMessage, setEditFirstMessage] = useState('');
  const [editSystemPrompt, setEditSystemPrompt] = useState('');
  const [editVoicemailMessage, setEditVoicemailMessage] = useState('');
  const [editEndCallMessage, setEditEndCallMessage] = useState('');
  const [editTemperature, setEditTemperature] = useState('0.5');
  const [editMaxTokens, setEditMaxTokens] = useState('250');
  const [editFirstMessageMode, setEditFirstMessageMode] = useState('assistant-speaks-first');
  const [editBackgroundDenoising, setEditBackgroundDenoising] = useState(true);
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editAssistantId, setEditAssistantId] = useState('');
  const [editVoiceProvider, setEditVoiceProvider] = useState('');
  const [editVoiceId, setEditVoiceId] = useState('');
  const [editVoiceModel, setEditVoiceModel] = useState('');
  const [editModelProvider, setEditModelProvider] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editTranscriberProvider, setEditTranscriberProvider] = useState('');
  const [editTranscriberModel, setEditTranscriberModel] = useState('');
  const [editLanguage, setEditLanguage] = useState('en');

  useEffect(() => {
    fetchPhoneNumbers();
    loadVapiOptions();
    loadTemplateConfig();
  }, []);

  // Auto-refresh when there are numbers still activating
  useEffect(() => {
    const hasActivating = phoneNumbers.some(
      pn => pn.metadata?.vapi_status === 'activating' || 
            (!pn.phone_number || pn.phone_number.length < 4)
    );
    if (hasActivating) {
      const interval = setInterval(() => {
        fetchPhoneNumbers();
      }, 8000); // Check every 8 seconds
      return () => clearInterval(interval);
    }
  }, [phoneNumbers]);

  const fetchPhoneNumbers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/phone-numbers');
      if (response.ok) {
        const data = await response.json();
        setPhoneNumbers(data.phoneNumbers || []);
      }
    } catch (error) {
      console.error('Error fetching phone numbers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVapiOptions = async () => {
    try {
      const response = await fetch('/api/admin/phone-numbers/vapi-options');
      if (response.ok) {
        const data = await response.json();
        setVapiOptions(data);
      }
    } catch (error) {
      console.error('[Vapi Options] Error loading:', error);
    }
  };

  const loadTemplateConfig = async () => {
    try {
      const response = await fetch('/api/admin/phone-numbers/preview-template');
      if (response.ok) {
        const data = await response.json();
        setTemplateConfig(data);
        
        // Populate form with template defaults
        if (data.model) {
          setModelProvider(data.model.provider || 'openai');
          setModel(data.model.model || 'gpt-4o');
          setTemperature(String(data.model.temperature ?? 0.5));
          setMaxTokens(String(data.model.maxTokens ?? 250));
        }
        
        if (data.voice) {
          const provider = data.voice.provider || 'vapi';
          setVoiceProvider(provider);
          
          // Active Vapi voices (PascalCase, from docs.vapi.ai/providers/voice/vapi-voices/legacy-migration)
          const activeVapiVoices = ['Elliot', 'Savannah', 'Leo', 'Zoe', 'Mia', 'Jess', 'Zac', 'Dan', 'Leah', 'Tara', 'Rohan'];
          
          if (provider === 'vapi') {
            const voiceId = data.voice.voiceId || 'Elliot';
            setVoiceId(activeVapiVoices.includes(voiceId) ? voiceId : 'Elliot');
          } else {
            setVoiceId(data.voice.voiceId || '');
          }
          
          if (data.voice.provider === '11labs') {
            setVoiceModel(data.voice.model || 'eleven_turbo_v2_5');
          }
        }
        
        if (data.transcriber) {
          setTranscriberProvider(data.transcriber.provider || 'deepgram');
          setTranscriberModel(data.transcriber.model || 'nova-3');
          setLanguage(data.transcriber.language || 'en');
        }
        
        if (data.firstMessageMode) {
          setFirstMessageMode(data.firstMessageMode);
        }
        
        if (data.firstMessage) {
          setFirstMessage(data.firstMessage);
        }
        
        if (data.model?.messages?.[0]?.content) {
          setSystemPrompt(data.model.messages[0].content);
        }
        
        setBackgroundDenoising(data.backgroundDenoisingEnabled ?? true);
        setEndCallMessage(data.endCallMessage || '');
        setEndCallPhrases(data.endCallPhrases || []);
      }
    } catch (error) {
      console.error('[Template Config] Error loading:', error);
    }
  };

  const handleSetupNewNumber = async () => {
    if (!assistantName.trim()) {
      setSetupError('Please enter an assistant name');
      return;
    }

    if (!areaCode.trim() || areaCode.length !== 3) {
      setSetupError('Please enter a valid 3-digit area code (e.g., 555)');
      return;
    }

    setSetupError(null);
    setSetupStep('creating');

    try {
      // Call API to create assistant + purchase number with ALL parameters
      const response = await fetch('/api/admin/phone-numbers/setup-vapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Basic
          assistantName,
          areaCode,
          country,
          
          // Model
          modelProvider,
          model,
          temperature: parseFloat(temperature),
          maxTokens: parseInt(maxTokens),
          
          // Voice
          voiceProvider,
          voiceId,
          voiceModel,
          
          // Transcriber
          transcriberProvider,
          transcriberModel,
          language,
          
          // Messages
          firstMessage,
          firstMessageMode,
          systemPrompt,
          
          // Advanced
          backgroundDenoising,
          endCallMessage,
          endCallPhrases
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Setup failed');
      }

      // Success!
      setCreatedAssistantId(data.assistantId);
      setCreatedPhoneNumber(data.phoneNumber || 'Activating...');
      setSetupStep('complete');
      
      // Refresh the list
      await fetchPhoneNumbers();
    } catch (error: any) {
      console.error('Setup error:', error);
      setSetupError(error.message || 'Failed to setup phone number');
      setSetupStep('config');
    }
  };

  const handleCloseDialog = () => {
    setSetupDialogOpen(false);
    setSetupStep('config');
    setSetupError(null);
    setAssistantName('');
    setAreaCode('');
    setCreatedAssistantId('');
    setCreatedPhoneNumber('');
    
    // Reset to template defaults
    if (templateConfig) {
      if (templateConfig.model) {
        setModelProvider(templateConfig.model.provider || 'openai');
        setModel(templateConfig.model.model || 'gpt-4o');
        setTemperature(String(templateConfig.model.temperature ?? 0.5));
        setMaxTokens(String(templateConfig.model.maxTokens ?? 250));
      }
      
      if (templateConfig.voice) {
        const provider = templateConfig.voice.provider || 'vapi';
        setVoiceProvider(provider);
        
        // Active Vapi voices (PascalCase, from docs.vapi.ai/providers/voice/vapi-voices/legacy-migration)
        const activeVapiVoices = ['Elliot', 'Savannah', 'Leo', 'Zoe', 'Mia', 'Jess', 'Zac', 'Dan', 'Leah', 'Tara', 'Rohan'];
        
        if (provider === 'vapi') {
          const voiceId = templateConfig.voice.voiceId || 'Elliot';
          setVoiceId(activeVapiVoices.includes(voiceId) ? voiceId : 'Elliot');
        } else {
          setVoiceId(templateConfig.voice.voiceId || '');
        }
        
        if (templateConfig.voice.provider === '11labs') {
          setVoiceModel(templateConfig.voice.model || 'eleven_turbo_v2_5');
        }
      }
      
      if (templateConfig.transcriber) {
        setTranscriberProvider(templateConfig.transcriber.provider || 'deepgram');
        setTranscriberModel(templateConfig.transcriber.model || 'nova-3');
        setLanguage(templateConfig.transcriber.language || 'en');
      }
      
      if (templateConfig.firstMessage) {
        setFirstMessage(templateConfig.firstMessage);
      }
      
      if (templateConfig.model?.messages?.[0]?.content) {
        setSystemPrompt(templateConfig.model.messages[0].content);
      }
    }
  };

  const handleDeleteNumber = async (id: string) => {
    if (!confirm('Are you sure you want to delete this phone number?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/phone-numbers/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchPhoneNumbers();
      } else {
        alert('Failed to delete phone number');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete phone number');
    }
  };

  // Edit functions
  const handleOpenEdit = async (phone: PhoneNumber) => {
    setEditPhoneId(phone.id);
    setEditPhoneNumber(phone.phone_number);
    setEditError(null);
    setEditLoading(true);
    setEditDialogOpen(true);

    try {
      const response = await fetch(`/api/admin/phone-numbers/${phone.id}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to load assistant config');
      }

      const data = await response.json();
      setEditAssistantId(data.assistantId);
      setEditAssistantName(data.assistantName);
      setEditFirstMessage(data.firstMessage);
      setEditSystemPrompt(data.systemPrompt);
      setEditVoicemailMessage(data.voicemailMessage);
      setEditEndCallMessage(data.endCallMessage);
      setEditTemperature(String(data.model?.temperature ?? 0.5));
      setEditMaxTokens(String(data.model?.maxTokens ?? 250));
      setEditModelProvider(data.model?.provider || 'openai');
      setEditModel(data.model?.model || 'gpt-4o');
      setEditFirstMessageMode(data.firstMessageMode);
      setEditBackgroundDenoising(data.backgroundDenoisingEnabled);
      setEditVoiceProvider(data.voice?.provider || 'vapi');
      setEditVoiceId(data.voice?.voiceId || '');
      setEditVoiceModel(data.voice?.model || '');
      setEditTranscriberProvider(data.transcriber?.provider || 'deepgram');
      setEditTranscriberModel(data.transcriber?.model || 'nova-3');
      setEditLanguage(data.transcriber?.language || 'en');
    } catch (error: any) {
      setEditError(error.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    setEditSaving(true);
    setEditError(null);

    try {
      const response = await fetch(`/api/admin/phone-numbers/${editPhoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistantName: editAssistantName,
          firstMessage: editFirstMessage,
          systemPrompt: editSystemPrompt,
          voicemailMessage: editVoicemailMessage,
          endCallMessage: editEndCallMessage,
          temperature: editTemperature,
          maxTokens: editMaxTokens,
          modelProvider: editModelProvider,
          model: editModel,
          firstMessageMode: editFirstMessageMode,
          backgroundDenoisingEnabled: editBackgroundDenoising,
          voiceProvider: editVoiceProvider,
          voiceId: editVoiceId,
          voiceModel: editVoiceModel,
          transcriberProvider: editTranscriberProvider,
          transcriberModel: editTranscriberModel,
          language: editLanguage,
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save changes');
      }

      setEditDialogOpen(false);
      await fetchPhoneNumbers();
    } catch (error: any) {
      setEditError(error.message);
    } finally {
      setEditSaving(false);
    }
  };

  const formatPhoneNumber = (phone: string | undefined | null): string => {
    if (!phone || phone === 'Activating...') return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Phone className="h-8 w-8 text-blue-600" />
            Phone Numbers
          </h1>
          <p className="text-gray-600 mt-1">
            Manage Vapi voice phone numbers for your organization
          </p>
        </div>
        <Button
          onClick={() => setSetupDialogOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Setup New Number
        </Button>
      </div>

      {/* Phone Numbers List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Active Phone Numbers</h2>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Loading phone numbers...</p>
          </div>
        ) : phoneNumbers.length === 0 ? (
          <div className="p-12 text-center">
            <Phone className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2">No phone numbers configured</p>
            <p className="text-gray-500 text-sm mb-4">
              Get started by setting up your first Vapi phone number
            </p>
            <Button onClick={() => setSetupDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Setup New Number
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {phoneNumbers.map((phone) => (
              <div key={phone.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Phone className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900 text-lg">
                          {(!phone.phone_number || phone.phone_number === 'Activating...' || phone.phone_number.length < 4)
                            ? <span className="text-amber-600 flex items-center gap-1">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Activating...
                              </span>
                            : formatPhoneNumber(phone.phone_number)
                          }
                        </p>
                        {phone.metadata?.vapi_status === 'activating' ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50">
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            Activating
                          </Badge>
                        ) : (
                          <Badge variant={phone.is_active ? 'default' : 'secondary'}>
                            {phone.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {phone.channel}
                        </Badge>
                      </div>
                      {phone.metadata?.assistant_name && (
                        <p className="text-sm text-gray-600">
                          Assistant: {phone.metadata.assistant_name}
                        </p>
                      )}
                      {phone.metadata?.voice_provider && (
                        <p className="text-xs text-gray-500">
                          Voice: {phone.metadata.voice_provider === '11labs' ? 'ElevenLabs' : phone.metadata.voice_provider}
                        </p>
                      )}
                      {phone.metadata?.assistant_id && (
                        <p className="text-xs text-gray-400 font-mono mt-1">
                          {phone.metadata.assistant_id}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(phone)}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      title="Edit assistant configuration"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteNumber(phone.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Setup Dialog */}
      <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-600" />
              Setup Vapi Phone Number
            </DialogTitle>
            <DialogDescription>
              Configure your assistant and purchase a phone number
            </DialogDescription>
          </DialogHeader>

          {setupStep === 'config' && (
            <div className="space-y-6">
              {setupError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{setupError}</p>
                </div>
              )}

              {/* Basic Configuration */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                  Basic Configuration
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assistantName">Assistant Name *</Label>
                    <Input
                      id="assistantName"
                      placeholder="e.g., Sarah"
                      value={assistantName}
                      onChange={(e) => setAssistantName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="areaCode">Area Code (Preference) *</Label>
                    <Input
                      id="areaCode"
                      placeholder="619"
                      maxLength={3}
                      value={areaCode}
                      onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, ''))}
                    />
                    <p className="text-xs text-gray-500">
                      Note: Vapi provisions US numbers automatically. Area code may not be guaranteed.
                    </p>
                  </div>
                </div>
              </div>

              {/* Model Settings */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                  AI Model Settings
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Model Provider</Label>
                    <Select 
                      value={modelProvider} 
                      onValueChange={(value) => {
                        setModelProvider(value);
                        // Clear model when switching providers
                        setModel('');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {vapiOptions?.modelProviders.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {vapiOptions?.modelsByProvider[modelProvider]?.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Temperature</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">0 = deterministic, 2 = creative</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Max Tokens</Label>
                    <Input
                      type="number"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Response length limit</p>
                  </div>
                </div>
              </div>

              {/* Voice Settings */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                  Voice Settings
                </h3>
                
                <div className="space-y-2">
                  <Label>Voice Provider</Label>
                  <Select 
                    value={voiceProvider} 
                    onValueChange={(value) => {
                      setVoiceProvider(value);
                      // Set default voice for new provider (PascalCase for Vapi)
                      if (value === 'vapi') {
                        setVoiceId('Elliot');
                      } else if (value === '11labs') {
                        setVoiceId('sarah');
                      } else {
                        setVoiceId('');
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {vapiOptions?.voiceProviders.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Voice selection dropdown for all providers */}
                {vapiOptions?.voicesByProvider[voiceProvider] && (
                  <div className="space-y-2">
                    <Label>Voice</Label>
                    <Select value={voiceId} onValueChange={setVoiceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select voice" />
                      </SelectTrigger>
                      <SelectContent>
                        {vapiOptions.voicesByProvider[voiceProvider].map((v) => (
                          <SelectItem key={v.value} value={v.value}>
                            {v.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* ElevenLabs specific settings */}
                {voiceProvider === '11labs' && (
                  <div className="space-y-2">
                    <Label>ElevenLabs Model</Label>
                    <Select value={voiceModel} onValueChange={setVoiceModel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {vapiOptions?.elevenLabsModels.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Transcriber Settings */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                  Transcriber Settings
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select 
                      value={transcriberProvider} 
                      onValueChange={(value) => {
                        setTranscriberProvider(value);
                        // Clear model when switching providers
                        setTranscriberModel('');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {vapiOptions?.transcribers.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select value={transcriberModel} onValueChange={setTranscriberModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {vapiOptions?.transcriberModels[transcriberProvider]?.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {vapiOptions?.languages.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Message Settings */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                  Message Settings
                </h3>
                
                <div className="space-y-2">
                  <Label>First Message Mode</Label>
                  <Select value={firstMessageMode} onValueChange={setFirstMessageMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {vapiOptions?.firstMessageModes.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>First Message</Label>
                  <Textarea
                    placeholder="Hi! This is [assistant name]..."
                    value={firstMessage}
                    onChange={(e) => setFirstMessage(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>System Prompt (Instructions)</Label>
                  <Textarea
                    placeholder="You are a helpful assistant..."
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                    Advanced Settings
                  </h3>
                  {showAdvanced ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="backgroundDenoising"
                        checked={backgroundDenoising}
                        onChange={(e) => setBackgroundDenoising(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="backgroundDenoising" className="cursor-pointer">
                        Enable background denoising
                      </Label>
                    </div>

                    <div className="space-y-2">
                      <Label>End Call Message</Label>
                      <Textarea
                        placeholder="Thank you for calling..."
                        value={endCallMessage}
                        onChange={(e) => setEndCallMessage(e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-900">
                  <strong>What happens next:</strong>
                </p>
                <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                  <li>Create Vapi assistant with your custom configuration</li>
                  <li>Provision a US phone number from Vapi (automatically assigned)</li>
                  <li>Link phone number to your assistant</li>
                  <li>Save everything to your database</li>
                </ul>
                <p className="text-xs text-blue-700 mt-2">
                  Vapi will automatically provision an available US phone number. Specific area code selection may not be available through the API.
                </p>
              </div>
            </div>
          )}

          {setupStep === 'creating' && (
            <div className="py-8 text-center">
              <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900 mb-2">
                Setting up your phone number...
              </p>
              <p className="text-sm text-gray-600">
                This may take 30-60 seconds
              </p>
              <div className="mt-6 space-y-2 text-left max-w-xs mx-auto">
                <div className="flex items-center gap-2 text-sm">
                  <Settings className="h-4 w-4 animate-spin text-blue-600" />
                  <span>Creating Vapi assistant...</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="h-4 w-4" />
                  <span>Buying phone number...</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="h-4 w-4" />
                  <span>Assigning assistant...</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="h-4 w-4" />
                  <span>Saving to database...</span>
                </div>
              </div>
            </div>
          )}

          {setupStep === 'complete' && (
            <div className="py-6">
              <div className="text-center mb-6">
                <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  Setup Complete!
                </p>
                <p className="text-sm text-gray-600">
                  Your assistant and phone number have been created
                </p>
              </div>

              <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                <div>
                  <Label className="text-xs text-gray-600">Phone Number</Label>
                  <p className="font-semibold text-lg">
                    {createdPhoneNumber === 'Activating...' 
                      ? 'Activating (2-4 minutes)...' 
                      : formatPhoneNumber(createdPhoneNumber)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Assistant</Label>
                  <p className="font-medium">{assistantName}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Assistant ID</Label>
                  <p className="font-mono text-xs text-gray-700">{createdAssistantId}</p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-900">
                  <strong>Important:</strong> It takes 2-4 minutes for the phone number to be fully activated. During this period, calls will not work.
                </p>
              </div>

              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-900">
                  <strong>Next steps:</strong>
                </p>
                <ul className="text-sm text-green-800 mt-2 space-y-1 list-disc list-inside">
                  <li>Wait 2-4 minutes for activation</li>
                  <li>Test by calling the number once active</li>
                  <li>Monitor calls in Admin  Calls</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            {setupStep === 'config' && (
              <>
                <Button
                  variant="outline"
                  onClick={handleCloseDialog}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSetupNewNumber}
                  disabled={!assistantName || !areaCode}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Setup Phone Number
                </Button>
              </>
            )}
            {setupStep === 'creating' && (
              <Button disabled>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting up...
              </Button>
            )}
            {setupStep === 'complete' && (
              <Button onClick={handleCloseDialog} className="w-full">
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-600" />
              Edit Assistant Configuration
            </DialogTitle>
            <DialogDescription>
              {editPhoneNumber ? formatPhoneNumber(editPhoneNumber) : ''} 
              {editAssistantId ? ` — ${editAssistantId}` : ''}
            </DialogDescription>
          </DialogHeader>

          {editLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading assistant configuration...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{editError}</p>
                </div>
              )}

              {/* Basic */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                  Basic
                </h3>
                <div className="space-y-2">
                  <Label>Assistant Name</Label>
                  <Input
                    value={editAssistantName}
                    onChange={(e) => setEditAssistantName(e.target.value)}
                  />
                </div>
              </div>

              {/* Messages & Prompts */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                  Messages & Prompts
                </h3>
                
                <div className="space-y-2">
                  <Label>System Prompt (Instructions)</Label>
                  <Textarea
                    value={editSystemPrompt}
                    onChange={(e) => setEditSystemPrompt(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                    placeholder="You are a helpful assistant..."
                  />
                  <p className="text-xs text-gray-500">This is the main instruction prompt for the AI assistant</p>
                </div>

                <div className="space-y-2">
                  <Label>First Message</Label>
                  <Textarea
                    value={editFirstMessage}
                    onChange={(e) => setEditFirstMessage(e.target.value)}
                    rows={3}
                    placeholder="Hi! Thanks for calling..."
                  />
                  <p className="text-xs text-gray-500">What the assistant says when answering a call</p>
                </div>

                <div className="space-y-2">
                  <Label>First Message Mode</Label>
                  <Select value={editFirstMessageMode} onValueChange={setEditFirstMessageMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {vapiOptions?.firstMessageModes.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Voicemail Message</Label>
                  <Textarea
                    value={editVoicemailMessage}
                    onChange={(e) => setEditVoicemailMessage(e.target.value)}
                    rows={2}
                    placeholder="Please leave a message..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Call Message</Label>
                  <Textarea
                    value={editEndCallMessage}
                    onChange={(e) => setEditEndCallMessage(e.target.value)}
                    rows={2}
                    placeholder="Thank you for calling..."
                  />
                </div>
              </div>

              {/* AI Model Settings */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                  AI Model Settings
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Model Provider</Label>
                    <Select 
                      value={editModelProvider} 
                      onValueChange={(value) => {
                        setEditModelProvider(value);
                        setEditModel('');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {vapiOptions?.modelProviders.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select value={editModel} onValueChange={setEditModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {vapiOptions?.modelsByProvider[editModelProvider]?.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Temperature</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={editTemperature}
                      onChange={(e) => setEditTemperature(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">0 = deterministic, 2 = creative</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Tokens</Label>
                    <Input
                      type="number"
                      value={editMaxTokens}
                      onChange={(e) => setEditMaxTokens(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Response length limit</p>
                  </div>
                </div>
              </div>

              {/* Voice Settings */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                  Voice Settings
                </h3>
                <div className="space-y-2">
                  <Label>Voice Provider</Label>
                  <Select 
                    value={editVoiceProvider} 
                    onValueChange={(value) => {
                      setEditVoiceProvider(value);
                      if (value === 'vapi') setEditVoiceId('Elliot');
                      else if (value === '11labs') setEditVoiceId('sarah');
                      else setEditVoiceId('');
                      setEditVoiceModel('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {vapiOptions?.voiceProviders.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {vapiOptions?.voicesByProvider[editVoiceProvider] && (
                  <div className="space-y-2">
                    <Label>Voice</Label>
                    <Select value={editVoiceId} onValueChange={setEditVoiceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select voice" />
                      </SelectTrigger>
                      <SelectContent>
                        {vapiOptions.voicesByProvider[editVoiceProvider].map((v) => (
                          <SelectItem key={v.value} value={v.value}>
                            {v.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {editVoiceProvider === '11labs' && (
                  <div className="space-y-2">
                    <Label>ElevenLabs Model</Label>
                    <Select value={editVoiceModel} onValueChange={setEditVoiceModel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {vapiOptions?.elevenLabsModels.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Transcriber Settings */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                  Transcriber Settings
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select 
                      value={editTranscriberProvider} 
                      onValueChange={(value) => {
                        setEditTranscriberProvider(value);
                        setEditTranscriberModel('');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {vapiOptions?.transcribers.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select value={editTranscriberModel} onValueChange={setEditTranscriberModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {vapiOptions?.transcriberModels[editTranscriberProvider]?.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={editLanguage} onValueChange={setEditLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {vapiOptions?.languages.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Advanced */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                  Advanced
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editBackgroundDenoising"
                    checked={editBackgroundDenoising}
                    onChange={(e) => setEditBackgroundDenoising(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="editBackgroundDenoising" className="cursor-pointer">
                    Enable background denoising
                  </Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={editSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={editLoading || editSaving}
            >
              {editSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
