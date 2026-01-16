'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/lib/i18n/TranslationProvider';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { List, BarChart3, UserPlus, CalendarPlus, CalendarClock, CheckCircle2, XCircle, AlertCircle, Calendar } from 'lucide-react';

// Human-readable action formatter
function formatAction(fc: FunctionCall): { icon: React.ReactNode; text: string; success: boolean } {
  const params = fc.parameters || {};
  const result = fc.result;
  const hasError = !!fc.error;
  
  switch (fc.functionName) {
    case 'CreatePatient': {
      if (hasError) {
        return { 
          icon: <XCircle className="h-4 w-4 text-red-500" />, 
          text: `Failed to create patient: ${fc.error}`,
          success: false 
        };
      }
      const name = `${params.FName || ''} ${params.LName || ''}`.trim() || 'Unknown';
      const phone = params.WirelessPhone ? formatPhone(params.WirelessPhone) : '';
      return { 
        icon: <UserPlus className="h-4 w-4 text-green-500" />, 
        text: `Patient Created: ${name}${phone ? ` (${phone})` : ''}`,
        success: true 
      };
    }
    
    case 'CreateAppointment': {
      if (hasError) {
        return { 
          icon: <XCircle className="h-4 w-4 text-red-500" />, 
          text: `Failed to book appointment: ${fc.error}`,
          success: false 
        };
      }
      const dateTime = params.AptDateTime ? formatDateTime(params.AptDateTime) : 'Unknown time';
      return { 
        icon: <CalendarPlus className="h-4 w-4 text-green-500" />, 
        text: `Appointment Booked: ${dateTime}`,
        success: true 
      };
    }
    
    case 'UpdateAppointment': {
      if (hasError) {
        return { 
          icon: <XCircle className="h-4 w-4 text-red-500" />, 
          text: `Failed to reschedule: ${fc.error}`,
          success: false 
        };
      }
      const newDateTime = params.AptDateTime ? formatDateTime(params.AptDateTime) : '';
      return { 
        icon: <CalendarClock className="h-4 w-4 text-blue-500" />, 
        text: `Appointment Rescheduled${newDateTime ? `: ${newDateTime}` : ''}`,
        success: true 
      };
    }
    
    case 'GetMultiplePatients': {
      if (hasError) {
        return { 
          icon: <XCircle className="h-4 w-4 text-red-500" />, 
          text: `Patient lookup failed`,
          success: false 
        };
      }
      const found = Array.isArray(result) && result.length > 0;
      if (found) {
        const patient = result[0];
        const name = `${patient.FName || ''} ${patient.LName || ''}`.trim();
        return { 
          icon: <CheckCircle2 className="h-4 w-4 text-green-500" />, 
          text: `Patient Found: ${name} (#${patient.PatNum})`,
          success: true 
        };
      }
      return { 
        icon: <AlertCircle className="h-4 w-4 text-yellow-500" />, 
        text: `Patient Not Found`,
        success: false 
      };
    }
    
    case 'GetAvailableSlots': {
      const dateStart = params.dateStart || '';
      const dateEnd = params.dateEnd || '';
      const slotsFound = Array.isArray(result) ? result.length : 0;
      return { 
        icon: <Calendar className="h-4 w-4 text-blue-500" />, 
        text: `Searched Availability: ${dateStart}${dateEnd !== dateStart ? ` - ${dateEnd}` : ''} (${slotsFound} slots)`,
        success: slotsFound > 0 
      };
    }
    
    case 'GetAppointments': {
      const count = Array.isArray(result) ? result.length : 0;
      return { 
        icon: <Calendar className="h-4 w-4 text-blue-500" />, 
        text: `Checked Appointments: ${count} found`,
        success: true 
      };
    }
    
    default:
      return { 
        icon: hasError ? <XCircle className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-gray-400" />, 
        text: fc.functionName,
        success: !hasError 
      };
  }
}

function formatPhone(phone: string): string {
  if (!phone || phone.length !== 10) return phone;
  return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
}

