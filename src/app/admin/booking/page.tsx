'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';
import { useTranslations, useLocale } from '@/lib/i18n/TranslationProvider';

interface DashboardStats {
  todayAppointments: number;
  totalProviders: number;
  totalOperatories: number;
  totalPatients: number;
}

interface Appointment {
  AptNum: number;
  AptDateTime: string;
  PatNum: number;
  ProvNum: number;
  Op: number;
  AptStatus: string;
  Note?: string;
}

interface Provider {
  ProvNum: number;
  FName: string;
  LName: string;
  Abbr: string;
}

interface Operatory {
  OperatoryNum: number;
  OpName: string;
}

interface Patient {
  PatNum: number;
  FName: string;
  LName: string;
  WirelessPhone?: string;
}

export default function AdminDashboard() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const [stats, setStats] = useState<DashboardStats>({
    todayAppointments: 0,
    totalProviders: 0,
    totalOperatories: 0,
    totalPatients: 0,
  });
  const [loading, setLoading] = useState(true);
  
  // Booking summary state
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [operatories, setOperatories] = useState<Operatory[]>([]);
  const [patients, setPatients] = useState<Map<number, Patient>>(new Map());

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch today's appointments
      const today = new Date().toISOString().split('T')[0];
      const appointmentsRes = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'GetAppointments',
          parameters: { DateStart: today, DateEnd: today },
        }),
      });
      const appointmentsData = await appointmentsRes.json();

      // Fetch providers
      const providersRes = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'GetProviders',
          parameters: {},
        }),
      });
      const providersData = await providersRes.json();

      // Fetch operatories
      const operatoriesRes = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'GetOperatories',
          parameters: {},
        }),
      });
      const operatoriesData = await operatoriesRes.json();

      setStats({
        todayAppointments: Array.isArray(appointmentsData) ? appointmentsData.length : 0,
        totalProviders: Array.isArray(providersData) ? providersData.length : 0,
        totalOperatories: Array.isArray(operatoriesData) ? operatoriesData.length : 0,
        totalPatients: 0,
      });
      
      // Store providers and operatories for the summary
      setProviders(Array.isArray(providersData) ? providersData : []);
      setOperatories(Array.isArray(operatoriesData) ? operatoriesData : []);
      
      // Set initial appointments for today
      setAppointments(Array.isArray(appointmentsData) ? appointmentsData : []);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch appointments for selected date
  const fetchAppointmentsForDate = useCallback(async (date: string) => {
    setSummaryLoading(true);
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'GetAppointments',
          parameters: { DateStart: date, DateEnd: date },
        }),
      });
      const data = await res.json();
      const appointmentsData = Array.isArray(data) ? data : [];
      setAppointments(appointmentsData);
      
      // Fetch patient info for all unique patient numbers
      const patientNums = [...new Set(appointmentsData.map((a: Appointment) => a.PatNum))];
      if (patientNums.length > 0) {
        const patientMap = new Map<number, Patient>();
        // Fetch each patient
        await Promise.all(
          patientNums.map(async (patNum) => {
            try {
              const patRes = await fetch('/api/booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  functionName: 'GetPatient',
                  parameters: { PatNum: patNum },
                }),
              });
              const patData = await patRes.json();
              if (patData && !patData.error) {
                patientMap.set(patNum, patData);
              }
            } catch (e) {
              console.error(`Failed to fetch patient ${patNum}:`, e);
            }
          })
        );
        setPatients(patientMap);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setSummaryLoading(false);
    }
  }, []);
  
  useEffect(() => {
    if (!loading) {
      fetchAppointmentsForDate(selectedDate);
    }
  }, [selectedDate, loading, fetchAppointmentsForDate]);
  
  const getProviderName = (provNum: number): string => {
    const provider = providers.find(p => p.ProvNum === provNum);
    if (provider) {
      return provider.FName && provider.LName 
        ? `${provider.FName} ${provider.LName}` 
        : provider.Abbr || `Provider ${provNum}`;
    }
    return `Provider ${provNum}`;
  };
  
  const getOperatoryName = (opNum: number): string => {
    const op = operatories.find(o => o.OperatoryNum === opNum);
    return op?.OpName || `Op ${opNum}`;
  };
  
  const getPatientName = (patNum: number): string => {
    const patient = patients.get(patNum);
    if (patient && (patient.FName || patient.LName)) {
      return `${patient.FName || ''} ${patient.LName || ''}`.trim();
    }
    return `Patient #${patNum}`;
  };

  const getPatientPhone = (patNum: number): string => {
    const patient = patients.get(patNum);
    return patient?.WirelessPhone || '-';
  };
  
  const formatTime = (dateTime: string): string => {
    try {
      const timePart = dateTime.includes('T') 
        ? dateTime.split('T')[1] 
        : dateTime.split(' ')[1];
      if (!timePart) return dateTime;
      const [hours, minutes] = timePart.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    } catch {
      return dateTime;
    }
  };
  
  const scheduledAppointments = appointments.filter(a => a.AptStatus === 'Scheduled');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t('loadingDashboard')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg">
          <Phone className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">
            {t('bookingPhone')} <a href="tel:+18504036622" className="text-blue-600 font-semibold hover:underline">(850) 403-6622</a>
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('todayAppointments')}</CardTitle>
            <CardDescription>{t('scheduledForToday')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.todayAppointments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('totalProviders')}</CardTitle>
            <CardDescription>{t('activeDoctors')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalProviders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('totalOperatories')}</CardTitle>
            <CardDescription>{t('availableRooms')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalOperatories}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('totalPatients')}</CardTitle>
            <CardDescription>{t('totalRegistered')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalPatients}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/booking/appointments">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>{t('manageAppointments')}</CardTitle>
              <CardDescription>{t('viewAndEdit')}</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/booking/providers">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>{t('manageProviders')}</CardTitle>
              <CardDescription>{t('configureDoctors')}</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/booking/operatories">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>{t('manageOperatories')}</CardTitle>
              <CardDescription>{t('configureRooms')}</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/booking/patients">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>{t('managePatients')}</CardTitle>
              <CardDescription>{t('viewRecords')}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Booking Summary for Selected Date */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>{t('bookingSummary')}</CardTitle>
            <CardDescription>{t('bookingSummarySubtitle')}</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm"
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => fetchAppointmentsForDate(selectedDate)}
              disabled={summaryLoading}
            >
              {summaryLoading ? t('loading') : t('refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">{t('loadingAppointments')}</div>
            </div>
          ) : scheduledAppointments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {t('noAppointments')} {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-gray-600 mb-4">
                {scheduledAppointments.length} {t('appointmentsScheduled')}{' '}
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-2 px-3 font-medium">{t('time')}</th>
                      <th className="text-left py-2 px-3 font-medium">{t('patient')}</th>
                      <th className="text-left py-2 px-3 font-medium">{t('phone')}</th>
                      <th className="text-left py-2 px-3 font-medium">{t('provider')}</th>
                      <th className="text-left py-2 px-3 font-medium">{t('operatory')}</th>
                      <th className="text-left py-2 px-3 font-medium">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduledAppointments
                      .sort((a, b) => a.AptDateTime.localeCompare(b.AptDateTime))
                      .map((apt) => (
                        <tr key={apt.AptNum} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3 font-medium text-blue-600">
                            {formatTime(apt.AptDateTime)}
                          </td>
                          <td className="py-2 px-3">{getPatientName(apt.PatNum)}</td>
                          <td className="py-2 px-3 text-gray-600">{getPatientPhone(apt.PatNum)}</td>
                          <td className="py-2 px-3">{getProviderName(apt.ProvNum)}</td>
                          <td className="py-2 px-3">{getOperatoryName(apt.Op)}</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                              {apt.AptStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

