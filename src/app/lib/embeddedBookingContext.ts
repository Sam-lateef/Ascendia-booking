/**
 * Embedded Booking Office Context Fetcher
 * 
 * Similar to officeContext.ts but fetches from /api/booking instead
 */

import { openDentalConfig } from '@/app/agentConfigs/openDental/config';

export interface Provider {
  provNum: number;
  name: string;
  firstName: string;
  lastName: string;
  specialty: string;
  isAvailable: boolean;
}

export interface Operatory {
  opNum: number;
  name: string;
  isHygiene: boolean;
  isAvailable: boolean;
}

export interface OccupiedSlot {
  aptNum: number;
  aptDateTime: string;
  patNum: number;
  provNum: number;
  opNum: number;
  duration: number;
}

export interface EmbeddedBookingOfficeContext {
  providers: Provider[];
  operatories: Operatory[];
  occupiedSlots: OccupiedSlot[];
  officeHours: typeof openDentalConfig.availability.officeHours;
  defaults: typeof openDentalConfig.defaults;
  fetchedAt: string;
  expiresAt: string;
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format provider name
 */
function formatProviderName(provider: any): string {
  if (provider.FName && provider.LName) {
    return `${provider.FName} ${provider.LName}`.trim();
  }
  return `Provider ${provider.ProvNum}`;
}

/**
 * Fetch complete office context from booking API
 */
export async function fetchEmbeddedBookingContext(): Promise<EmbeddedBookingOfficeContext> {
  const config = openDentalConfig;
  const today = new Date();
  const todayStr = formatDate(today);
  
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + config.availability.lookAheadDays);
  const endDateStr = formatDate(endDate);

  try {
    // Use absolute URL when running server-side (relative URLs don't work in Node.js fetch)
    const baseUrl = typeof window !== 'undefined' 
      ? '' 
      : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
    
    // Fetch all in parallel
    const [providersRes, operatoriesRes, appointmentsRes] = await Promise.all([
      fetch(`${baseUrl}/api/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          functionName: 'GetProviders',
          parameters: {}
        })
      }),
      
      fetch(`${baseUrl}/api/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          functionName: 'GetOperatories',
          parameters: {}
        })
      }),
      
      fetch(`${baseUrl}/api/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          functionName: 'GetAppointments',
          parameters: {
            DateStart: todayStr,
            DateEnd: endDateStr
          }
        })
      })
    ]);

    const [providersData, operatoriesData, appointmentsData] = await Promise.all([
      providersRes.json(),
      operatoriesRes.json(),
      appointmentsRes.json()
    ]);

    // Format providers
    const providers: Provider[] = (Array.isArray(providersData) ? providersData : []).map((p: any) => ({
      provNum: p.ProvNum,
      name: formatProviderName(p),
      firstName: p.FName || '',
      lastName: p.LName || '',
      specialty: p.Specialty || 'General',
      isAvailable: !p.IsHidden
    }));

    // Format operatories
    const operatories: Operatory[] = (Array.isArray(operatoriesData) ? operatoriesData : []).map((o: any) => ({
      opNum: o.OperatoryNum,
      name: o.OpName || `Op ${o.OperatoryNum}`,
      isHygiene: o.IsHygiene === 1 || o.IsHygiene === true,
      isAvailable: !(o.IsHidden === 1 || o.IsHidden === true)
    }));

    // Format occupied slots
    const occupiedSlots: OccupiedSlot[] = (Array.isArray(appointmentsData) ? appointmentsData : []).map((apt: any) => ({
      aptNum: apt.AptNum,
      aptDateTime: apt.AptDateTime,
      patNum: apt.PatNum,
      provNum: apt.ProvNum,
      opNum: apt.Op,
      duration: 30 // Default 30 minutes
    }));

    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.dataFreshness.officeContextTTL);

    return {
      providers,
      operatories,
      occupiedSlots,
      officeHours: config.availability.officeHours,
      defaults: config.defaults,
      fetchedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
  } catch (error) {
    console.error('Error fetching embedded booking context:', error);
    
    // Return minimal fallback
    const now = new Date();
    return {
      providers: [],
      operatories: [],
      occupiedSlots: [],
      officeHours: config.availability.officeHours,
      defaults: config.defaults,
      fetchedAt: now.toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString()
    };
  }
}


