// @ts-nocheck
/**
 * Patient Management Functions
 */

import { db } from '@/app/lib/db';

/**
 * Get all patients (for admin/dashboard use)
 */
export async function GetAllPatients(): Promise<any[]> {
  const { data, error } = await db
    .from('patients')
    .select('*')
    .order('last_name')
    .order('first_name');
  
  if (error) {
    throw new Error(`Failed to get patients: ${error.message}`);
  }
  
  // Transform to OpenDental format
  return (data || []).map(patient => ({
    PatNum: patient.id,
    FName: patient.first_name,
    LName: patient.last_name,
    WirelessPhone: patient.phone || '',
    HmPhone: patient.phone || '',
    WkPhone: '',
    Birthdate: patient.date_of_birth || '',
    Email: patient.email || '',
    DateCreated: patient.created_at,
    DateTStamp: patient.updated_at
  }));
}

/**
 * Search for patients by name or phone
 * Matches OpenDental GetMultiplePatients API
 */
export async function GetMultiplePatients(parameters: Record<string, any>): Promise<any[]> {
  const { LName, FName, Phone } = parameters;
  
  let query = db.from('patients').select('*');
  
  // Build search filters
  if (LName) {
    query = query.ilike('last_name', `%${LName}%`);
  }
  
  if (FName) {
    query = query.ilike('first_name', `%${FName}%`);
  }
  
  if (Phone) {
    // Clean phone number for search
    const cleanedPhone = Phone.replace(/\D/g, '');
    query = query.eq('phone', cleanedPhone);
  }
  
  const { data, error } = await query.order('last_name').order('first_name');
  
  if (error) {
    throw new Error(`Failed to search patients: ${error.message}`);
  }
  
  // Transform to OpenDental format
  return (data || []).map(patient => ({
    PatNum: patient.id,
    FName: patient.first_name,
    LName: patient.last_name,
    WirelessPhone: patient.phone || '',
    HmPhone: patient.phone || '',
    WkPhone: '',
    Birthdate: patient.date_of_birth || '',
    Email: patient.email || '',
    DateCreated: patient.created_at,
    DateTStamp: patient.updated_at
  }));
}

/**
 * Get single patient by ID
 */
export async function GetPatient(parameters: Record<string, any>): Promise<any> {
  const { PatNum, id } = parameters;
  const patientId = PatNum || id;
  
  if (!patientId) {
    throw new Error('PatNum or id is required');
  }
  
  const { data, error } = await db
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .single();
  
  if (error || !data) {
    throw new Error(`Patient not found: ${error?.message || 'No data returned'}`);
  }
  
  return {
    PatNum: data.id,
    FName: data.first_name,
    LName: data.last_name,
    WirelessPhone: data.phone || '',
    HmPhone: data.phone || '',
    WkPhone: '',
    Birthdate: data.date_of_birth || '',
    Email: data.email || ''
  };
}

/**
 * Create new patient
 * Required: FName, LName, Birthdate, WirelessPhone
 */
