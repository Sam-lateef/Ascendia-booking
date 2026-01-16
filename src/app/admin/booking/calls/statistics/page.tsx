'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { 
  Phone, 
  Users, 
  Calendar, 
  Clock, 
  MessageSquare,
  TrendingUp,
  UserPlus,
  CalendarPlus,
  CalendarClock,
  XCircle,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  BarChart3,
  List
} from 'lucide-react';

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
        text: `Searched Slots: ${dateStart}${dateEnd !== dateStart ? ` - ${dateEnd}` : ''} (${slotsFound} found)`,
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

function formatDuration(createdAt: string, updatedAt: string): string {
  try {
    const start = new Date(createdAt);
    const end = new Date(updatedAt);
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 1000 / 60);
    const seconds = Math.floor((durationMs / 1000) % 60);
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
  } catch {
    return '-';
  }
}

function formatTime(timestamp: string): string {
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
}

// Stat Card Component
function StatCard({ 
  icon, 
  value, 
  label, 
  color = 'blue',
  subValue 
}: { 
  icon: React.ReactNode; 
  value: string | number; 
  label: string; 
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  subValue?: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
  };
  
  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium opacity-80">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
      {subValue && <div className="text-xs opacity-60 mt-1">{subValue}</div>}
    </div>
  );
}

