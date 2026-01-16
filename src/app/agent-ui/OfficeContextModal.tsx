"use client";

import { useTranslations } from '@/lib/i18n/TranslationProvider';

import React, { useState, useEffect, useCallback } from "react";
import type { OfficeContext, Provider, Operatory } from "@/app/lib/officeContext";

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

interface OfficeContextModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OfficeContextModal({ isOpen, onClose }: OfficeContextModalProps) {
  const tCommon = useTranslations('common');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD format
  });
  
  const [loading, setLoading] = useState(false);
  const [officeContext, setOfficeContext] = useState<OfficeContext | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [operatories, setOperatories] = useState<Operatory[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  const fetchDataForDate = useCallback(async (date: string) => {
    setLoading(true);
    try {
      // Fetch providers and operatories separately
      const [providersRes, operatoriesRes] = await Promise.all([
        fetch('/api/opendental', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            functionName: 'GetProviders',
            parameters: {}
          })
        }),
        fetch('/api/opendental', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            functionName: 'GetOperatories',
            parameters: {}
          })
        })
      ]);

      const providersData = await providersRes.json();
      const operatoriesData = await operatoriesRes.json();

      // Format providers
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

      // Format operatories
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

      // Set providers/operatories first so UI has something to show
      setProviders(formattedProviders);
      setOperatories(formattedOperatories);

      // Fetch appointments for selected date
      await fetchAppointmentsForDate(date, formattedProviders, formattedOperatories);

      // Fetch schedules for selected date - this will update providers/operatories with schedule info
      await fetchSchedulesForDate(date, formattedProviders, formattedOperatories);

    } catch (error) {
      console.error('Error fetching office context:', error);
    } finally {
      setLoading(false);
    }
  }, []); // Empty deps - function doesn't depend on any props/state that change

  // Fetch data when modal opens or date changes
  useEffect(() => {
    if (isOpen) {
      fetchDataForDate(selectedDate);
    }
  }, [isOpen, selectedDate, fetchDataForDate]);

  const fetchAppointmentsForDate = async (date: string, providers: Provider[], operatories: Operatory[]) => {
    try {
      const appointmentsRes = await fetch('/api/opendental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'GetAppointments',
          parameters: {
            DateStart: date,
            DateEnd: date
          }
        })
      });

      const appointmentsData = await appointmentsRes.json();
      const appointmentsList: Appointment[] = Array.isArray(appointmentsData) ? appointmentsData : [];

      // Enrich appointments with patient names, provider names, operatory names
      const enrichedAppointments = await Promise.all(
        appointmentsList.map(async (apt: any) => {
          const provider = providers.find(p => p.provNum === apt.ProvNum);
          const operatory = operatories.find(o => o.opNum === apt.Op);
          
          // Fetch patient name - always try to get the actual name
          let patientName = `Patient #${apt.PatNum}`;
          try {
            const patientRes = await fetch('/api/opendental', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                functionName: 'GetPatient',
                parameters: {
                  PatNum: apt.PatNum
                }
              })
            });
            
            if (!patientRes.ok) {
              throw new Error(`API returned ${patientRes.status}`);
            }
            
            const patientData = await patientRes.json();
            
            // Log the response for debugging
            console.log(`[OfficeContextModal] Patient ${apt.PatNum} data:`, {
              keys: Object.keys(patientData),
              FName: patientData.FName,
              LName: patientData.LName,
              Preferred: patientData.Preferred,
              Name: patientData.Name,
              fullData: patientData
            });
            
            // Try multiple name formats (case-insensitive)
            const fName = patientData.FName || patientData.fName || patientData.firstName;
            const lName = patientData.LName || patientData.lName || patientData.lastName;
            const preferred = patientData.Preferred || patientData.preferred;
            const name = patientData.Name || patientData.name;
            
            if (fName && lName) {
              patientName = `${fName} ${lName}`.trim();
            } else if (lName) {
              patientName = lName.trim();
            } else if (fName) {
              patientName = fName.trim();
            } else if (preferred) {
              patientName = preferred.trim();
            } else if (name) {
              patientName = name.trim();
            }
            
            // If we still have the fallback, log it for debugging
            if (patientName === `Patient #${apt.PatNum}`) {
              console.warn(`[OfficeContextModal] Could not extract patient name for PatNum ${apt.PatNum}. Available fields:`, Object.keys(patientData));
              console.warn(`[OfficeContextModal] Full patient data:`, patientData);
            } else {
              console.log(`[OfficeContextModal] ✅ Extracted patient name for PatNum ${apt.PatNum}: "${patientName}"`);
            }
          } catch (error) {
            console.error(`[OfficeContextModal] Error fetching patient ${apt.PatNum}:`, error);
            // Keep the fallback "Patient #X" if fetch fails
          }

          return {
            aptNum: apt.AptNum,
            aptDateTime: apt.AptDateTime,
            patNum: apt.PatNum,
            provNum: apt.ProvNum,
            opNum: apt.Op,
            aptStatus: apt.AptStatus,
            note: apt.Note,
            patientName,
            providerName: provider?.name || `Provider #${apt.ProvNum}`,
            operatoryName: operatory?.name || `Operatory #${apt.Op}`
          };
        })
      );

      setAppointments(enrichedAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setAppointments([]);
    }
  };

  const fetchSchedulesForDate = async (date: string, providers: Provider[], operatories: Operatory[]) => {
    try {
      console.log(`[OfficeContextModal] Fetching schedules for date: ${date}`);
      console.log(`[OfficeContextModal] Providers before filter:`, providers.map(p => ({
        provNum: p.provNum,
        name: p.name,
        isAvailable: p.isAvailable,
        isHidden: p.isHidden
      })));
      
      // Fetch schedules for all providers for this date
      const filteredProviders = providers.filter(p => p.isAvailable && !p.isHidden);
      const providersToCheck = filteredProviders.length > 0 ? filteredProviders : providers;
      
      console.log(`[OfficeContextModal] Checking schedules for ${providersToCheck.length} providers`);
      
      const schedulePromises = providersToCheck
        .slice(0, 10)
        .map(async (provider) => {
          try {
            const scheduleRes = await fetch('/api/opendental', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                functionName: 'GetMultipleSchedules',
                parameters: {
                  date: date,
                  ProvNum: provider.provNum,
                  SchedType: 'Provider'
                }
              })
            });
            const scheduleData = await scheduleRes.json();
            const schedules = Array.isArray(scheduleData) ? scheduleData : [];
            console.log(`[OfficeContextModal] Provider ${provider.provNum} (${provider.name}) schedules for ${date}:`, schedules.length);
            return schedules;
          } catch (error) {
            console.error(`Error fetching schedules for provider ${provider.provNum}:`, error);
            return [];
          }
        });

      const scheduleResults = await Promise.all(schedulePromises);
      const allSchedules = scheduleResults.flat();
      
      console.log(`[OfficeContextModal] Total schedules found for ${date}:`, allSchedules.length);
      console.log(`[OfficeContextModal] Schedule details:`, allSchedules.map(s => ({
        ScheduleNum: s.ScheduleNum,
        SchedDate: s.SchedDate,
        ProvNum: s.ProvNum,
        StartTime: s.StartTime,
        StopTime: s.StopTime
      })));

      // Update providers with schedule info
      const updatedProviders = providers.map(provider => {
        // Match by ProvNum - the API should only return schedules for the requested date
        // But we'll also check date to be safe
        const providerSchedules = allSchedules.filter((s: any) => {
          // Use loose comparison for ProvNum (API might return string or number)
          const provNumMatches = String(s.ProvNum) === String(provider.provNum);
          
          if (!provNumMatches) return false;
          
          // Check date match - normalize both dates
          if (s.SchedDate) {
            const scheduleDate = s.SchedDate.split('T')[0].split(' ')[0]; // Remove time if present
            const targetDate = date.split('T')[0].split(' ')[0]; // Remove time if present
            
            // Try exact match first
            if (scheduleDate === targetDate) return true;
            
            // Try different date formats (YYYY-MM-DD vs MM/DD/YYYY, etc.)
            const scheduleDateObj = new Date(scheduleDate);
            const targetDateObj = new Date(targetDate);
            if (!isNaN(scheduleDateObj.getTime()) && !isNaN(targetDateObj.getTime())) {
              return scheduleDateObj.getTime() === targetDateObj.getTime();
            }
            
            // If date parsing fails, include it anyway (API should have filtered)
            return true;
          }
          
          // If no date, include it (shouldn't happen but be safe)
          return true;
        });
        
        const hasSchedules = providerSchedules.length > 0;
        
        console.log(`[OfficeContextModal] Provider ${provider.provNum} (${provider.name}):`, {
          totalSchedulesFromAPI: allSchedules.filter((s: any) => s.ProvNum == provider.provNum).length,
          matchedSchedules: providerSchedules.length,
          hasSchedules,
          scheduleDates: providerSchedules.map((s: any) => s.SchedDate)
        });
        
        return {
          ...provider,
          schedules: providerSchedules.map((s: any) => ({
            scheduleNum: s.ScheduleNum,
            schedDate: s.SchedDate,
            startTime: s.StartTime,
            stopTime: s.StopTime,
            schedType: s.SchedType,
            provNum: s.ProvNum,
            operatories: s.operatories,
            note: s.Note
          })),
          scheduleCount: providerSchedules.length,
          hasSchedules: hasSchedules
        };
      });
      
      console.log(`[OfficeContextModal] Updated providers summary:`, updatedProviders.map(p => ({
        provNum: p.provNum,
        name: p.name,
        hasSchedules: p.hasSchedules,
        scheduleCount: p.scheduleCount,
        schedulesLength: p.schedules?.length || 0,
        isAvailable: p.isAvailable,
        isHidden: p.isHidden
      })));
      
      // Verify all providers have hasSchedules set correctly
      const providersWithSchedules = updatedProviders.filter(p => p.hasSchedules);
      console.log(`[OfficeContextModal] Providers with hasSchedules=true: ${providersWithSchedules.length} out of ${updatedProviders.length}`);

      // Fetch schedule ops for operatories
      const operatoryPromises = operatories
        .filter(o => o.isAvailable && !o.isHidden)
        .slice(0, 10)
        .map(async (operatory) => {
          try {
            const scheduleOpsRes = await fetch('/api/opendental', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                functionName: 'GetScheduleOps',
                parameters: {
                  OperatoryNum: operatory.opNum
                }
              })
            });
            const scheduleOpsData = await scheduleOpsRes.json();
            const scheduleOps = Array.isArray(scheduleOpsData) ? scheduleOpsData : [];
            
            // Get schedules for these schedule ops
            const scheduleNums = scheduleOps.map((so: any) => so.ScheduleNum);
            const schedulesForOps = allSchedules.filter((s: any) => 
              scheduleNums.includes(s.ScheduleNum) && s.SchedDate === date
            );
            
            return {
              opNum: operatory.opNum,
              scheduleCount: schedulesForOps.length,
              hasSchedules: schedulesForOps.length > 0
            };
          } catch (error) {
            console.error(`Error fetching schedule ops for operatory ${operatory.opNum}:`, error);
            return {
              opNum: operatory.opNum,
              scheduleCount: 0,
              hasSchedules: false
            };
          }
        });

      const operatoryScheduleResults = await Promise.all(operatoryPromises);
      const updatedOperatories = operatories.map(operatory => {
        const result = operatoryScheduleResults.find(r => r.opNum === operatory.opNum);
        return {
          ...operatory,
          scheduleCount: result?.scheduleCount || 0,
          hasSchedules: result?.hasSchedules || false
        };
      });

      console.log(`[OfficeContextModal] Setting providers state:`, updatedProviders.map(p => ({
        provNum: p.provNum,
        name: p.name,
        hasSchedules: p.hasSchedules,
        scheduleCount: p.scheduleCount,
        schedulesLength: p.schedules?.length || 0
      })));
      
      // Use functional update to ensure we're updating the latest state and avoid race conditions
      setProviders(prevProviders => {
        console.log(`[OfficeContextModal] setProviders functional update. Previous: ${prevProviders.length}, New: ${updatedProviders.length}`);
        console.log(`[OfficeContextModal] Previous providers hasSchedules:`, prevProviders.map(p => ({ name: p.name, hasSchedules: p.hasSchedules })));
        console.log(`[OfficeContextModal] New providers hasSchedules:`, updatedProviders.map(p => ({ name: p.name, hasSchedules: p.hasSchedules })));
        return updatedProviders;
      });
      
      setOperatories(updatedOperatories);
      setSchedules(allSchedules);
      
      // Force a re-render check
      console.log(`[OfficeContextModal] State updated. Providers count: ${updatedProviders.length}, Schedules count: ${allSchedules.length}`);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const formatProviderName = (provider: any): string => {
    if (provider.FName && provider.LName) {
      return `${provider.FName} ${provider.LName}`.trim();
    }
    if (provider.LName) {
      return provider.LName;
    }
    if (provider.Abbr) {
      return provider.Abbr;
    }
    return `Provider ${provider.ProvNum}`;
  };

  const handleRefresh = () => {
    fetchDataForDate(selectedDate);
  };

  const formatTime = (dateTime: string): string => {
    try {
      const date = new Date(dateTime);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateTime;
    }
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  if (!isOpen) return null;

  const providersWithSchedules = providers.filter(p => p.hasSchedules).length;
  const totalSchedules = schedules.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#ffffff' }}
      >
        {/* Header */}
        <div className="p-3 md:p-4 border-b flex items-center justify-between" style={{ borderColor: '#e5e7eb' }}>
          <h2 className="text-base md:text-lg font-semibold" style={{ color: '#111827' }}>
            Office Context & Schedule Status
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            style={{ fontSize: '24px', lineHeight: '1' }}
            aria-label={tCommon('close')}
          >
            ×
          </button>
        </div>

        {/* Date Picker and Refresh */}
        <div className="p-3 md:p-4 border-b flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3" style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}>
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs md:text-sm font-medium whitespace-nowrap" style={{ color: '#374151' }}>
              Date:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2 md:px-3 py-1.5 border rounded-lg text-xs md:text-sm flex-1"
              style={{ borderColor: '#d1d5db', color: '#111827' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
              style={{
                background: '#3b82f6',
                color: '#ffffff'
              }}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <div className="text-xs md:text-sm hidden sm:block" style={{ color: '#6b7280' }}>
              {formatDate(selectedDate)}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 md:space-y-6">
          {loading ? (
            <div className="text-center py-8" style={{ color: '#6b7280' }}>
              Loading...
            </div>
          ) : (
            <>
              {/* Schedule Configuration Summary */}
              <div className="border rounded-lg p-3 md:p-4" style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}>
                <h3 className="text-sm md:text-base font-semibold mb-2 md:mb-3" style={{ color: '#111827' }}>
                  Schedule Configuration Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 text-xs md:text-sm">
                  <div>
                    <div className="font-medium" style={{ color: '#374151' }}>{tCommon('total_schedules')}</div>
                    <div className="text-lg font-bold" style={{ color: '#111827' }}>{totalSchedules}</div>
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: '#374151' }}>Providers</div>
                    <div className="text-lg font-bold" style={{ color: '#111827' }}>
                      {providersWithSchedules}/{providers.filter(p => p.isAvailable && !p.isHidden).length}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: '#374151' }}>{tCommon('appointments')}</div>
                    <div className="text-lg font-bold" style={{ color: '#111827' }}>{appointments.length}</div>
                  </div>
                </div>
              </div>

              {/* Appointments Section */}
              <div>
                <h3 className="text-sm md:text-base font-semibold mb-2 md:mb-3" style={{ color: '#111827' }}>
                  Appointments for <span className="hidden sm:inline">{formatDate(selectedDate)}</span><span className="sm:hidden">{new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </h3>
                {appointments.length === 0 ? (
                  <div className="text-xs md:text-sm py-4 text-center" style={{ color: '#6b7280' }}>
                    No appointments scheduled for this date
                  </div>
                ) : (
                  <>
                    {/* Desktop: Table View */}
                    <div className="hidden md:block border rounded-lg overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead style={{ background: '#f9fafb' }}>
                            <tr>
                              <th className="px-4 py-2 text-left font-medium" style={{ color: '#374151' }}>{tCommon('time')}</th>
                              <th className="px-4 py-2 text-left font-medium" style={{ color: '#374151' }}>Patient</th>
                              <th className="px-4 py-2 text-left font-medium" style={{ color: '#374151' }}>Provider</th>
                              <th className="px-4 py-2 text-left font-medium" style={{ color: '#374151' }}>{tCommon('operatory')}</th>
                              <th className="px-4 py-2 text-left font-medium" style={{ color: '#374151' }}>Status</th>
                              <th className="px-4 py-2 text-left font-medium" style={{ color: '#374151' }}>{tCommon('note')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {appointments.map((apt) => (
                              <tr key={apt.aptNum} className="border-t" style={{ borderColor: '#e5e7eb' }}>
                                <td className="px-4 py-2" style={{ color: '#111827' }}>{formatTime(apt.aptDateTime)}</td>
                                <td className="px-4 py-2" style={{ color: '#111827' }}>{apt.patientName}</td>
                                <td className="px-4 py-2" style={{ color: '#111827' }}>{apt.providerName}</td>
                                <td className="px-4 py-2" style={{ color: '#111827' }}>{apt.operatoryName}</td>
                                <td className="px-4 py-2">
                                  <span
                                    className="px-2 py-1 rounded text-xs font-medium"
                                    style={{
                                      background: apt.aptStatus === 'Scheduled' ? '#dbeafe' : '#f3f4f6',
                                      color: apt.aptStatus === 'Scheduled' ? '#1e40af' : '#374151'
                                    }}
                                  >
                                    {apt.aptStatus}
                                  </span>
                                </td>
                                <td className="px-4 py-2" style={{ color: '#6b7280' }}>{apt.note || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    {/* Mobile: Card View */}
                    <div className="md:hidden space-y-2">
                      {appointments.map((apt) => (
                        <div
                          key={apt.aptNum}
                          className="border rounded-lg p-3"
                          style={{ borderColor: '#e5e7eb', background: '#ffffff' }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold" style={{ color: '#111827' }}>
                              {formatTime(apt.aptDateTime)}
                            </div>
                            <span
                              className="px-2 py-1 rounded text-xs font-medium"
                              style={{
                                background: apt.aptStatus === 'Scheduled' ? '#dbeafe' : '#f3f4f6',
                                color: apt.aptStatus === 'Scheduled' ? '#1e40af' : '#374151'
                              }}
                            >
                              {apt.aptStatus}
                            </span>
                          </div>
                          <div className="space-y-1 text-xs" style={{ color: '#374151' }}>
                            <div><span className="font-medium">{tCommon('patient')}</span> {apt.patientName}</div>
                            <div><span className="font-medium">Provider:</span> {apt.providerName}</div>
                            <div><span className="font-medium">{tCommon('operatory')}</span> {apt.operatoryName}</div>
                            {apt.note && (
                              <div className="pt-1" style={{ color: '#6b7280' }}>
                                <span className="font-medium">{tCommon('note')}</span> {apt.note}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Providers Section */}
              <div>
                <h3 className="text-sm md:text-base font-semibold mb-2 md:mb-3" style={{ color: '#111827' }}>
                  Providers
                </h3>
                <div className="space-y-2">
                  {(() => {
                    console.log(`[OfficeContextModal] Total providers in state: ${providers.length}`);
                    console.log(`[OfficeContextModal] All providers state:`, providers.map(p => ({
                      provNum: p.provNum,
                      name: p.name,
                      isAvailable: p.isAvailable,
                      isHidden: p.isHidden,
                      hasSchedules: p.hasSchedules,
                      scheduleCount: p.scheduleCount
                    })));
                    
                    const filteredProviders = providers.filter(p => p.isAvailable && !p.isHidden);
                    console.log(`[OfficeContextModal] After filter (isAvailable && !isHidden): ${filteredProviders.length} providers`);
                    
                    // If filter excludes all, show all providers anyway (same as officeContext.ts)
                    const providersToRender = filteredProviders.length > 0 ? filteredProviders : providers;
                    console.log(`[OfficeContextModal] Rendering ${providersToRender.length} providers. State:`, providersToRender.map(p => ({
                      provNum: p.provNum,
                      name: p.name,
                      hasSchedules: p.hasSchedules,
                      scheduleCount: p.scheduleCount,
                      schedulesLength: p.schedules?.length || 0
                    })));
                    return providersToRender.map((provider) => {
                      // Debug log for each provider being rendered
                      console.log(`[OfficeContextModal] Rendering provider ${provider.provNum} (${provider.name}):`, {
                        hasSchedules: provider.hasSchedules,
                        scheduleCount: provider.scheduleCount,
                        schedulesLength: provider.schedules?.length || 0,
                        type: typeof provider.hasSchedules,
                        value: provider.hasSchedules
                      });
                      return (
                    <div
                      key={provider.provNum}
                      className="border rounded-lg p-2 md:p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                      style={{
                        borderColor: provider.hasSchedules ? '#10b981' : '#e5e7eb',
                        background: provider.hasSchedules ? '#f0fdf4' : '#ffffff'
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm md:text-base" style={{ color: '#111827' }}>{provider.name}</div>
                        {provider.hasSchedules && provider.schedules && provider.schedules.length > 0 && (
                          <div className="text-xs mt-1 space-y-1" style={{ color: '#6b7280' }}>
                            {provider.schedules.map((sched, idx) => (
                              <div key={idx}>
                                {sched.startTime} - {sched.stopTime}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {provider.hasSchedules ? (
                          <span className="px-2 py-1 rounded text-xs md:text-sm whitespace-nowrap" style={{ background: '#10b981', color: '#ffffff' }}>
                            {provider.scheduleCount} schedule{provider.scheduleCount !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded text-xs md:text-sm whitespace-nowrap" style={{ background: '#ef4444', color: '#ffffff' }}>
                            Needs Setup
                          </span>
                        )}
                      </div>
                    </div>
                    );
                    });
                  })()}
                </div>
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
}

