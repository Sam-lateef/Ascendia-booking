'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations } from '@/lib/i18n/TranslationProvider';
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
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Calendar, List, Clock } from 'lucide-react';

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
}

interface Provider {
  ProvNum: number;
  FName: string;
  LName: string;
}

interface Operatory {
  OperatoryNum: number;
  OpName: string;
}

// Provider colors for visual distinction
const PROVIDER_COLORS = [
  { bg: 'bg-blue-100', border: 'border-l-blue-500', text: 'text-blue-800', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-100', border: 'border-l-emerald-500', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  { bg: 'bg-violet-100', border: 'border-l-violet-500', text: 'text-violet-800', dot: 'bg-violet-500' },
  { bg: 'bg-amber-100', border: 'border-l-amber-500', text: 'text-amber-800', dot: 'bg-amber-500' },
  { bg: 'bg-rose-100', border: 'border-l-rose-500', text: 'text-rose-800', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-100', border: 'border-l-cyan-500', text: 'text-cyan-800', dot: 'bg-cyan-500' },
  { bg: 'bg-pink-100', border: 'border-l-pink-500', text: 'text-pink-800', dot: 'bg-pink-500' },
  { bg: 'bg-indigo-100', border: 'border-l-indigo-500', text: 'text-indigo-800', dot: 'bg-indigo-500' },
];

// Status badge colors
const STATUS_STYLES: Record<string, string> = {
  Scheduled: 'bg-blue-500',
  Completed: 'bg-green-500',
  Cancelled: 'bg-red-400 line-through',
  'No-Show': 'bg-orange-400',
  Broken: 'bg-gray-400',
};

export default function WeekCalendarPage() {
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [operatories, setOperatories] = useState<Operatory[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Week state - start of current week (Monday)
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  
  // Filters
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterOperatory, setFilterOperatory] = useState<string>('all');
  
  // Detail dialog
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Generate week days
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      days.push(date);
    }
    return days;
  }, [weekStart]);

  // Date range for API
  const dateRange = useMemo(() => {
    const start = weekDays[0].toISOString().split('T')[0];
    const end = weekDays[6].toISOString().split('T')[0];
    return { start, end };
  }, [weekDays]);

  useEffect(() => {
    fetchData();
  }, [dateRange.start, dateRange.end]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [aptsRes, provsRes, opsRes, patsRes] = await Promise.all([
        fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            functionName: 'GetAppointments',
            parameters: { DateStart: dateRange.start, DateEnd: dateRange.end },
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

  const getProviderShortName = (provNum: number): string => {
    const provider = providers.find(p => p.ProvNum === provNum);
    return provider ? `${provider.FName[0]}${provider.LName[0]}` : `P${provNum}`;
  };

  const getOperatoryName = (opNum: number): string => {
    const op = operatories.find(o => o.OperatoryNum === opNum);
    return op?.OpName || `Room ${opNum}`;
  };

  const getProviderColor = (provNum: number) => {
    const index = providers.findIndex(p => p.ProvNum === provNum);
    return PROVIDER_COLORS[index % PROVIDER_COLORS.length];
  };

  // Filter and group appointments by date
  const appointmentsByDate = useMemo(() => {
    const filtered = appointments.filter(apt => {
      if (filterProvider !== 'all' && apt.ProvNum !== parseInt(filterProvider)) return false;
      if (filterOperatory !== 'all' && apt.Op !== parseInt(filterOperatory)) return false;
      return true;
    });

    const grouped: Record<string, Appointment[]> = {};
    weekDays.forEach(day => {
      const dateKey = day.toISOString().split('T')[0];
      grouped[dateKey] = [];
    });

    filtered.forEach(apt => {
      const aptDate = new Date(apt.AptDateTime).toISOString().split('T')[0];
      if (grouped[aptDate]) {
        grouped[aptDate].push(apt);
      }
    });

    // Sort appointments by time within each day
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => new Date(a.AptDateTime).getTime() - new Date(b.AptDateTime).getTime());
    });

    return grouped;
  }, [appointments, filterProvider, filterOperatory, weekDays]);

  const changeWeek = (weeks: number) => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + weeks * 7);
    setWeekStart(newStart);
  };

  const goToToday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    setWeekStart(monday);
  };

  const formatWeekRange = () => {
    const start = weekDays[0];
    const end = weekDays[6];
    const sameMonth = start.getMonth() === end.getMonth();
    
    if (sameMonth) {
      return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const totalAppointments = Object.values(appointmentsByDate).reduce((sum, arr) => sum + arr.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{tCommon('loading_calendar')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{tCommon('week_calendar')}</h1>
          <p className="text-sm text-gray-600 mt-1">{tCommon('weekly_overview_of_all_appoint')}</p>
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
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/booking/appointments/today')}
          >
            <Clock className="h-4 w-4 mr-1" />
            Today
          </Button>
          <Button
            variant="default"
            size="sm"
          >
            <Calendar className="h-4 w-4 mr-1" />
            Week
          </Button>
        </div>
      </div>

      {/* Week Navigation & Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white p-4 rounded-lg border">
        {/* Week Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => changeWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[220px]">
            <div className="font-semibold text-lg">{formatWeekRange()}</div>
            <div className="text-sm text-gray-500">{totalAppointments} appointments</div>
          </div>
          <Button variant="outline" size="icon" onClick={() => changeWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday}>{tCommon('this_week')}</Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
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

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b bg-gray-50">
          {weekDays.map((day, i) => {
            const dateKey = day.toISOString().split('T')[0];
            const dayAppointments = appointmentsByDate[dateKey] || [];
            const today = isToday(day);
            const weekend = isWeekend(day);
            
            return (
              <div
                key={i}
                className={`p-3 text-center border-r last:border-r-0 ${weekend ? 'bg-gray-100/50' : ''}`}
              >
                <div className={`text-xs uppercase tracking-wide ${today ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-2xl font-semibold mt-1 ${today ? 'text-blue-600' : 'text-gray-900'}`}>
                  {today ? (
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white">
                      {day.getDate()}
                    </span>
                  ) : (
                    day.getDate()
                  )}
                </div>
                <div className={`text-xs mt-1 ${dayAppointments.length > 0 ? 'text-gray-600' : 'text-gray-400'}`}>
                  {dayAppointments.length} apt{dayAppointments.length !== 1 ? 's' : ''}
                </div>
              </div>
            );
          })}
        </div>

        {/* Day Columns with Appointments */}
        <div className="grid grid-cols-7 min-h-[500px]">
          {weekDays.map((day, i) => {
            const dateKey = day.toISOString().split('T')[0];
            const dayAppointments = appointmentsByDate[dateKey] || [];
            const weekend = isWeekend(day);
            const today = isToday(day);
            
            return (
              <div
                key={i}
                className={`border-r last:border-r-0 p-2 space-y-2 ${
                  weekend ? 'bg-gray-50/50' : ''
                } ${today ? 'bg-blue-50/30' : ''}`}
              >
                {dayAppointments.length === 0 ? (
                  <div className="text-center text-gray-400 text-xs py-8">
                    No appointments
                  </div>
                ) : (
                  dayAppointments.map(apt => {
                    const aptTime = new Date(apt.AptDateTime);
                    const color = getProviderColor(apt.ProvNum);
                    const isCancelled = ['Cancelled', 'Broken'].includes(apt.AptStatus);
                    
                    return (
                      <div
                        key={apt.AptNum}
                        className={`${color.bg} ${color.border} border-l-4 rounded-r p-2 cursor-pointer hover:shadow-md transition-shadow ${
                          isCancelled ? 'opacity-60' : ''
                        }`}
                        onClick={() => setSelectedAppointment(apt)}
                      >
                        <div className={`text-xs font-bold ${color.text}`}>
                          {aptTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </div>
                        <div className={`text-sm font-medium ${color.text} truncate ${isCancelled ? 'line-through' : ''}`}>
                          {getPatientName(apt.PatNum)}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                          <span className={`text-xs ${color.text} opacity-75 truncate`}>
                            {getProviderShortName(apt.ProvNum)} • {getOperatoryName(apt.Op)}
                          </span>
                        </div>
                        {apt.AptStatus !== 'Scheduled' && (
                          <Badge className={`mt-1 text-[10px] h-4 ${STATUS_STYLES[apt.AptStatus] || 'bg-gray-400'}`}>
                            {apt.AptStatus}
                          </Badge>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-gray-900">{totalAppointments}</div>
          <div className="text-sm text-gray-500">{tCommon('this_week')}</div>
        </div>
        {weekDays.slice(0, 5).map((day, i) => {
          const dateKey = day.toISOString().split('T')[0];
          const count = (appointmentsByDate[dateKey] || []).length;
          const today = isToday(day);
          
          return (
            <div key={i} className={`p-4 rounded-lg border ${today ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
              <div className={`text-2xl font-bold ${today ? 'text-blue-600' : 'text-gray-900'}`}>{count}</div>
              <div className={`text-sm ${today ? 'text-blue-600' : 'text-gray-500'}`}>
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Provider Legend */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="text-sm font-medium text-gray-700 mb-2">{tCommon('providers')}</div>
        <div className="flex flex-wrap gap-3">
          {providers.map(prov => {
            const color = getProviderColor(prov.ProvNum);
            return (
              <div key={prov.ProvNum} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${color.dot}`} />
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
              {selectedAppointment && new Date(selectedAppointment.AptDateTime).toLocaleString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
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
                    <Badge className={STATUS_STYLES[selectedAppointment.AptStatus] || 'bg-gray-500'}>
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
                    const aptDate = new Date(selectedAppointment.AptDateTime).toISOString().split('T')[0];
                    setSelectedAppointment(null);
                    router.push(`/admin/booking/appointments/today?date=${aptDate}`);
                  }}
                >
                  View in Timeline
                </Button>
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => {
                    setSelectedAppointment(null);
                    router.push('/admin/booking/appointments');
                  }}
                >
                  Edit in List
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}




