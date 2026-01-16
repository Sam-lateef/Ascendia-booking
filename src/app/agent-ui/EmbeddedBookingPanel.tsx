"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations } from '@/lib/i18n/TranslationProvider';

interface BookingPanelProps {
  sessionStatus: string;
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
  Abbrev: string;
}

interface Appointment {
  AptNum: number;
  AptDateTime: string;
  PatNum: number;
  ProvNum: number;
  Op: number;
  AptStatus: string;
}

interface Patient {
  PatNum: number;
  FName: string;
  LName: string;
}

export default function EmbeddedBookingPanel({ sessionStatus }: BookingPanelProps) {
  const tCommon = useTranslations('common');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [operatories, setOperatories] = useState<Operatory[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);

  const fetchData = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const [providersRes, operatoriesRes, appointmentsRes] = await Promise.all([
        fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ functionName: 'GetProviders', parameters: {} })
        }),
        fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ functionName: 'GetOperatories', parameters: {} })
        }),
        fetch('/api/booking', {
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
        setError(providersData.message || 'Failed to load data');
        return;
      }

      setProviders(Array.isArray(providersData) ? providersData : []);
      setOperatories(Array.isArray(operatoriesData) ? operatoriesData : []);
      
      const filteredAppointments = (Array.isArray(appointmentsData) ? appointmentsData : [])
        .filter((a: Appointment) => a.AptStatus === 'Scheduled');
      setAppointments(filteredAppointments);

      // Fetch patient names for appointments only
      const uniquePatNums = [...new Set(filteredAppointments.map((a: Appointment) => a.PatNum))];
      if (uniquePatNums.length > 0) {
        const patientPromises = uniquePatNums.map(patNum =>
          fetch('/api/booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ functionName: 'GetPatient', parameters: { PatNum: patNum } })
          }).then(res => res.json()).catch(() => null)
        );
        const patientResults = await Promise.all(patientPromises);
        setPatients(patientResults.filter((p): p is Patient => p && p.PatNum));
      } else {
        setPatients([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate, fetchData]);

  const formatDateTime = (dateTime: string): string => {
    try {
      const date = new Date(dateTime);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return dateTime;
    }
  };

  const getProviderName = (provNum: number): string => {
    const provider = providers.find(p => p.ProvNum === provNum);
    if (provider) {
      return provider.FName && provider.LName 
        ? `${provider.FName} ${provider.LName}` 
        : provider.Abbr || `Provider ${provNum}`;
    }
    return `Provider ${provNum}`;
  };

  const getPatientName = (patNum: number): string => {
    const patient = patients.find(p => p.PatNum === patNum);
    if (patient) {
      return patient.FName && patient.LName 
        ? `${patient.FName} ${patient.LName}` 
        : `Patient #${patNum}`;
    }
    return `Patient #${patNum}`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#ffffff' }}>
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: '#e5e7eb' }}>
        <h3 className="text-sm font-semibold" style={{ color: '#111827' }}>
          Embedded Booking
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-2 py-1 text-xs border rounded"
            style={{ borderColor: '#d1d5db' }}
          />
          <button
            onClick={() => fetchData(selectedDate)}
            disabled={loading}
            className="text-xs px-2 py-1 rounded"
            style={{ background: '#e5e7eb', color: '#374151' }}
          >
            {loading ? '...' : '↻'}
          </button>
        </div>
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
              onClick={() => fetchData(selectedDate)}
              className="mt-2 text-xs px-3 py-1 rounded"
              style={{ background: '#3b82f6', color: '#ffffff' }}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Booking Info */}
            <div className="p-3 rounded-lg" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
              <h4 className="text-sm font-semibold mb-1" style={{ color: '#166534' }}>{tCommon('barton_dental')}</h4>
              <p className="text-xs" style={{ color: '#15803d' }}>
                Embedded booking system for patient self-scheduling
              </p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 rounded" style={{ background: '#f3f4f6' }}>
                <div className="text-lg font-bold" style={{ color: '#3b82f6' }}>{providers.length}</div>
                <div className="text-xs" style={{ color: '#6b7280' }}>Providers</div>
              </div>
              <div className="p-2 rounded" style={{ background: '#f3f4f6' }}>
                <div className="text-lg font-bold" style={{ color: '#10b981' }}>{operatories.length}</div>
                <div className="text-xs" style={{ color: '#6b7280' }}>{tCommon('operatories')}</div>
              </div>
            </div>

            {/* Available Providers */}
            <div>
              <h4 className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>{tCommon('available_providers')}</h4>
              <div className="space-y-1">
                {providers.slice(0, 5).map(p => (
                  <div key={p.ProvNum} className="flex items-center justify-between px-2 py-1 rounded text-xs" style={{ background: '#f9fafb' }}>
                    <span style={{ color: '#111827' }}>
                      {p.FName && p.LName ? `${p.FName} ${p.LName}` : p.Abbr || `Provider ${p.ProvNum}`}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: '#dcfce7', color: '#166534' }}>
                      Available
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Appointments for Selected Date */}
            <div>
              <h4 className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>
                Appointments ({new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })})
              </h4>
              {appointments.length === 0 ? (
                <div className="text-xs text-center py-2" style={{ color: '#6b7280' }}>{tCommon('no_appointments_for_this_date')}</div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {appointments.map(apt => (
                    <div key={apt.AptNum} className="px-2 py-1.5 rounded text-xs" style={{ background: '#f9fafb' }}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium" style={{ color: '#111827' }}>{getPatientName(apt.PatNum)}</span>
                        <span style={{ color: '#3b82f6' }}>
                          {new Date(apt.AptDateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                        {getProviderName(apt.ProvNum)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Features */}
            <div>
              <h4 className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>{tCommon('features')}</h4>
              <div className="space-y-1 text-xs" style={{ color: '#6b7280' }}>
                <div className="flex items-center gap-2">
                  <span style={{ color: '#10b981' }}>✓</span> Patient lookup by phone
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: '#10b981' }}>✓</span> Real-time availability
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: '#10b981' }}>✓</span> Appointment booking
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: '#10b981' }}>✓</span> Rescheduling support
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

