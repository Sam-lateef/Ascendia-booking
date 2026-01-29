'use client';

import { useEffect, useState } from 'react';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

interface Schedule {
  ScheduleNum: number;
  ProvNum: number;
  ProviderName: string;
  OpNum: number;
  OperatoryName: string;
  ScheduleDate: string;
  StartTime: string;
  EndTime: string;
  IsActive: boolean;
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

const TIME_OPTIONS = [
  '06:00:00', '06:30:00', '07:00:00', '07:30:00', '08:00:00', '08:30:00',
  '09:00:00', '09:30:00', '10:00:00', '10:30:00', '11:00:00', '11:30:00',
  '12:00:00', '12:30:00', '13:00:00', '13:30:00', '14:00:00', '14:30:00',
  '15:00:00', '15:30:00', '16:00:00', '16:30:00', '17:00:00', '17:30:00',
  '18:00:00', '18:30:00', '19:00:00', '19:30:00', '20:00:00',
];

function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${minutes} ${ampm}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

function getEndOfWeekDate(): string {
  const today = new Date();
  today.setDate(today.getDate() + 7);
  return today.toISOString().split('T')[0];
}

export default function SchedulesPage() {
  const t = useTranslations('schedules');
  const tCommon = useTranslations('common');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [operatories, setOperatories] = useState<Operatory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  
  // Filter state
  const [filterDateStart, setFilterDateStart] = useState(getTodayDate());
  const [filterDateEnd, setFilterDateEnd] = useState(getEndOfWeekDate());
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterOperatory, setFilterOperatory] = useState<string>('all');

  // Form state
  const [formProvider, setFormProvider] = useState<string>('');
  const [formOperatory, setFormOperatory] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(getTodayDate());
  const [formStartTime, setFormStartTime] = useState<string>('09:00:00');
  const [formEndTime, setFormEndTime] = useState<string>('17:00:00');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string>('');

