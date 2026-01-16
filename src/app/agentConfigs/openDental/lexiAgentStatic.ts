/**
 * OpenDental Unified Lexi Agent (Static)
 * Single agent with all OpenDental functions - NO orchestrator handoff
 */

import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { z } from 'zod';

// Helper to call OpenDental API
async function callOpenDentalAPI(functionName: string, parameters: Record<string, any>) {
  const response = await fetch('/api/opendental', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ functionName, parameters }),
  });
  return await response.json();
}

// Context Tools
const GetDateTime = tool({
  name: 'GetDateTime',
  description: 'Get current date and time with day name in user local timezone',
  parameters: z.object({}),
  execute: async () => {
    const now = new Date();
    // Return local date/time to avoid timezone confusion
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} (${dayName})`;
  },
});

// Patient Management Tools
const GetMultiplePatients = tool({
  name: 'GetMultiplePatients',
  description: 'Search for patients by name or phone number',
  parameters: z.object({
    LName: z.string().optional().nullable().describe('Last name'),
    FName: z.string().optional().nullable().describe('First name'),
    Phone: z.string().optional().nullable().describe('10-digit phone number'),
  }),
  execute: async (params) => {
    const result = await callOpenDentalAPI('GetMultiplePatients', params);
    return JSON.stringify(result);
  },
});

const CreatePatient = tool({
  name: 'CreatePatient',
  description: 'Create a new patient record',
  parameters: z.object({
    FName: z.string().describe('First name'),
    LName: z.string().describe('Last name'),
    Birthdate: z.string().describe('Date of birth YYYY-MM-DD'),
    WirelessPhone: z.string().describe('10-digit phone number'),
    Email: z.string().optional().nullable().describe('Email address'),
  }),
  execute: async (params) => {
    const result = await callOpenDentalAPI('CreatePatient', params);
    return JSON.stringify(result);
  },
});

// Appointment Management Tools
const GetAppointments = tool({
  name: 'GetAppointments',
  description: 'Get appointments for a patient within a date range',
  parameters: z.object({
    PatNum: z.number().describe('Patient number'),
    DateStart: z.string().describe('Start date YYYY-MM-DD'),
    DateEnd: z.string().describe('End date YYYY-MM-DD'),
  }),
  execute: async (params) => {
    const result = await callOpenDentalAPI('GetAppointments', params);
    return JSON.stringify(result);
  },
});

const GetAvailableSlots = tool({
  name: 'GetAvailableSlots',
  description: 'Find available appointment time slots. ALL parameters required!',
  parameters: z.object({
    dateStart: z.string().describe('Start date YYYY-MM-DD'),
    dateEnd: z.string().describe('End date YYYY-MM-DD'),
    ProvNum: z.number().describe('Provider number (default: 1)'),
    OpNum: z.number().describe('Operatory number (default: 1)'),
  }),
  execute: async (params) => {
    const result = await callOpenDentalAPI('GetAvailableSlots', params);
    return JSON.stringify(result);
  },
});

const CreateAppointment = tool({
  name: 'CreateAppointment',
  description: 'Book a new appointment. Pattern: /XX/ for 20min, //XXXX// for 30min',
  parameters: z.object({
    PatNum: z.number().describe('Patient number'),
    AptDateTime: z.string().describe('Appointment date/time YYYY-MM-DD HH:mm:ss'),
    ProvNum: z.number().describe('Provider number'),
    Op: z.number().describe('Operatory number'),
    Note: z.string().describe('Appointment type (Cleaning, Exam, etc)'),
    Pattern: z.string().describe('Time pattern (/XX/ for 20min)'),
  }),
  execute: async (params) => {
    const result = await callOpenDentalAPI('CreateAppointment', params);
    return JSON.stringify(result);
  },
});

const UpdateAppointment = tool({
  name: 'UpdateAppointment',
  description: 'Reschedule an existing appointment',
  parameters: z.object({
    AptNum: z.number().describe('Appointment number to update'),
    AptDateTime: z.string().describe('New date/time YYYY-MM-DD HH:mm:ss'),
    ProvNum: z.number().describe('Provider number'),
    Op: z.number().describe('Operatory number'),
  }),
  execute: async (params) => {
    const result = await callOpenDentalAPI('UpdateAppointment', params);
    return JSON.stringify(result);
  },
});

const BreakAppointment = tool({
  name: 'BreakAppointment',
  description: 'Cancel an appointment',
  parameters: z.object({
    AptNum: z.number().describe('Appointment number to cancel'),
    sendToUnscheduledList: z.boolean().optional().nullable().describe('Add to unscheduled list'),
  }),
  execute: async (params) => {
    const result = await callOpenDentalAPI('BreakAppointment', params);
    return JSON.stringify(result);
  },
});

// Office Context Tools
const GetProviders = tool({
  name: 'GetProviders',
  description: 'Get list of all dental providers',
  parameters: z.object({}),
  execute: async () => {
    const result = await callOpenDentalAPI('GetProviders', {});
    return JSON.stringify(result);
  },
});

const GetOperatories = tool({
  name: 'GetOperatories',
  description: 'Get list of all operatories (treatment rooms)',
  parameters: z.object({}),
  execute: async () => {
    const result = await callOpenDentalAPI('GetOperatories', {});
    return JSON.stringify(result);
  },
});

// Unified Lexi Agent for OpenDental
export const lexiOpenDentalAgent = new RealtimeAgent({
  name: 'Lexi',
  voice: 'sage',
  instructions: `You are Lexi, the AI receptionist for Barton Dental.

CORE RESPONSIBILITIES:
- Help patients book, reschedule, or cancel dental appointments
- Answer questions about appointments and availability
- Be warm, professional, and efficient

STARTUP:
- Call GetDateTime at the start to know current date and day of week
- Use this to calculate dates when user says "tomorrow", "next week", "Friday", etc.

PATIENT IDENTIFICATION:
1. Ask for name or phone number
2. Use GetMultiplePatients to find them
3. If not found, offer to create new patient with CreatePatient

BOOKING NEW APPOINTMENTS:
1. Identify/create patient (get PatNum)
2. Ask what type of appointment (cleaning, exam, filling, etc)
3. Ask for preferred date
4. Call GetAvailableSlots(dateStart, dateEnd, ProvNum: 1, OpNum: 1)
5. Present 2-3 time options: "We have 9:00 AM, 10:30 AM, or 2:00 PM"
6. Wait for user to choose
7. Confirm: "I'll book you for [type] on [date] at [time]. Shall I confirm?"
8. Wait for "yes"
9. Call CreateAppointment with Pattern "/XX/" for 20min

RESCHEDULING:
1. Identify patient
2. Call GetAppointments to show existing appointments
3. Ask which one to reschedule
4. Ask for new preferred date
5. Call GetAvailableSlots
6. Present 2-3 time options
7. Get user choice
8. Confirm before calling UpdateAppointment

CANCELING:
1. Identify patient
2. Call GetAppointments to show appointments
3. Ask which one to cancel
4. Confirm before calling BreakAppointment

CRITICAL RULES:
⚠️ NEVER call functions without ALL required parameters
⚠️ ALWAYS present time options, never auto-select
⚠️ ALWAYS get explicit "yes" before booking/rescheduling/canceling
⚠️ ALWAYS show existing appointments before rescheduling
⚠️ Use YYYY-MM-DD format for dates
⚠️ Use YYYY-MM-DD HH:mm:ss format for appointment times
⚠️ Default ProvNum: 1, OpNum: 1`,
  
  tools: [
    GetDateTime,
    GetMultiplePatients,
    CreatePatient,
    GetAppointments,
    GetAvailableSlots,
    CreateAppointment,
    UpdateAppointment,
    BreakAppointment,
    GetProviders,
    GetOperatories,
  ],
});

export const lexiOpenDentalScenario = [lexiOpenDentalAgent];

export default lexiOpenDentalScenario;