export default function CallStatisticsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<Conversation | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Date range state
  const [datePreset, setDatePreset] = useState('today');
  const [dateStart, setDateStart] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [dateEnd, setDateEnd] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // Tab state for call groups
  const [activeTab, setActiveTab] = useState<'successful' | 'failed' | 'incomplete'>('successful');

  // Handle preset changes
  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    
    switch (preset) {
      case 'today':
        setDateStart(today.toISOString().split('T')[0]);
        setDateEnd(today.toISOString().split('T')[0]);
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        setDateStart(yesterday.toISOString().split('T')[0]);
        setDateEnd(yesterday.toISOString().split('T')[0]);
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        setDateStart(weekAgo.toISOString().split('T')[0]);
        setDateEnd(today.toISOString().split('T')[0]);
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        setDateStart(monthAgo.toISOString().split('T')[0]);
        setDateEnd(today.toISOString().split('T')[0]);
        break;
      case 'custom':
        // Keep current dates
        break;
    }
  };

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all conversations in date range
      const allConversations: Conversation[] = [];
      const start = new Date(dateStart);
      const end = new Date(dateEnd);
      
      // Iterate through each day in range
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const response = await fetch(`/api/conversations?date=${dateStr}`);
        const data = await response.json();
        if (Array.isArray(data)) {
          allConversations.push(...data);
        }
      }
      
      // Sort by date descending
      allConversations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setConversations(allConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [dateStart, dateEnd]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = conversations.length;
    const completed = conversations.filter(c => c.outcome === 'completed').length;
    const abandoned = conversations.filter(c => c.outcome === 'abandoned').length;
    const inProgress = conversations.filter(c => c.outcome === 'in_progress').length;
    
    // Count successful function calls
    let newPatients = 0;
    let appointmentsBooked = 0;
    let appointmentsRescheduled = 0;
    let returningPatients = 0;
    let totalDuration = 0;
    let totalMessages = 0;
    
    const intentCounts: Record<string, number> = {
      book: 0,
      reschedule: 0,
      cancel: 0,
      check: 0,
      unknown: 0,
    };
    
    // Daily counts for chart
    const dailyCounts: Record<string, number> = {};
    
    conversations.forEach(conv => {
      // Intent counts
      intentCounts[conv.intent] = (intentCounts[conv.intent] || 0) + 1;
      
      // Daily counts
      const dateKey = conv.createdAt.split('T')[0];
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
      
      // Duration
      const start = new Date(conv.createdAt);
      const end = new Date(conv.updatedAt);
      totalDuration += end.getTime() - start.getTime();
      
      // Messages
      totalMessages += conv.messageCount;
      
      // Function call analysis
      conv.functionCalls.forEach(fc => {
        if (fc.error) return;
        
        switch (fc.functionName) {
          case 'CreatePatient':
            if (fc.result?.PatNum) newPatients++;
            break;
          case 'CreateAppointment':
            if (fc.result?.AptNum) appointmentsBooked++;
            break;
          case 'UpdateAppointment':
            appointmentsRescheduled++;
            break;
          case 'GetMultiplePatients':
            if (Array.isArray(fc.result) && fc.result.length > 0) {
              returningPatients++;
            }
            break;
        }
      });
    });
    
    const avgDuration = total > 0 ? totalDuration / total : 0;
    const avgMessages = total > 0 ? totalMessages / total : 0;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // Format average duration
    const avgMinutes = Math.floor(avgDuration / 1000 / 60);
    const avgSeconds = Math.floor((avgDuration / 1000) % 60);
    const avgDurationStr = avgMinutes > 0 ? `${avgMinutes}m ${avgSeconds}s` : `${avgSeconds}s`;
    
    return {
      total,
      completed,
      abandoned,
      inProgress,
      newPatients,
      appointmentsBooked,
      appointmentsRescheduled,
      returningPatients,
      avgDuration: avgDurationStr,
      avgMessages: avgMessages.toFixed(1),
      successRate,
      intentCounts,
      dailyCounts,
    };
  }, [conversations]);

  // Group conversations by status
  const groupedCalls = useMemo(() => {
    const successful: Conversation[] = [];
    const failed: Conversation[] = [];
    const incomplete: Conversation[] = [];
    
    conversations.forEach(conv => {
      // Check for successful key actions
      const hasSuccessfulAction = conv.functionCalls.some(fc => 
        !fc.error && ['CreatePatient', 'CreateAppointment', 'UpdateAppointment'].includes(fc.functionName)
      );
      
      if (conv.outcome === 'completed' || hasSuccessfulAction) {
        successful.push(conv);
      } else if (conv.outcome === 'abandoned' || conv.functionCalls.some(fc => fc.error)) {
        failed.push(conv);
      } else {
        incomplete.push(conv);
      }
    });
    
    return { successful, failed, incomplete };
  }, [conversations]);

  const currentCalls = activeTab === 'successful' ? groupedCalls.successful :
                       activeTab === 'failed' ? groupedCalls.failed :
                       groupedCalls.incomplete;

  const viewCallDetails = (conv: Conversation) => {
    setSelectedCall(conv);
    setIsDrawerOpen(true);
  };

  // Get key actions for a call (for display in list)
  const getKeyActions = (conv: Conversation) => {
    return conv.functionCalls
      .filter(fc => ['CreatePatient', 'CreateAppointment', 'UpdateAppointment', 'GetMultiplePatients'].includes(fc.functionName))
      .map(fc => formatAction(fc))
      .slice(0, 2); // Show max 2 actions
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Call Statistics</h1>
          <p className="text-gray-600 mt-2">Analyzing call data...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-gray-400">Loading statistics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Call Statistics</h1>
          <p className="text-sm text-gray-600 mt-1">Performance metrics and call analytics</p>
        </div>
        
        {/* View Switcher */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/booking/calls')}
          >
            <List className="h-4 w-4 mr-1" />
            Call List
          </Button>
          <Button variant="default" size="sm">
            <BarChart3 className="h-4 w-4 mr-1" />
            Statistics
          </Button>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end bg-white p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-gray-600">Period:</Label>
          <Select value={datePreset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {datePreset === 'custom' && (
          <>
            <div>
              <Label htmlFor="dateStart" className="text-xs text-gray-500">From</Label>
              <Input
                id="dateStart"
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <Label htmlFor="dateEnd" className="text-xs text-gray-500">To</Label>
              <Input
                id="dateEnd"
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-40"
              />
            </div>
          </>
        )}
        
        <Button onClick={fetchConversations} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<Phone className="h-5 w-5" />}
          value={stats.total}
          label="Total Calls"
          color="blue"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          value={`${stats.successRate}%`}
          label="Success Rate"
          color={stats.successRate >= 80 ? 'green' : stats.successRate >= 50 ? 'yellow' : 'red'}
          subValue={`${stats.completed} completed`}
        />
        <StatCard
          icon={<UserPlus className="h-5 w-5" />}
          value={stats.newPatients}
          label="New Patients"
          color="green"
        />
        <StatCard
          icon={<CalendarPlus className="h-5 w-5" />}
          value={stats.appointmentsBooked}
          label="Appointments Booked"
          color="green"
        />
        <StatCard
          icon={<CalendarClock className="h-5 w-5" />}
          value={stats.appointmentsRescheduled}
          label="Rescheduled"
          color="blue"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          value={stats.returningPatients}
          label="Returning Patients"
          color="purple"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          value={stats.avgDuration}
          label="Avg Duration"
          color="gray"
        />
        <StatCard
          icon={<MessageSquare className="h-5 w-5" />}
          value={stats.avgMessages}
          label="Avg Messages"
          color="gray"
        />
        <StatCard
          icon={<XCircle className="h-5 w-5" />}
          value={stats.abandoned}
          label="Abandoned"
          color="red"
        />
      </div>

      {/* Intent Breakdown */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-900 mb-4">Calls by Intent</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(stats.intentCounts).map(([intent, count]) => (
            <div key={intent} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                intent === 'book' ? 'bg-blue-500' :
                intent === 'reschedule' ? 'bg-yellow-500' :
                intent === 'cancel' ? 'bg-red-500' :
                intent === 'check' ? 'bg-purple-500' :
                'bg-gray-400'
              }`} />
              <div>
                <div className="text-sm font-medium capitalize">{intent}</div>
                <div className="text-lg font-bold text-gray-900">{count}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grouped Calls */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('successful')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'successful' 
                ? 'bg-green-50 text-green-700 border-b-2 border-green-500' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            Successful ({groupedCalls.successful.length})
          </button>
          <button
            onClick={() => setActiveTab('failed')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'failed' 
                ? 'bg-red-50 text-red-700 border-b-2 border-red-500' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <XCircle className="h-4 w-4" />
            Failed ({groupedCalls.failed.length})
          </button>
          <button
            onClick={() => setActiveTab('incomplete')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'incomplete' 
                ? 'bg-yellow-50 text-yellow-700 border-b-2 border-yellow-500' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <AlertCircle className="h-4 w-4" />
            Incomplete ({groupedCalls.incomplete.length})
          </button>
        </div>

        {/* Call List */}
        <div className="divide-y max-h-[500px] overflow-y-auto">
          {currentCalls.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No calls in this category
            </div>
          ) : (
            currentCalls.map(conv => {
              const actions = getKeyActions(conv);
              const dateStr = new Date(conv.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              });
              
              return (
                <div
                  key={conv.sessionId}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => viewCallDetails(conv)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500">{dateStr}</span>
                        <span className="text-sm font-medium">{formatTime(conv.createdAt)}</span>
                        <Badge variant="outline" className="text-xs">
                          {conv.intent}
                        </Badge>
                      </div>
                      <div className="font-medium text-gray-900">
                        {conv.patientName || 'Unknown Patient'}
                      </div>
                      {conv.patientPhone && (
                        <div className="text-sm text-gray-500">{formatPhone(conv.patientPhone)}</div>
                      )}
                      {/* Key Actions */}
                      {actions.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {actions.map((action, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              {action.icon}
                              <span className={action.success ? 'text-gray-700' : 'text-red-600'}>
                                {action.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <span className="text-sm">{formatDuration(conv.createdAt, conv.updatedAt)}</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Call Detail Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Call Details</SheetTitle>
            <SheetDescription>
              {selectedCall && (
                <span>
                  {new Date(selectedCall.createdAt).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })} at {formatTime(selectedCall.createdAt)}
                </span>
              )}
            </SheetDescription>
          </SheetHeader>
          
          {selectedCall && (
            <div className="mt-6 space-y-6">
              {/* Call Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-xs text-gray-500">Patient</div>
                  <div className="font-medium">{selectedCall.patientName || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Phone</div>
                  <div className="font-medium">{formatPhone(selectedCall.patientPhone) || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Intent</div>
                  <Badge variant="outline" className="mt-1">{selectedCall.intent}</Badge>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Duration</div>
                  <div className="font-medium">{formatDuration(selectedCall.createdAt, selectedCall.updatedAt)}</div>
                </div>
              </div>

              {/* Actions Taken */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Actions</h4>
                <div className="space-y-2">
                  {selectedCall.functionCalls.length === 0 ? (
                    <div className="text-gray-500 text-sm">No actions recorded</div>
                  ) : (
                    selectedCall.functionCalls.map((fc, idx) => {
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
                    })
                  )}
                </div>
              </div>

              {/* Transcript */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Conversation</h4>
                <div className="space-y-3 max-h-80 overflow-y-auto p-3 bg-gray-50 rounded-lg">
                  {selectedCall.messages.length === 0 ? (
                    <div className="text-gray-400 text-sm text-center py-4">
                      <p>No transcript available</p>
                      <p className="text-xs mt-1">Transcripts are recorded for calls after Dec 2025</p>
                    </div>
                  ) : (
                    selectedCall.messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 ${
                            msg.role === 'user'
                              ? 'bg-blue-500 text-white'
                              : 'bg-white border text-gray-900'
                          }`}
                        >
                          <div className="text-sm">{msg.content}</div>
                          <div className={`text-xs mt-1 ${
                            msg.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                          }`}>
                            {formatTime(msg.timestamp)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