  // Bulk create state
  const [bulkProvider, setBulkProvider] = useState<string>('');
  const [bulkOperatory, setBulkOperatory] = useState<string>('');
  const [bulkDateStart, setBulkDateStart] = useState<string>(getTodayDate());
  const [bulkDateEnd, setBulkDateEnd] = useState<string>(getEndOfWeekDate());
  const [bulkStartTime, setBulkStartTime] = useState<string>('09:00:00');
  const [bulkEndTime, setBulkEndTime] = useState<string>('17:00:00');
  const [bulkIncludeWeekends, setBulkIncludeWeekends] = useState(false);
  const [bulkError, setBulkError] = useState<string>('');

  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [filterDateStart, filterDateEnd, filterProvider, filterOperatory]);

  const fetchBaseData = async () => {
    try {
      const [providersRes, operatoriesRes] = await Promise.all([
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
      ]);

      const [providersData, operatoriesData] = await Promise.all([
        providersRes.json(),
        operatoriesRes.json(),
      ]);

      setProviders(Array.isArray(providersData) ? providersData : []);
      setOperatories(Array.isArray(operatoriesData) ? operatoriesData : []);
    } catch (error) {
      console.error('Error fetching base data:', error);
    }
  };

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (filterDateStart) params.DateStart = filterDateStart;
      if (filterDateEnd) params.DateEnd = filterDateEnd;
      if (filterProvider !== 'all') params.ProvNum = parseInt(filterProvider);
      if (filterOperatory !== 'all') params.OpNum = parseInt(filterOperatory);

      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ functionName: 'GetSchedules', parameters: params }),
      });

      const data = await response.json();
      setSchedules(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormProvider(schedule.ProvNum.toString());
    setFormOperatory(schedule.OpNum.toString());
    setFormDate(schedule.ScheduleDate);
    setFormStartTime(schedule.StartTime);
    setFormEndTime(schedule.EndTime);
    setFormIsActive(schedule.IsActive);
    setFormError('');
    setIsDialogOpen(true);
  };

  const handleDelete = async (scheduleNum: number) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'DeleteSchedule',
          parameters: { ScheduleNum: scheduleNum },
        }),
      });

      if (response.ok) {
        fetchSchedules();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to delete schedule');
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('Error deleting schedule');
    }
  };

  const handleToggleActive = async (schedule: Schedule) => {
    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'UpdateSchedule',
          parameters: {
            ScheduleNum: schedule.ScheduleNum,
            IsActive: !schedule.IsActive,
          },
        }),
      });

      if (response.ok) {
        fetchSchedules();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to update schedule');
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
    }
  };

  const resetForm = () => {
    setEditingSchedule(null);
    setFormProvider('');
    setFormOperatory('');
    setFormDate(getTodayDate());
    setFormStartTime('09:00:00');
    setFormEndTime('17:00:00');
    setFormIsActive(true);
    setFormError('');
  };

  const handleSave = async () => {
    setFormError('');
    
    if (!formProvider) {
      setFormError('Please select a provider');
      return;
    }
    if (!formOperatory) {
      setFormError('Please select an operatory (room)');
      return;
    }
    if (!formDate) {
      setFormError('Please select a date');
      return;
    }

    const params: Record<string, any> = {
      ProvNum: parseInt(formProvider),
      OpNum: parseInt(formOperatory),
      ScheduleDate: formDate,
      StartTime: formStartTime,
      EndTime: formEndTime,
      IsActive: formIsActive,
    };

    if (editingSchedule) {
      params.ScheduleNum = editingSchedule.ScheduleNum;
    }

    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: editingSchedule ? 'UpdateSchedule' : 'CreateSchedule',
          parameters: params,
        }),
      });

      const result = await response.json();

      if (response.ok && !result.error) {
        setIsDialogOpen(false);
        resetForm();
        fetchSchedules();
      } else {
        setFormError(result.message || 'Failed to save schedule');
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      setFormError('Error saving schedule');
    }
  };

  const handleBulkCreate = async () => {
    setBulkError('');
    
    if (!bulkProvider) {
      setBulkError('Please select a provider');
      return;
    }
    if (!bulkOperatory) {
      setBulkError('Please select an operatory (room)');
      return;
    }
    if (!bulkDateStart || !bulkDateEnd) {
      setBulkError('Please select start and end dates');
      return;
    }

    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'CreateDefaultSchedules',
          parameters: {
            ProvNum: parseInt(bulkProvider),
            OpNum: parseInt(bulkOperatory),
            DateStart: bulkDateStart,
            DateEnd: bulkDateEnd,
            StartTime: bulkStartTime,
            EndTime: bulkEndTime,
            IncludeWeekends: bulkIncludeWeekends,
          },
        }),
      });

      const result = await response.json();

      if (response.ok && !result.error) {
        setIsBulkDialogOpen(false);
        setBulkProvider('');
        setBulkOperatory('');
        setBulkIncludeWeekends(false);
        setBulkError('');
        fetchSchedules();
        alert(`Created ${Array.isArray(result) ? result.length : 0} schedules successfully!`);
      } else {
        setBulkError(result.message || 'Failed to create schedules');
      }
    } catch (error) {
      console.error('Error creating schedules:', error);
      setBulkError('Error creating schedules');
    }
  };

  // Group schedules by date
  const groupedByDate = schedules.reduce((acc, schedule) => {
    const date = schedule.ScheduleDate;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(schedule);
    return acc;
  }, {} as Record<string, Schedule[]>);

  if (loading && schedules.length === 0) {
    return <div className="text-center py-8">{t('loading')}</div>;
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setBulkError('');
              setIsBulkDialogOpen(true);
            }}
            className="w-full sm:w-auto"
          >
            + Bulk {tCommon('create')}
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
            className="w-full sm:w-auto"
          >
            + {tCommon('new')} {t('title')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <Label className="text-sm font-medium">{t('startDate')}</Label>
          <Input
            type="date"
            value={filterDateStart}
            onChange={(e) => setFilterDateStart(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-sm font-medium">{t('endDate')}</Label>
          <Input
            type="date"
            value={filterDateEnd}
            onChange={(e) => setFilterDateEnd(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-sm font-medium">Provider</Label>
          <Select value={filterProvider} onValueChange={setFilterProvider}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="All Providers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              {providers.map((p) => (
                <SelectItem key={p.ProvNum} value={p.ProvNum.toString()}>
                  Dr. {p.FName} {p.LName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium">Room</Label>
          <Select value={filterOperatory} onValueChange={setFilterOperatory}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="All Rooms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rooms</SelectItem>
              {operatories.map((op) => (
                <SelectItem key={op.OperatoryNum} value={op.OperatoryNum.toString()}>
                  {op.OpName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{schedules.length}</div>
          <div className="text-sm text-gray-600">Total Schedules</div>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {schedules.filter(s => s.IsActive).length}
          </div>
          <div className="text-sm text-gray-600">Active</div>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">
            {Object.keys(groupedByDate).length}
          </div>
          <div className="text-sm text-gray-600">Days with Schedules</div>
        </div>
        <div className="p-4 bg-orange-50 rounded-lg">
          <div className="text-2xl font-bold text-orange-600">
            {new Set(schedules.map(s => s.ProvNum)).size}
          </div>
          <div className="text-sm text-gray-600">Providers Scheduled</div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                  No schedules found for this date range.
                </TableCell>
              </TableRow>
            ) : (
              schedules.map((schedule) => (
                <TableRow key={schedule.ScheduleNum} className={!schedule.IsActive ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{formatDate(schedule.ScheduleDate)}</TableCell>
                  <TableCell>{schedule.ProviderName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{schedule.OperatoryName}</Badge>
                  </TableCell>
                  <TableCell>
                    {formatTime(schedule.StartTime)} - {formatTime(schedule.EndTime)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={schedule.IsActive}
                        onCheckedChange={() => handleToggleActive(schedule)}
                      />
                      <Badge variant={schedule.IsActive ? 'default' : 'secondary'}>
                        {schedule.IsActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(schedule)}>
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(schedule.ScheduleNum)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {schedules.length === 0 ? (
          <div className="text-center text-gray-500 py-8 border rounded-lg">
            No schedules found for this date range.
          </div>
        ) : (
          schedules.map((schedule) => (
            <div
              key={schedule.ScheduleNum}
              className={`border rounded-lg p-4 space-y-3 bg-white ${!schedule.IsActive ? 'opacity-50' : ''}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm text-gray-500">{formatDate(schedule.ScheduleDate)}</div>
                  <div className="text-lg font-semibold text-gray-900">{schedule.ProviderName}</div>
                  <Badge variant="outline" className="mt-1">{schedule.OperatoryName}</Badge>
                </div>
                <Checkbox
                  checked={schedule.IsActive}
                  onCheckedChange={() => handleToggleActive(schedule)}
                />
              </div>
              <div className="flex gap-2 items-center">
                <Badge variant="outline">
                  {formatTime(schedule.StartTime)} - {formatTime(schedule.EndTime)}
                </Badge>
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => handleEdit(schedule)} className="flex-1">
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(schedule.ScheduleNum)}
                  className="flex-1"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Edit Schedule' : 'New Schedule'}</DialogTitle>
            <DialogDescription>
              {editingSchedule
                ? 'Update schedule details'
                : 'Create a provider schedule for a specific date and room'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {formError}
              </div>
            )}
            <div>
              <Label>Provider *</Label>
              <Select value={formProvider} onValueChange={setFormProvider}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.ProvNum} value={p.ProvNum.toString()}>
                      Dr. {p.FName} {p.LName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Room (Operatory) *</Label>
              <Select value={formOperatory} onValueChange={setFormOperatory}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Room" />
                </SelectTrigger>
                <SelectContent>
                  {operatories.map((op) => (
                    <SelectItem key={op.OperatoryNum} value={op.OperatoryNum.toString()}>
                      {op.OpName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time *</Label>
                <Select value={formStartTime} onValueChange={setFormStartTime}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {formatTime(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>End Time *</Label>
                <Select value={formEndTime} onValueChange={setFormEndTime}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {formatTime(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={formIsActive} onCheckedChange={(checked) => setFormIsActive(checked === true)} />
              <Label>Active</Label>
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
              <strong>Note:</strong> Only one provider can be in a room at any given time.
              A provider cannot be in two rooms at the same time.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Dialog */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Create Schedules</DialogTitle>
            <DialogDescription>
              Create schedules for a date range (Mon-Fri by default)
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {bulkError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {bulkError}
              </div>
            )}
            <div>
              <Label>Provider *</Label>
              <Select value={bulkProvider} onValueChange={setBulkProvider}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.ProvNum} value={p.ProvNum.toString()}>
                      Dr. {p.FName} {p.LName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Room (Operatory) *</Label>
              <Select value={bulkOperatory} onValueChange={setBulkOperatory}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Room" />
                </SelectTrigger>
                <SelectContent>
                  {operatories.map((op) => (
                    <SelectItem key={op.OperatoryNum} value={op.OperatoryNum.toString()}>
                      {op.OpName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={bulkDateStart}
                  onChange={(e) => setBulkDateStart(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={bulkDateEnd}
                  onChange={(e) => setBulkDateEnd(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Select value={bulkStartTime} onValueChange={setBulkStartTime}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {formatTime(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>End Time</Label>
                <Select value={bulkEndTime} onValueChange={setBulkEndTime}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {formatTime(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-weekends"
                checked={bulkIncludeWeekends}
                onCheckedChange={(checked) => setBulkIncludeWeekends(checked === true)}
              />
              <Label htmlFor="include-weekends" className="cursor-pointer">
                Include weekends (Sat & Sun)
              </Label>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
              This will create one schedule per day for the selected provider and room.
              Days with conflicts will be skipped.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkCreate}>Create Schedules</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