function formatDateTime(dateTimeStr: string): string {
  try {
    const date = new Date(dateTimeStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return dateTimeStr;
  }
}

interface ConversationMessage {
  role: string;
  content: string;
  timestamp: string;
}

interface FunctionCall {
  timestamp: string;
  functionName: string;
  parameters: Record<string, any>;
  result?: any;
  error?: string;
}

interface Conversation {
  sessionId: string;
  channel?: 'voice' | 'sms' | 'whatsapp' | 'web';
  createdAt: string;
  updatedAt: string;
  intent: string;
  stage: string;
  patientName: string;
  patientPhone: string;
  patientId: number | null;
  appointmentType: string;
  appointmentDate: string;
  messageCount: number;
  messages: ConversationMessage[];
  functionCallCount: number;
  functionCalls: FunctionCall[];
  outcome: 'completed' | 'in_progress' | 'abandoned';
}

export default function CallsPage() {
  const t = useTranslations('calls');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/conversations?date=${selectedDate}`);
      const data = await response.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const formatTime = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return timestamp;
    }
  };

  const formatDuration = (createdAt: string, updatedAt: string): string => {
    try {
      const start = new Date(createdAt);
      const end = new Date(updatedAt);
      const durationMs = end.getTime() - start.getTime();
      const minutes = Math.floor(durationMs / 1000 / 60);
      const seconds = Math.floor((durationMs / 1000) % 60);
      if (minutes === 0) {
        return `${seconds}s`;
      }
      return `${minutes}m ${seconds}s`;
    } catch {
      return '-';
    }
  };

  const getOutcomeBadge = (outcome: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-500',
      in_progress: 'bg-blue-500',
      abandoned: 'bg-orange-500',
    };
    const labels: Record<string, string> = {
      completed: 'Completed',
      in_progress: 'In Progress',
      abandoned: 'Abandoned',
    };
    return (
      <Badge className={colors[outcome] || 'bg-gray-500'}>
        {labels[outcome] || outcome}
      </Badge>
    );
  };

  const getChannelBadge = (channel?: string) => {
    const channelConfig: Record<string, { icon: string; label: string; color: string }> = {
      voice: { icon: '📞', label: 'Phone', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
      sms: { icon: '💬', label: 'SMS', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      whatsapp: { icon: '📱', label: 'WhatsApp', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
      web: { icon: '🌐', label: 'Web', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
    };
    
    const config = channelConfig[channel || 'voice'] || channelConfig.voice;
    
    return (
      <Badge className={config.color}>
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </Badge>
    );
  };

  const getIntentBadge = (intent: string) => {
    const colors: Record<string, string> = {
      book: 'bg-blue-100 text-blue-800',
      reschedule: 'bg-yellow-100 text-yellow-800',
      cancel: 'bg-red-100 text-red-800',
      check: 'bg-purple-100 text-purple-800',
      unknown: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge variant="outline" className={colors[intent] || 'bg-gray-100 text-gray-800'}>
        {intent}
      </Badge>
    );
  };

  const viewConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Calls</h1>
          <p className="text-gray-600 mt-2">View patient call recordings and conversation history</p>
        </div>
        <div className="text-center py-8 text-gray-500">
          Loading conversations...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">
            {t('subtitle')}
          </p>
        </div>
        
        {/* View Switcher */}
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm">
            <List className="h-4 w-4 mr-1" />
            Call List
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/booking/calls/statistics')}
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            Statistics
          </Button>
        </div>
      </div>

      {/* Date Filter */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
        <div className="flex-1 sm:flex-initial">
          <Label htmlFor="date">Select Date</Label>
          <Input
            id="date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full sm:w-48"
          />
        </div>
        <Button onClick={fetchConversations} className="w-full sm:w-auto">
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-blue-600">{conversations.length}</div>
          <div className="text-sm text-gray-600">Total Calls</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-green-600">
            {conversations.filter(c => c.outcome === 'completed').length}
          </div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-blue-500">
            {conversations.filter(c => c.outcome === 'in_progress').length}
          </div>
          <div className="text-sm text-gray-600">In Progress</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-orange-500">
            {conversations.filter(c => c.outcome === 'abandoned').length}
          </div>
          <div className="text-sm text-gray-600">Abandoned</div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block border rounded-lg overflow-x-auto bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Intent</TableHead>
              <TableHead>Messages</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                  No calls found for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric'
                  })}
                </TableCell>
              </TableRow>
            ) : (
              conversations.map((conv) => (
                <TableRow key={conv.sessionId}>
                  <TableCell className="font-medium">
                    {formatTime(conv.createdAt)}
                  </TableCell>
                  <TableCell>{getChannelBadge(conv.channel)}</TableCell>
                  <TableCell>
                    {conv.patientName || 'Unknown'}
                    {conv.patientId && (
                      <span className="text-xs text-gray-500 ml-1">#{conv.patientId}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {conv.patientPhone || '-'}
                  </TableCell>
                  <TableCell>{getIntentBadge(conv.intent)}</TableCell>
                  <TableCell>{conv.messageCount}</TableCell>
                  <TableCell className="text-gray-600">
                    {formatDuration(conv.createdAt, conv.updatedAt)}
                  </TableCell>
                  <TableCell>{getOutcomeBadge(conv.outcome)}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewConversation(conv)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {conversations.length === 0 ? (
          <div className="text-center text-gray-500 py-8 border rounded-lg bg-white">
            No calls found for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        ) : (
          conversations.map((conv) => (
            <div key={conv.sessionId} className="border rounded-lg p-4 space-y-3 bg-white">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="text-lg font-semibold text-gray-900">
                    {conv.patientName || 'Unknown Patient'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatTime(conv.createdAt)} • {conv.messageCount} messages
                  </div>
                </div>
                <div>{getOutcomeBadge(conv.outcome)}</div>
              </div>
              <div className="space-y-2 text-sm">
                {conv.patientPhone && (
                  <div>
                    <span className="font-medium text-gray-700">Phone: </span>
                    <span className="text-gray-900">{conv.patientPhone}</span>
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-700">Intent: </span>
                  {getIntentBadge(conv.intent)}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Duration: </span>
                  <span className="text-gray-900">
                    {formatDuration(conv.createdAt, conv.updatedAt)}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => viewConversation(conv)}
                  className="w-full"
                >
                  View Conversation
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Conversation Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Call Details - {selectedConversation?.patientName || 'Unknown'}
            </DialogTitle>
            <DialogDescription>
              {selectedConversation && (
                <span>
                  {formatTime(selectedConversation.createdAt)} • 
                  {selectedConversation.messageCount} messages • 
                  {formatDuration(selectedConversation.createdAt, selectedConversation.updatedAt)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedConversation && (
            <div className="flex-1 overflow-y-auto space-y-4 py-4">
              {/* Call Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-xs text-gray-500">Patient</div>
                  <div className="font-medium">{selectedConversation.patientName || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Phone</div>
                  <div className="font-medium">{selectedConversation.patientPhone || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Intent</div>
                  <div>{getIntentBadge(selectedConversation.intent)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <div>{getOutcomeBadge(selectedConversation.outcome)}</div>
                </div>
                {selectedConversation.appointmentType && (
                  <div>
                    <div className="text-xs text-gray-500">Appointment Type</div>
                    <div className="font-medium">{selectedConversation.appointmentType}</div>
                  </div>
                )}
                {selectedConversation.appointmentDate && (
                  <div>
                    <div className="text-xs text-gray-500">Appointment Date</div>
                    <div className="font-medium">{selectedConversation.appointmentDate}</div>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-700">Conversation</div>
                <div className="space-y-3 max-h-96 overflow-y-auto p-4 border rounded-lg bg-white">
                  {selectedConversation.messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">
                      No messages recorded
                    </div>
                  ) : (
                    selectedConversation.messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            msg.role === 'user'
                              ? 'bg-blue-500 text-white'
                              : msg.role === 'assistant'
                              ? 'bg-gray-100 text-gray-900'
                              : 'bg-yellow-100 text-gray-900'
                          }`}
                        >
                          <div className="text-sm">{msg.content}</div>
                          <div
                            className={`text-xs mt-1 ${
                              msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                            }`}
                          >
                            {formatTime(msg.timestamp)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Actions Taken */}
              {selectedConversation.functionCalls && selectedConversation.functionCalls.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Actions ({selectedConversation.functionCalls.length})
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto p-4 border rounded-lg bg-gray-50">
                    {selectedConversation.functionCalls.map((fc, idx) => {
                      const action = formatAction(fc);
                      return (
                        <div 
                          key={idx} 
                          className={`flex items-start gap-2 p-2 rounded ${
                            action.success ? 'bg-green-50' : 'bg-red-50'
                          }`}
                        >
                          {action.icon}
                          <div className="flex-1">
                            <div className={`text-sm ${action.success ? 'text-gray-700' : 'text-red-700'}`}>
                              {action.text}
                            </div>
                            <div className="text-xs text-gray-400">{formatTime(fc.timestamp)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Session Info */}
              <div className="text-xs text-gray-400 pt-2">
                Session ID: {selectedConversation.sessionId}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

