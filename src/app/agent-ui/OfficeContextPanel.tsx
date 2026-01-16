"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations } from '@/lib/i18n/TranslationProvider';
import type { Provider, Operatory } from "@/app/lib/officeContext";

interface Appointment {
  aptNum: number;
  aptDateTime: string;
  patNum: number;
  provNum: number;
  opNum: number;
  aptStatus: string;
  note?: string;
  patientName?: string;
  providerName?: string;
  operatoryName?: string;
}

interface OfficeContextPanelProps {
  sessionStatus: string;
}

export default function OfficeContextPanel({ sessionStatus }: OfficeContextPanelProps) {
  const tCommon = useTranslations('common');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  
  const [loading, setLoading] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [operatories, setOperatories] = useState<Operatory[]>([]);
  const [error, setError] = useState<string | null>(null);

  const formatProviderName = (provider: any): string => {
    if (provider.FName && provider.LName) {
      return `${provider.FName} ${provider.LName}`;
    }
    return provider.Abbr || `Provider ${provider.ProvNum}`;
  };

  const fetchDataForDate = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const [providersRes, operatoriesRes, appointmentsRes] = await Promise.all([
        fetch('/api/opendental', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ functionName: 'GetProviders', parameters: {} })
        }),
        fetch('/api/opendental', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ functionName: 'GetOperatories', parameters: {} })
        }),
        fetch('/api/opendental', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            functionName: 'GetAppointments',
            parameters: { DateStart: date, DateEnd: date }
          })
        })
      ]);

      const providersData = await providersRes.json();
      const operatoriesData = await operatoriesRes.json();
      const appointmentsData = await appointmentsRes.json();

      if (providersData.error) {
        setError(providersData.message || 'Failed to load providers');
        return;
      }

      const formattedProviders: Provider[] = (Array.isArray(providersData) ? providersData : []).map((p: any) => ({
        provNum: p.ProvNum,
        name: formatProviderName(p),
        firstName: p.FName || '',
        lastName: p.LName || '',
        abbr: p.Abbr || '',
        specialty: p.Specialty || 'General',
        isAvailable: !p.IsHidden && !p.IsSecondary,
        isHidden: p.IsHidden || false,
        color: p.ProvColor,
        hasSchedules: false,
        scheduleCount: 0,
        schedules: []
      }));

      const formattedOperatories: Operatory[] = (Array.isArray(operatoriesData) ? operatoriesData : []).map((o: any) => ({
        opNum: o.OperatoryNum,
        name: o.OpName || `Op ${o.OperatoryNum}`,
        abbrev: o.Abbrev || `Op${o.OperatoryNum}`,
        isHygiene: o.IsHygiene === 1 || o.IsHygiene === true,
        isAvailable: !(o.IsHidden === 1 || o.IsHidden === true),
        isHidden: o.IsHidden === 1 || o.IsHidden === true,
        provNum: o.ProvDentist || o.ProvHygienist,
        clinicNum: o.ClinicNum,
        hasSchedules: false,
        scheduleCount: 0
      }));

      const formattedAppointments: Appointment[] = (Array.isArray(appointmentsData) ? appointmentsData : []).map((apt: any) => {
        const provider = formattedProviders.find(p => p.provNum === apt.ProvNum);
        const operatory = formattedOperatories.find(o => o.opNum === apt.Op);
        return {
          aptNum: apt.AptNum,
          aptDateTime: apt.AptDateTime,
          patNum: apt.PatNum,
          provNum: apt.ProvNum,
          opNum: apt.Op,
          aptStatus: apt.AptStatus,
          note: apt.Note,
          providerName: provider?.name,
          operatoryName: operatory?.name
        };
      });

      setProviders(formattedProviders);
      setOperatories(formattedOperatories);
      setAppointments(formattedAppointments);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDataForDate(selectedDate);
  }, [selectedDate, fetchDataForDate]);

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

  const scheduledAppointments = appointments.filter(a => a.aptStatus === 'Scheduled');

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#ffffff' }}>
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: '#e5e7eb' }}>
        <h3 className="text-sm font-semibold" style={{ color: '#111827' }}>
          Office Context
        </h3>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-2 py-1 text-xs border rounded"
          style={{ borderColor: '#d1d5db' }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#3b82f6' }}></div>
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <div className="text-sm" style={{ color: '#ef4444' }}>{error}</div>
            <button 
              onClick={() => fetchDataForDate(selectedDate)}
              className="mt-2 text-xs px-3 py-1 rounded"
              style={{ background: '#3b82f6', color: '#ffffff' }}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded" style={{ background: '#f3f4f6' }}>
                <div className="text-lg font-bold" style={{ color: '#3b82f6' }}>{providers.filter(p => p.isAvailable).length}</div>
                <div className="text-xs" style={{ color: '#6b7280' }}>Providers</div>
              </div>
              <div className="p-2 rounded" style={{ background: '#f3f4f6' }}>
                <div className="text-lg font-bold" style={{ color: '#10b981' }}>{operatories.filter(o => o.isAvailable).length}</div>
                <div className="text-xs" style={{ color: '#6b7280' }}>{tCommon('operatories')}</div>
              </div>
              <div className="p-2 rounded" style={{ background: '#f3f4f6' }}>
                <div className="text-lg font-bold" style={{ color: '#f59e0b' }}>{scheduledAppointments.length}</div>
                <div className="text-xs" style={{ color: '#6b7280' }}>{tCommon('appointments')}</div>
              </div>
            </div>

            {/* Providers */}
            <div>
              <h4 className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>Providers</h4>
              <div className="space-y-1">
                {providers.filter(p => p.isAvailable).slice(0, 5).map(p => (
                  <div key={p.provNum} className="flex items-center justify-between px-2 py-1 rounded text-xs" style={{ background: '#f9fafb' }}>
                    <span style={{ color: '#111827' }}>{p.name}</span>
                    <span style={{ color: '#6b7280' }}>{p.specialty}</span>
                  </div>
                ))}
                {providers.filter(p => p.isAvailable).length > 5 && (
                  <div className="text-xs text-center" style={{ color: '#6b7280' }}>
                    +{providers.filter(p => p.isAvailable).length - 5} more
                  </div>
                )}
              </div>
            </div>

            {/* Today's Appointments */}
            <div>
              <h4 className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>{tCommon('todays_appointments')}</h4>
              {scheduledAppointments.length === 0 ? (
                <div className="text-xs text-center py-2" style={{ color: '#6b7280' }}>{tCommon('no_appointments_scheduled')}</div>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {scheduledAppointments.slice(0, 10).map(apt => (
                    <div key={apt.aptNum} className="flex items-center justify-between px-2 py-1 rounded text-xs" style={{ background: '#f9fafb' }}>
                      <span style={{ color: '#3b82f6' }}>{formatTime(apt.aptDateTime)}</span>
                      <span style={{ color: '#111827' }}>{apt.providerName || `Prov ${apt.provNum}`}</span>
                      <span style={{ color: '#6b7280' }}>{apt.operatoryName || `Op ${apt.opNum}`}</span>
                    </div>
                  ))}
                  {scheduledAppointments.length > 10 && (
                    <div className="text-xs text-center" style={{ color: '#6b7280' }}>
                      +{scheduledAppointments.length - 10} more
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

