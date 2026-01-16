'use client';

import { useTranslations } from '@/lib/i18n/TranslationProvider';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Clock } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Appointment {
  AptNum: number;
  PatNum: number;
  PatientName?: string;
  ProvNum: number;
  ProviderName?: string;
  Op: number;
  OperatoryName?: string;
  AptDateTime: string;
  AptStatus: string;
  Note: string;
  Pattern?: string;
}

interface Provider {
  ProvNum: number;
  FName: string;
  LName: string;
  ProvColor?: string;
}

interface Operatory {
  OperatoryNum: number;
  OpName: string;
  ProvDentist?: number;
}

// Provider colors for visual distinction
const PROVIDER_COLORS = [
  { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-white' },
  { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-white' },
  { bg: 'bg-violet-500', border: 'border-violet-600', text: 'text-white' },
  { bg: 'bg-amber-500', border: 'border-amber-600', text: 'text-white' },
  { bg: 'bg-rose-500', border: 'border-rose-600', text: 'text-white' },
  { bg: 'bg-cyan-500', border: 'border-cyan-600', text: 'text-white' },
  { bg: 'bg-pink-500', border: 'border-pink-600', text: 'text-white' },
  { bg: 'bg-indigo-500', border: 'border-indigo-600', text: 'text-white' },
];

// Status colors
const STATUS_COLORS: Record<string, { bg: string; border: string }> = {
  Scheduled: { bg: 'bg-blue-500', border: 'border-blue-600' },
  Completed: { bg: 'bg-green-500', border: 'border-green-600' },
  Cancelled: { bg: 'bg-red-400', border: 'border-red-500' },
  'No-Show': { bg: 'bg-orange-400', border: 'border-orange-500' },
  Broken: { bg: 'bg-gray-400', border: 'border-gray-500' },
};

export default function TodayGanttPage() {
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [operatories, setOperatories] = useState<Operatory[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterOperatory, setFilterOperatory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'operatory' | 'provider'>('operatory');
  
  // Detail dialog
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  
  // Time configuration - 7 AM to 7 PM (12 hours)
  const START_HOUR = 7;
  const END_HOUR = 19;
  const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [aptsRes, provsRes, opsRes, patsRes] = await Promise.all([
        fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            functionName: 'GetAppointments',
            parameters: { DateStart: selectedDate, DateEnd: selectedDate },
          }),
        }),
        fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ functionName: 'GetProviders', parameters: {} }),
        }),
        fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ functionName: 'GetOperatories', parameters: {} }),
        }),
        fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ functionName: 'GetAllPatients', parameters: {} }),
        }),
      ]);

      const [aptsData, provsData, opsData, patsData] = await Promise.all([
        aptsRes.json(),
        provsRes.json(),
        opsRes.json(),
        patsRes.json(),
      ]);

      setAppointments(Array.isArray(aptsData) ? aptsData : []);
      setProviders(Array.isArray(provsData) ? provsData : []);
      setOperatories(Array.isArray(opsData) ? opsData : []);
      setPatients(Array.isArray(patsData) ? patsData : []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPatientName = (patNum: number): string => {
    const patient = patients.find(p => p.PatNum === patNum);
    return patient ? `${patient.FName} ${patient.LName}` : `Patient ${patNum}`;
  };

  const getProviderName = (provNum: number): string => {
    const provider = providers.find(p => p.ProvNum === provNum);
    return provider ? `Dr. ${provider.LName}` : `Provider ${provNum}`;
  };

  const getOperatoryName = (opNum: number): string => {
    const op = operatories.find(o => o.OperatoryNum === opNum);
    return op?.OpName || `Room ${opNum}`;
  };

  const getProviderColor = (provNum: number) => {
    const index = providers.findIndex(p => p.ProvNum === provNum);
    return PROVIDER_COLORS[index % PROVIDER_COLORS.length];
  };

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      if (filterProvider !== 'all' && apt.ProvNum !== parseInt(filterProvider)) return false;
      if (filterOperatory !== 'all' && apt.Op !== parseInt(filterOperatory)) return false;
      return true;
    });
  }, [appointments, filterProvider, filterOperatory]);

  // Get rows based on view mode
  const rows = useMemo(() => {
    if (viewMode === 'operatory') {
      let ops = operatories;
      if (filterOperatory !== 'all') {
        ops = operatories.filter(o => o.OperatoryNum === parseInt(filterOperatory));
      }
      return ops.map(op => ({
        id: op.OperatoryNum,
        label: op.OpName,
        appointments: filteredAppointments.filter(apt => apt.Op === op.OperatoryNum),
      }));
    } else {
      let provs = providers;
      if (filterProvider !== 'all') {
        provs = providers.filter(p => p.ProvNum === parseInt(filterProvider));
      }
      return provs.map(prov => ({
        id: prov.ProvNum,
        label: `Dr. ${prov.FName} ${prov.LName}`,
        appointments: filteredAppointments.filter(apt => apt.ProvNum === prov.ProvNum),
      }));
    }
  }, [viewMode, operatories, providers, filteredAppointments, filterOperatory, filterProvider]);

  // Calculate appointment position and width
  const getAppointmentStyle = (apt: Appointment) => {
    const aptDate = new Date(apt.AptDateTime);
    const hours = aptDate.getHours();
    const minutes = aptDate.getMinutes();
    
    // Calculate left position (percentage)
    const startMinutes = (hours - START_HOUR) * 60 + minutes;
    const totalMinutes = (END_HOUR - START_HOUR) * 60;
    const left = (startMinutes / totalMinutes) * 100;
    
    // Estimate duration (30 min default, or parse from Pattern if available)
    const duration = apt.Pattern ? apt.Pattern.length * 5 : 30; // Each X in pattern = 5 min
    const width = (duration / totalMinutes) * 100;
    
    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.min(width, 100 - left)}%`,
    };
  };

  const changeDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const isToday = date.toDateString() === today.toDateString();
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dateFormatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    return { dayName, dateFormatted, isToday };
  };

  const { dayName, dateFormatted, isToday } = formatDateDisplay(selectedDate);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{tCommon('loading_schedule')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{tCommon('daily_schedule')}</h1>
          <p className="text-sm text-gray-600 mt-1">{tCommon('gantt_timeline_view_of_appoint')}</p>
        </div>
        
        {/* View Switcher */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/booking/appointments')}
          >
            <List className="h-4 w-4 mr-1" />
            List
          </Button>
          <Button
            variant="default"
            size="sm"
          >
            <Clock className="h-4 w-4 mr-1" />{tCommon('today')}</Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/booking/appointments/calendar')}
          >
            <CalendarIcon className="h-4 w-4 mr-1" />
            Week
          </Button>
        </div>
      </div>

      {/* Date Navigation & Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white p-4 rounded-lg border">
        {/* Date Picker */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal min-w-[220px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                <div className="flex items-center gap-2">
                  {isToday && <Badge className="bg-green-500">{tCommon('today')}</Badge>}
                  <span className="font-semibold">{dayName}</span>
                  <span className="text-gray-500">•</span>
                  <span className="text-sm text-gray-500">{dateFormatted}</span>
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={new Date(selectedDate)}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date.toISOString().split('T')[0]);
                  }
                }}
                initialFocus
                defaultMonth={new Date(selectedDate)}
              />
            </PopoverContent>
          </Popover>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}>{tCommon('today')}</Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-gray-600">{tCommon('view_by')}</Label>
            <Select value={viewMode} onValueChange={(v: 'operatory' | 'provider') => setViewMode(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="operatory">{tCommon('operatory')}</SelectItem>
                <SelectItem value="provider">{tCommon('provider')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Label className="text-sm text-gray-600">{tCommon('provider')}</Label>
            <Select value={filterProvider} onValueChange={setFilterProvider}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={tCommon('all_providers')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tCommon('all_providers')}</SelectItem>
                {providers.map(p => (
                  <SelectItem key={p.ProvNum} value={p.ProvNum.toString()}>
                    Dr. {p.FName} {p.LName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Label className="text-sm text-gray-600">{tCommon('room')}</Label>
            <Select value={filterOperatory} onValueChange={setFilterOperatory}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder={tCommon('all_rooms')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tCommon('all_rooms')}</SelectItem>
                {operatories.map(op => (
                  <SelectItem key={op.OperatoryNum} value={op.OperatoryNum.toString()}>
                    {op.OpName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {/* Time Header */}
        <div className="flex border-b bg-gray-50">
          <div className="w-32 sm:w-40 flex-shrink-0 p-3 font-medium text-gray-700 border-r">
            {viewMode === 'operatory' ? 'Room' : 'Provider'}
          </div>
          <div className="flex-1 flex">
            {HOURS.map(hour => (
              <div
                key={hour}
                className="flex-1 text-center text-xs sm:text-sm text-gray-500 py-2 border-r last:border-r-0"
                style={{ minWidth: '60px' }}
              >
                {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No {viewMode === 'operatory' ? 'operatories' : 'providers'} found
          </div>
        ) : (
          rows.map((row, rowIndex) => (
            <div
              key={row.id}
              className={`flex border-b last:border-b-0 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
              style={{ minHeight: '60px' }}
            >
              {/* Row Label */}
              <div className="w-32 sm:w-40 flex-shrink-0 p-3 font-medium text-gray-700 border-r flex items-center">
                <span className="truncate">{row.label}</span>
              </div>
              
              {/* Timeline Area */}
              <div className="flex-1 relative">
                {/* Hour grid lines */}
                <div className="absolute inset-0 flex">
                  {HOURS.map((hour, i) => (
                    <div
                      key={hour}
                      className="flex-1 border-r border-gray-100 last:border-r-0"
                      style={{ minWidth: '60px' }}
                    />
                  ))}
                </div>
                
                {/* Appointments */}
                <div className="relative h-full py-1 px-1">
                  {row.appointments.map(apt => {
                    const style = getAppointmentStyle(apt);
                    const color = getProviderColor(apt.ProvNum);
                    const statusColor = STATUS_COLORS[apt.AptStatus] || STATUS_COLORS.Scheduled;
                    const aptTime = new Date(apt.AptDateTime);
                    
                    return (
                      <div
                        key={apt.AptNum}
                        className={`absolute top-1 bottom-1 ${color.bg} ${color.border} border-l-4 rounded-r cursor-pointer hover:opacity-90 transition-opacity shadow-sm overflow-hidden`}
                        style={style}
                        onClick={() => setSelectedAppointment(apt)}
                        title={`${getPatientName(apt.PatNum)} - ${aptTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                      >
                        <div className={`px-2 py-1 h-full flex flex-col justify-center ${color.text}`}>
                          <div className="text-xs font-semibold truncate">
                            {getPatientName(apt.PatNum)}
                          </div>
                          <div className="text-[10px] opacity-80 truncate">
                            {aptTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            {viewMode === 'operatory' && ` • ${getProviderName(apt.ProvNum)}`}
                            {viewMode === 'provider' && ` • ${getOperatoryName(apt.Op)}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-gray-900">{filteredAppointments.length}</div>
          <div className="text-sm text-gray-500">{tCommon('total_appointments')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-blue-600">
            {filteredAppointments.filter(a => a.AptStatus === 'Scheduled').length}
          </div>
          <div className="text-sm text-gray-500">{tCommon('scheduled')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">
            {filteredAppointments.filter(a => a.AptStatus === 'Completed').length}
          </div>
          <div className="text-sm text-gray-500">{tCommon('completed')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-orange-600">
            {filteredAppointments.filter(a => ['Cancelled', 'No-Show', 'Broken'].includes(a.AptStatus)).length}
          </div>
          <div className="text-sm text-gray-500">{tCommon('cancellednoshow')}</div>
        </div>
      </div>

      {/* Provider Legend */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="text-sm font-medium text-gray-700 mb-2">{tCommon('providers')}</div>
        <div className="flex flex-wrap gap-3">
          {providers.map(prov => {
            const color = getProviderColor(prov.ProvNum);
            return (
              <div key={prov.ProvNum} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${color.bg}`} />
                <span className="text-sm text-gray-600">Dr. {prov.FName} {prov.LName}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Appointment Detail Dialog */}
      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tCommon('appointment_details')}</DialogTitle>
            <DialogDescription>
              {selectedAppointment && new Date(selectedAppointment.AptDateTime).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">{tCommon('patient')}</Label>
                  <div className="font-medium">{getPatientName(selectedAppointment.PatNum)}</div>
                </div>
                <div>
                  <Label className="text-gray-500">{tCommon('status')}</Label>
                  <div>
                    <Badge className={STATUS_COLORS[selectedAppointment.AptStatus]?.bg || 'bg-gray-500'}>
                      {selectedAppointment.AptStatus}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-500">{tCommon('provider')}</Label>
                  <div className="font-medium">{getProviderName(selectedAppointment.ProvNum)}</div>
                </div>
                <div>
                  <Label className="text-gray-500">{tCommon('room')}</Label>
                  <div className="font-medium">{getOperatoryName(selectedAppointment.Op)}</div>
                </div>
              </div>
              {selectedAppointment.Note && (
                <div>
                  <Label className="text-gray-500">{tCommon('notes')}</Label>
                  <div className="mt-1 p-2 bg-gray-50 rounded text-sm">{selectedAppointment.Note}</div>
                </div>
              )}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedAppointment(null);
                    router.push('/admin/booking/appointments');
                  }}
                >
                  Edit in List View
                </Button>
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => setSelectedAppointment(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}



