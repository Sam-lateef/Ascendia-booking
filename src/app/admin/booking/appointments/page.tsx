'use client';

import { useEffect, useState } from 'react';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, List, Clock } from 'lucide-react';

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
  DateCreated?: string;
  DateTStamp?: string;
}

export default function AppointmentsPage() {
  const t = useTranslations('appointments');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [operatories, setOperatories] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [dateStart, setDateStart] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [dateEnd, setDateEnd] = useState(() => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    return endDate.toISOString().split('T')[0];
  });

  useEffect(() => {
    fetchAppointments();
  }, [dateStart, dateEnd]);

  useEffect(() => {
    fetchProviders();
    fetchOperatories();
    fetchPatients();
  }, []);

  const fetchAppointments = async () => {
    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'GetAppointments',
          parameters: { DateStart: dateStart, DateEnd: dateEnd },
        }),
      });
      const data = await response.json();
      setAppointments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'GetProviders',
          parameters: {},
        }),
      });
      const data = await response.json();
      setProviders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  };

  const fetchOperatories = async () => {
    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'GetOperatories',
          parameters: {},
        }),
      });
      const data = await response.json();
      setOperatories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching operatories:', error);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'GetAllPatients',
          parameters: {},
        }),
      });
      const data = await response.json();
      setPatients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const getPatientName = (patNum: number) => {
    const patient = patients.find((p) => p.PatNum === patNum);
    if (!patient) return `Patient ${patNum}`;
    return `${patient.LName}, ${patient.FName}`.trim();
  };

  const getPatientPhone = (patNum: number) => {
    const patient = patients.find((p) => p.PatNum === patNum);
    return patient?.WirelessPhone || patient?.HmPhone || '-';
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setIsDialogOpen(true);
  };

  const handleDelete = async (aptNum: number) => {
    if (!confirm('Are you sure you want to delete this appointment?')) return;
    
    try {
      await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'DeleteAppointment',
          parameters: { AptNum: aptNum },
        }),
      });
      fetchAppointments();
    } catch (error) {
      console.error('Error deleting appointment:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      PatNum: Number(formData.get('patNum')),
      AptDateTime: formData.get('aptDateTime'),
      AptStatus: formData.get('status'),
      ProvNum: Number(formData.get('provNum')),
      Op: Number(formData.get('op')),
      Note: formData.get('note'),
    };

    try {
      if (editingAppointment) {
        await fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            functionName: 'UpdateAppointment',
            parameters: { AptNum: editingAppointment.AptNum, ...data },
          }),
        });
      } else {
        await fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            functionName: 'CreateAppointment',
            parameters: data,
          }),
        });
      }
      setIsDialogOpen(false);
      fetchAppointments();
    } catch (error) {
      console.error('Error saving appointment:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      Scheduled: 'bg-blue-500',
      Confirmed: 'bg-green-500',
      Complete: 'bg-gray-500',
      Broken: 'bg-red-500',
      Unscheduled: 'bg-yellow-500',
    };

    return (
      <Badge className={colors[status] || 'bg-gray-500'}>
        {t(status.toLowerCase()) || status}
      </Badge>
    );
  };

  if (loading) {
    return <div className="text-center py-8">{t('loading')}</div>;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            <Button variant="default" size="sm">
              <List className="h-4 w-4 mr-1" />
              {t('day')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/admin/booking/appointments/today')}
            >
              <Clock className="h-4 w-4 mr-1" />
              {t('today')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/admin/booking/appointments/calendar')}
            >
              <Calendar className="h-4 w-4 mr-1" />
              {t('week')}
            </Button>
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
        <div className="flex-1 sm:flex-initial">
          <Label htmlFor="dateStart">{t('selectDate')}</Label>
          <Input
            id="dateStart"
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className="w-full sm:w-48"
          />
        </div>
        <div className="flex-1 sm:flex-initial">
          <Label htmlFor="dateEnd">{t('selectDate')}</Label>
          <Input
            id="dateEnd"
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className="w-full sm:w-48"
          />
        </div>
        <Button onClick={fetchAppointments} className="w-full sm:w-auto">{tCommon('refresh')}</Button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('dateTime')}</TableHead>
              <TableHead>{t('patientName')}</TableHead>
              <TableHead>{tCommon('phone')}</TableHead>
              <TableHead>{t('providerName')}</TableHead>
              <TableHead>{t('operatoryName')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('note')}</TableHead>
              <TableHead>{tCommon('actions') || 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                  {t('noAppointments')}
                </TableCell>
              </TableRow>
            ) : (
              appointments.map((apt) => {
                const dateTime = new Date(apt.AptDateTime);
                return (
                  <TableRow key={apt.AptNum}>
                    <TableCell>
                      {dateTime.toLocaleDateString()} {dateTime.toLocaleTimeString()}
                    </TableCell>
                    <TableCell>{getPatientName(apt.PatNum)}</TableCell>
                    <TableCell className="text-gray-600">{getPatientPhone(apt.PatNum)}</TableCell>
                    <TableCell>{apt.ProviderName || `Provider ${apt.ProvNum}`}</TableCell>
                    <TableCell>{apt.OperatoryName || `Room ${apt.Op}`}</TableCell>
                    <TableCell>{getStatusBadge(apt.AptStatus)}</TableCell>
                    <TableCell className="max-w-xs truncate">{apt.Note || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(apt)}
                        >
                          {tCommon('edit')}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(apt.AptNum)}
                        >
                          {tCommon('delete')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-4">
        {appointments.length === 0 ? (
          <div className="text-center text-gray-500 py-8">{t('noAppointments')}</div>
        ) : (
          appointments.map((apt) => {
            const dateTime = new Date(apt.AptDateTime);
            return (
              <div key={apt.AptNum} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{getPatientName(apt.PatNum)}</div>
                    <div className="text-sm text-gray-600">{getPatientPhone(apt.PatNum)}</div>
                  </div>
                  {getStatusBadge(apt.AptStatus)}
                </div>
                <div className="text-sm space-y-1">
                  <div><strong>{t('dateTime')}:</strong> {dateTime.toLocaleString()}</div>
                  <div><strong>{t('providerName')}:</strong> {apt.ProviderName || `Provider ${apt.ProvNum}`}</div>
                  <div><strong>{t('operatoryName')}:</strong> {apt.OperatoryName || `Room ${apt.Op}`}</div>
                  {apt.Note && <div><strong>{t('note')}:</strong> {apt.Note}</div>}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(apt)}
                  >
                    {tCommon('edit')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDelete(apt.AptNum)}
                  >
                    {tCommon('delete')}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dialog for Create/Edit */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingAppointment ? tCommon('edit') : tCommon('create') || 'Create'} {t('title')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="patNum">{t('patientName')}</Label>
                <Select name="patNum" defaultValue={editingAppointment?.PatNum?.toString()}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('patientName')} />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.PatNum} value={p.PatNum.toString()}>
                        {p.LName}, {p.FName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="aptDateTime">{t('dateTime')}</Label>
                <Input
                  id="aptDateTime"
                  name="aptDateTime"
                  type="datetime-local"
                  defaultValue={editingAppointment?.AptDateTime?.slice(0, 16)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="status">{t('status')}</Label>
                <Select name="status" defaultValue={editingAppointment?.AptStatus || 'Scheduled'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Scheduled">{t('scheduled')}</SelectItem>
                    <SelectItem value="Confirmed">{t('confirmed')}</SelectItem>
                    <SelectItem value="Complete">{t('complete')}</SelectItem>
                    <SelectItem value="Broken">{t('broken')}</SelectItem>
                    <SelectItem value="Unscheduled">{t('unscheduled')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="provNum">{t('providerName')}</Label>
                <Select name="provNum" defaultValue={editingAppointment?.ProvNum?.toString()}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.ProvNum} value={p.ProvNum.toString()}>
                        {p.FName} {p.LName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="op">{t('operatoryName')}</Label>
                <Select name="op" defaultValue={editingAppointment?.Op?.toString()}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operatories.map((o) => (
                      <SelectItem key={o.OperatoryNum} value={o.OperatoryNum.toString()}>
                        {o.OpName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="note">{t('note')}</Label>
                <Input
                  id="note"
                  name="note"
                  defaultValue={editingAppointment?.Note}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                {tCommon('cancel')}
              </Button>
              <Button type="submit">{tCommon('save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