export async function CreatePatient(parameters: Record<string, any>): Promise<any> {
  const { FName, LName, Birthdate, WirelessPhone, Email } = parameters || {};
  
  // Collect all missing required parameters
  const missing: string[] = [];
  if (!FName) missing.push('FName (first name)');
  if (!LName) missing.push('LName (last name)');
  if (!Birthdate) missing.push('Birthdate (format: YYYY-MM-DD)');
  if (!WirelessPhone) missing.push('WirelessPhone (10 digits)');
  
  if (missing.length > 0) {
    throw new Error(
      `CreatePatient requires ALL 4 parameters. Missing: ${missing.join(', ')}. ` +
      `Received: ${JSON.stringify(parameters || {})}. ` +
      `Example: { FName: "John", LName: "Smith", Birthdate: "1990-01-15", WirelessPhone: "6195551234" }`
    );
  }
  
  // Validate birthdate format and value
  const birthdateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!birthdateRegex.test(Birthdate)) {
    throw new Error(
      `Invalid Birthdate format. Received: "${Birthdate}". ` +
      `Must be YYYY-MM-DD format (e.g., "1988-08-12" for August 12, 1988). ` +
      `Convert spoken dates: "12 August 1988" → "1988-08-12", "January 15, 1990" → "1990-01-15"`
    );
  }
  
  // Check for invalid dates like 0000-00-00
  const [year, month, day] = Birthdate.split('-').map(Number);
  if (year < 1900 || year > new Date().getFullYear() || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(
      `Invalid Birthdate value: "${Birthdate}". ` +
      `Year must be 1900-${new Date().getFullYear()}, month 01-12, day 01-31. ` +
      `Example: "1988-08-12" for August 12, 1988`
    );
  }
  
  // Clean phone number
  const cleanedPhone = WirelessPhone.replace(/\D/g, '');
  
  if (cleanedPhone.length !== 10) {
    const receivedLength = cleanedPhone.length;
    throw new Error(`Phone number must be exactly 10 digits. Received ${receivedLength} digit${receivedLength !== 1 ? 's' : ''} after cleaning. Please provide a complete 10-digit phone number (e.g., 619-555-1234 or (619) 555-1234).`);
  }
  
  // Format birthdate
  const birthdateFormatted = Birthdate.includes('T') 
    ? Birthdate.split('T')[0] 
    : Birthdate.split(' ')[0];
  
  const { data, error } = await db
    .from('patients')
    .insert({
      first_name: FName,
      last_name: LName,
      phone: cleanedPhone,
      date_of_birth: birthdateFormatted,
      email: Email || null
    })
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(`Failed to create patient: ${error?.message || 'No data returned'}`);
  }
  
  return {
    PatNum: data.id,
    FName: data.first_name,
    LName: data.last_name,
    WirelessPhone: data.phone || '',
    Birthdate: data.date_of_birth || ''
  };
}

/**
 * Update patient information
 */
export async function UpdatePatient(parameters: Record<string, any>): Promise<any> {
  const { PatNum, id, FName, LName, Birthdate, WirelessPhone, Email } = parameters;
  const patientId = PatNum || id;
  
  if (!patientId) {
    throw new Error('PatNum or id is required');
  }
  
  const updateData: any = {};
  
  if (FName !== undefined) updateData.first_name = FName;
  if (LName !== undefined) updateData.last_name = LName;
  if (WirelessPhone !== undefined) {
    const cleanedPhone = WirelessPhone.replace(/\D/g, '');
    if (cleanedPhone.length !== 10) {
      throw new Error('Phone number must be exactly 10 digits');
    }
    updateData.phone = cleanedPhone;
  }
  if (Birthdate !== undefined) {
    updateData.date_of_birth = Birthdate.includes('T') 
      ? Birthdate.split('T')[0] 
      : Birthdate.split(' ')[0];
  }
  if (Email !== undefined) updateData.email = Email || null;
  
  const { data, error } = await db
    .from('patients')
    .update(updateData)
    .eq('id', patientId)
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(`Failed to update patient: ${error?.message || 'No data returned'}`);
  }
  
  return {
    PatNum: data.id,
    FName: data.first_name,
    LName: data.last_name,
    WirelessPhone: data.phone || '',
    Birthdate: data.date_of_birth || ''
  };
}

/**
 * Delete patient
 * Note: This will cascade delete all related appointments
 */
export async function DeletePatient(parameters: Record<string, any>): Promise<any> {
  const { PatNum, id } = parameters;
  const patientId = PatNum || id;
  
  if (!patientId) {
    throw new Error('PatNum or id is required');
  }
  
  // Validate patient exists
  const { data: existing, error: fetchError } = await db
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .single();
  
  if (fetchError || !existing) {
    throw new Error(`Patient not found: ${fetchError?.message || 'No data returned'}`);
  }
  
  // Note: Using CASCADE delete, so related appointments will be deleted
  const { error } = await db
    .from('patients')
    .delete()
    .eq('id', patientId);
  
  if (error) {
    throw new Error(`Failed to delete patient: ${error.message}`);
  }
  
  return {
    success: true,
    PatNum: patientId
  };
}

