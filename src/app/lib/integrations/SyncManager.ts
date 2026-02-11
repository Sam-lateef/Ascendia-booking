/**
 * Sync Manager
 * 
 * Handles synchronization between local database and external integrations.
 * Supports multiple sync strategies:
 * - local_only: Write only to local DB
 * - to_external: Create local copy + sync to external (dual-write)
 * - from_external: Pull from external to local
 * - bidirectional: Two-way sync
 * 
 * Supported integrations:
 * - OpenDental: Patient and appointment sync
 * - Google Calendar: Appointment/event sync
 * 
 * Use case: Clinics can use booking system with/without external sync
 * 
 * Channel-aware syncing:
 * Each channel (Twilio, Retell, WhatsApp, Web) can be configured to sync
 * with specific integrations. The SyncManager checks both:
 * 1. Organization-level: Is the integration configured? (integration_sync_configs)
 * 2. Channel-level: Is this integration allowed for this channel? (allowedIntegrations)
 */

import { getSupabaseAdmin } from '../supabaseClient';
import { IntegrationExecutor, getIntegrationByProvider } from './IntegrationExecutor';
import { GoogleCalendarService } from './GoogleCalendarService';
import { getGoogleCalendarCredentials } from '../credentialLoader';

interface SyncConfig {
  id: string;
  organization_id: string;
  integration_id: string;
  sync_enabled: boolean;
  sync_direction: 'local_only' | 'to_external' | 'from_external' | 'bidirectional';
  sync_on_create: boolean;
  sync_on_update: boolean;
  sync_on_delete: boolean;
  always_keep_local_copy: boolean;
  conflict_resolution: 'external_wins' | 'local_wins' | 'manual' | 'latest_timestamp';
}

/**
 * Context for channel-aware sync operations
 */
export interface SyncContext {
  /** The channel initiating the request (twilio, retell, whatsapp, web) */
  channel?: string;
  /** Allowed integrations for this channel (from channel_configurations.data_integrations) */
  allowedIntegrations?: string[];
}

export class SyncManager {
  private organizationId: string;

  constructor(organizationId: string) {
    this.organizationId = organizationId;
  }

  /**
   * Check if an integration is allowed for the current sync context
   * Returns true if:
   * - No allowedIntegrations specified (legacy mode, sync all)
   * - Integration is in the allowedIntegrations list
   */
  private isIntegrationAllowed(integrationName: string, context?: SyncContext): boolean {
    // If no context or no allowedIntegrations, allow all (backwards compatible)
    if (!context?.allowedIntegrations || context.allowedIntegrations.length === 0) {
      return true;
    }
    
    // Check if integration is in allowed list
    // Support both exact match and variations (e.g., "opendental" or "open_dental")
    const normalized = integrationName.toLowerCase().replace(/_/g, '');
    return context.allowedIntegrations.some(allowed => {
      const normalizedAllowed = allowed.toLowerCase().replace(/_/g, '');
      return normalized === normalizedAllowed || 
             normalized.includes(normalizedAllowed) || 
             normalizedAllowed.includes(normalized);
    });
  }

  /**
   * Create appointment with sync support
   * Syncs to: Local DB, OpenDental (if configured), Google Calendar (if configured)
   * 
   * @param data - Appointment data
   * @param context - Optional sync context with channel and allowed integrations
   */
  async createAppointment(data: any, context?: SyncContext): Promise<any> {
    console.log('[SyncManager] createAppointment called for org:', this.organizationId);
    if (context?.channel) {
      console.log(`[SyncManager] Channel: ${context.channel}, Allowed integrations: ${context.allowedIntegrations?.join(', ') || 'all'}`);
    }

    // Check if OpenDental sync is configured AND allowed for this channel
    const openDentalConfig = await this.getSyncConfig('opendental');
    const googleCalendarConfig = await this.getSyncConfig('google_calendar');

    // Determine if we have any external syncs enabled AND allowed
    const openDentalAllowed = this.isIntegrationAllowed('opendental', context);
    const googleCalendarAllowed = this.isIntegrationAllowed('google_calendar', context);
    
    const hasOpenDentalSync = openDentalConfig?.sync_enabled && 
                              openDentalConfig.sync_direction !== 'local_only' &&
                              openDentalAllowed;
    const hasGoogleCalendarSync = googleCalendarConfig?.sync_enabled && 
                                   googleCalendarConfig.sync_direction !== 'local_only' &&
                                   googleCalendarAllowed;
    
    // Log what we're syncing to
    if (!openDentalAllowed && openDentalConfig?.sync_enabled) {
      console.log(`[SyncManager] OpenDental sync skipped - not allowed for channel ${context?.channel}`);
    }
    if (!googleCalendarAllowed && googleCalendarConfig?.sync_enabled) {
      console.log(`[SyncManager] Google Calendar sync skipped - not allowed for channel ${context?.channel}`);
    }

    // Strategy 1: Local only (no external sync)
    if (!hasOpenDentalSync && !hasGoogleCalendarSync) {
      console.log('[SyncManager] Local only mode - creating appointment in local DB');
      return await this.createLocalAppointment(data);
    }

    // Strategy 2: Always keep local copy + sync to external (dual-write)
    console.log('[SyncManager] Dual-write mode - creating in local DB and syncing to external');
    
    // Create local copy first
    const local = await this.createLocalAppointment(data);

    // Sync to OpenDental if enabled
    if (hasOpenDentalSync && openDentalConfig!.sync_on_create) {
      try {
        const externalResult = await this.syncToExternal(
          'opendental',
          'CreateAppointment',
          this.mapToExternalFormat(local, 'appointment')
        );

        // Update local record with external ID if provided
        if (externalResult.AptNum || externalResult.appointmentId) {
          const externalId = externalResult.AptNum || externalResult.appointmentId;
          await this.updateLocalAppointmentExternalId(local.id, externalId);
        }

        console.log('[SyncManager] ✅ Synced to OpenDental successfully');
      } catch (error) {
        // Log error but don't fail local creation
        console.error('[SyncManager] ⚠️ OpenDental sync failed:', error);
        await this.logSyncError(openDentalConfig!.id, 'create_appointment', error);
      }
    }

    // Sync to Google Calendar if enabled
    if (hasGoogleCalendarSync && googleCalendarConfig!.sync_on_create) {
      try {
        await this.syncToGoogleCalendar(local, 'create');
        console.log('[SyncManager] ✅ Synced to Google Calendar successfully');
      } catch (error) {
        console.error('[SyncManager] ⚠️ Google Calendar sync failed:', error);
        await this.logSyncError(googleCalendarConfig!.id, 'create_appointment_gcal', error);
      }
    }

    return local;
  }

  /**
   * Update appointment with sync support
   * 
   * @param appointmentId - ID of appointment to update
   * @param data - Updated appointment data
   * @param context - Optional sync context with channel and allowed integrations
   */
  async updateAppointment(appointmentId: string, data: any, context?: SyncContext): Promise<any> {
    console.log('[SyncManager] updateAppointment called');
    if (context?.channel) {
      console.log(`[SyncManager] Channel: ${context.channel}, Allowed integrations: ${context.allowedIntegrations?.join(', ') || 'all'}`);
    }

    const openDentalConfig = await this.getSyncConfig('opendental');
    const googleCalendarConfig = await this.getSyncConfig('google_calendar');

    // Check if integrations are allowed for this channel
    const openDentalAllowed = this.isIntegrationAllowed('opendental', context);
    const googleCalendarAllowed = this.isIntegrationAllowed('google_calendar', context);

    // Update local first
    const local = await this.updateLocalAppointment(appointmentId, data);

    // Sync to OpenDental if configured AND allowed
    if (openDentalConfig?.sync_enabled && openDentalConfig.sync_on_update && 
        openDentalConfig.sync_direction !== 'local_only' && openDentalAllowed) {
      try {
        await this.syncToExternal(
          'opendental',
          'UpdateAppointment',
          this.mapToExternalFormat(local, 'appointment')
        );
        console.log('[SyncManager] ✅ Update synced to OpenDental');
      } catch (error) {
        console.error('[SyncManager] ⚠️ OpenDental sync failed:', error);
        await this.logSyncError(openDentalConfig.id, 'update_appointment', error);
      }
    } else if (!openDentalAllowed && openDentalConfig?.sync_enabled) {
      console.log(`[SyncManager] OpenDental sync skipped - not allowed for channel ${context?.channel}`);
    }

    // Sync to Google Calendar if configured AND allowed
    if (googleCalendarConfig?.sync_enabled && googleCalendarConfig.sync_on_update && 
        googleCalendarConfig.sync_direction !== 'local_only' && googleCalendarAllowed) {
      try {
        await this.syncToGoogleCalendar(local, 'update');
        console.log('[SyncManager] ✅ Update synced to Google Calendar');
      } catch (error) {
        console.error('[SyncManager] ⚠️ Google Calendar sync failed:', error);
        await this.logSyncError(googleCalendarConfig.id, 'update_appointment_gcal', error);
      }
    } else if (!googleCalendarAllowed && googleCalendarConfig?.sync_enabled) {
      console.log(`[SyncManager] Google Calendar sync skipped - not allowed for channel ${context?.channel}`);
    }

    return local;
  }

  /**
   * Delete/cancel appointment with sync support
   * 
   * @param appointmentId - ID of appointment to delete
   * @param context - Optional sync context with channel and allowed integrations
   */
  async deleteAppointment(appointmentId: string, context?: SyncContext): Promise<any> {
    console.log('[SyncManager] deleteAppointment called');
    if (context?.channel) {
      console.log(`[SyncManager] Channel: ${context.channel}, Allowed integrations: ${context.allowedIntegrations?.join(', ') || 'all'}`);
    }

    const openDentalConfig = await this.getSyncConfig('opendental');
    const googleCalendarConfig = await this.getSyncConfig('google_calendar');

    // Check if integrations are allowed for this channel
    const openDentalAllowed = this.isIntegrationAllowed('opendental', context);
    const googleCalendarAllowed = this.isIntegrationAllowed('google_calendar', context);

    // Get appointment data before deletion
    const supabase = getSupabaseAdmin();
    const { data: appointment } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .eq('organization_id', this.organizationId)
      .single();

    // Sync deletion to Google Calendar BEFORE deleting local (need the event ID)
    if (googleCalendarConfig?.sync_enabled && googleCalendarConfig.sync_on_delete && 
        appointment?.google_calendar_event_id && googleCalendarAllowed) {
      try {
        await this.syncToGoogleCalendar(appointment, 'delete');
        console.log('[SyncManager] ✅ Deletion synced to Google Calendar');
      } catch (error) {
        console.error('[SyncManager] ⚠️ Google Calendar sync failed:', error);
      }
    } else if (!googleCalendarAllowed && googleCalendarConfig?.sync_enabled && appointment?.google_calendar_event_id) {
      console.log(`[SyncManager] Google Calendar deletion skipped - not allowed for channel ${context?.channel}`);
    }

    // Delete from local
    await supabase
      .from('appointments')
      .delete()
      .eq('id', appointmentId)
      .eq('organization_id', this.organizationId);

    // Sync deletion to OpenDental if configured AND allowed
    if (openDentalConfig?.sync_enabled && openDentalConfig.sync_on_delete && 
        appointment && openDentalAllowed) {
      try {
        // Most APIs use "cancel" or "break" instead of delete
        await this.syncToExternal(
          'opendental',
          'BreakAppointment',
          { AptNum: appointment.external_id || appointmentId }
        );
        console.log('[SyncManager] ✅ Deletion synced to OpenDental');
      } catch (error) {
        console.error('[SyncManager] ⚠️ OpenDental sync failed:', error);
      }
    } else if (!openDentalAllowed && openDentalConfig?.sync_enabled && appointment) {
      console.log(`[SyncManager] OpenDental deletion skipped - not allowed for channel ${context?.channel}`);
    }

    return { success: true, id: appointmentId };
  }

  /**
   * Create patient with sync support
   * 
   * @param data - Patient data
   * @param context - Optional sync context with channel and allowed integrations
   */
  async createPatient(data: any, context?: SyncContext): Promise<any> {
    console.log('[SyncManager] createPatient called');
    if (context?.channel) {
      console.log(`[SyncManager] Channel: ${context.channel}, Allowed integrations: ${context.allowedIntegrations?.join(', ') || 'all'}`);
    }

    const syncConfig = await this.getSyncConfig('opendental');
    const openDentalAllowed = this.isIntegrationAllowed('opendental', context);

    // Local only or dual-write
    const local = await this.createLocalPatient(data);

    // Sync to external if configured AND allowed
    if (syncConfig?.sync_enabled && syncConfig.sync_on_create && 
        syncConfig.sync_direction !== 'local_only' && openDentalAllowed) {
      try {
        const externalResult = await this.syncToExternal(
          'opendental',
          'CreatePatient',
          this.mapToExternalFormat(local, 'patient')
        );

        // Update local with external ID
        if (externalResult.PatNum || externalResult.patientId) {
          const externalId = externalResult.PatNum || externalResult.patientId;
          await this.updateLocalPatientExternalId(local.id, externalId);
        }

        console.log('[SyncManager] ✅ Patient synced to external');
      } catch (error) {
        console.error('[SyncManager] ⚠️ Patient sync failed:', error);
        await this.logSyncError(syncConfig?.id || '', 'create_patient', error);
      }
    } else if (!openDentalAllowed && syncConfig?.sync_enabled) {
      console.log(`[SyncManager] Patient sync to OpenDental skipped - not allowed for channel ${context?.channel}`);
    }

    return local;
  }

  /**
   * Get sync configuration for a provider
   */
  private async getSyncConfig(providerKey: string): Promise<SyncConfig | null> {
    const supabase = getSupabaseAdmin();

    // Get integration ID
    const integration = await getIntegrationByProvider(this.organizationId, providerKey);
    if (!integration) {
      return null;
    }

    // Get sync config
    const { data, error } = await supabase
      .from('integration_sync_configs')
      .select('*')
      .eq('organization_id', this.organizationId)
      .eq('integration_id', integration.id)
      .maybeSingle();

    if (error) {
      console.error('[SyncManager] Error loading sync config:', error);
      return null;
    }

    return data as SyncConfig | null;
  }

  /**
   * Sync data to external integration
   */
  private async syncToExternal(
    providerKey: string,
    functionName: string,
    data: any
  ): Promise<any> {
    const integration = await getIntegrationByProvider(this.organizationId, providerKey);
    
    if (!integration) {
      throw new Error(`Integration '${providerKey}' not found`);
    }

    const executor = new IntegrationExecutor(integration.id, this.organizationId);
    return await executor.execute(functionName, data);
  }

  /**
   * Create appointment in local database
   */
  private async createLocalAppointment(data: any): Promise<any> {
    const supabase = getSupabaseAdmin();

    const { data: result, error } = await supabase
      .from('appointments')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create local appointment: ${error.message}`);
    }

    return result;
  }

  /**
   * Update appointment in local database
   */
  private async updateLocalAppointment(appointmentId: string, data: any): Promise<any> {
    const supabase = getSupabaseAdmin();

    const { data: result, error } = await supabase
      .from('appointments')
      .update(data)
      .eq('id', appointmentId)
      .eq('organization_id', this.organizationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update local appointment: ${error.message}`);
    }

    return result;
  }

  /**
   * Create patient in local database
   */
  private async createLocalPatient(data: any): Promise<any> {
    const supabase = getSupabaseAdmin();

    const { data: result, error } = await supabase
      .from('patients')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create local patient: ${error.message}`);
    }

    return result;
  }

  /**
   * Update local appointment with external ID
   */
  private async updateLocalAppointmentExternalId(localId: string, externalId: string): Promise<void> {
    const supabase = getSupabaseAdmin();

    await supabase
      .from('appointments')
      .update({ external_id: externalId })
      .eq('id', localId)
      .eq('organization_id', this.organizationId);
  }

  /**
   * Update local patient with external ID
   */
  private async updateLocalPatientExternalId(localId: string, externalId: string): Promise<void> {
    const supabase = getSupabaseAdmin();

    await supabase
      .from('patients')
      .update({ external_id: externalId })
      .eq('id', localId)
      .eq('organization_id', this.organizationId);
  }

  /**
   * Map local data to external format
   */
  private mapToExternalFormat(data: any, type: 'appointment' | 'patient'): any {
    if (type === 'appointment') {
      return {
        PatNum: data.patient_id,
        AptDateTime: data.appointment_datetime,
        ProvNum: data.provider_id,
        Op: data.operatory_id,
        Note: data.notes || data.appointment_type,
        AptStatus: data.status,
        AptNum: data.external_id || data.id,
      };
    } else if (type === 'patient') {
      return {
        FName: data.first_name,
        LName: data.last_name,
        Birthdate: data.date_of_birth,
        WirelessPhone: data.phone,
        Email: data.email,
        PatNum: data.external_id || data.id,
      };
    }

    return data;
  }

  /**
   * Log sync error for monitoring
   */
  private async logSyncError(syncConfigId: string, operation: string, error: any): Promise<void> {
    const supabase = getSupabaseAdmin();

    await supabase
      .from('integration_sync_configs')
      .update({
        last_sync_status: 'error',
        last_sync_error: error.message || String(error),
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', syncConfigId);
  }

  /**
   * Sync from Google Calendar to local (pull events as appointments)
   * Used when sync_direction is from_external or bidirectional
   * 
   * @param options - timeMin, timeMax (ISO strings), defaults to last 7 days to next 90 days
   * @returns { created, updated, cancelled } counts
   */
  async syncFromGoogleCalendar(options?: {
    timeMin?: string;
    timeMax?: string;
  }): Promise<{ created: number; updated: number; cancelled: number; error?: string }> {
    const googleConfig = await this.getSyncConfig('google_calendar');
    if (!googleConfig?.sync_enabled) {
      return { created: 0, updated: 0, cancelled: 0, error: 'Google Calendar sync not enabled' };
    }
    if (googleConfig.sync_direction !== 'from_external' && googleConfig.sync_direction !== 'bidirectional') {
      return { created: 0, updated: 0, cancelled: 0, error: 'Sync direction must be from_external or bidirectional' };
    }

    const credentials = await getGoogleCalendarCredentials(this.organizationId);
    if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
      return { created: 0, updated: 0, cancelled: 0, error: 'Google Calendar credentials not configured' };
    }

    const calendarId = credentials.calendarId || 'primary';
    const now = new Date();
    const timeMin = options?.timeMin || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = options?.timeMax || new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const calendarService = new GoogleCalendarService(this.organizationId);
    let created = 0;
    let updated = 0;
    let cancelled = 0;

    const supabase = getSupabaseAdmin();

    // Get default provider and operatory for new appointments
    const { data: firstProvider } = await supabase
      .from('providers')
      .select('id')
      .eq('organization_id', this.organizationId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    const { data: firstOperatory } = await supabase
      .from('operatories')
      .select('id')
      .eq('organization_id', this.organizationId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    const defaultProviderId = firstProvider?.id ?? null;
    const defaultOperatoryId = firstOperatory?.id ?? null;

    let nextPageToken: string | undefined;
    do {
      const events = await calendarService.listEvents(calendarId, {
        timeMin,
        timeMax,
        maxResults: 250,
        singleEvents: true,
        orderBy: 'startTime',
        pageToken: nextPageToken,
      });

      for (const gEvent of events) {
        const eventId = gEvent.id;
        if (!eventId) continue;

        const startTime = gEvent.start?.dateTime || gEvent.start?.date;
        const endTime = gEvent.end?.dateTime || gEvent.end?.date;
        if (!startTime || !endTime) continue;

        const startDate = new Date(startTime);
        const endDate = new Date(endTime);
        const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
        const appointmentDatetime = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')} ${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}:00`;

        const status = gEvent.status === 'cancelled' ? 'Cancelled' : 'Scheduled';

        const { data: existing } = await supabase
          .from('appointments')
          .select('id, status')
          .eq('organization_id', this.organizationId)
          .eq('google_calendar_event_id', eventId)
          .maybeSingle();

        if (existing) {
          if (status === 'Cancelled') {
            await supabase
              .from('appointments')
              .update({ status: 'Cancelled', updated_at: new Date().toISOString() })
              .eq('id', existing.id)
              .eq('organization_id', this.organizationId);
            cancelled++;
          } else {
            await supabase
              .from('appointments')
              .update({
                appointment_datetime: appointmentDatetime,
                duration_minutes: durationMinutes,
                notes: gEvent.summary || gEvent.description || null,
                status: 'Scheduled',
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id)
              .eq('organization_id', this.organizationId);
            updated++;
          }
        } else if (status !== 'Cancelled') {
          await supabase.from('appointments').insert({
            organization_id: this.organizationId,
            patient_id: null,
            provider_id: defaultProviderId,
            operatory_id: defaultOperatoryId,
            appointment_datetime: appointmentDatetime,
            duration_minutes: durationMinutes || 30,
            appointment_type: 'Google Calendar',
            notes: gEvent.summary || gEvent.description || null,
            status: 'Scheduled',
            google_calendar_event_id: eventId,
          });
          created++;
        }
      }

      nextPageToken = (events as { nextPageToken?: string }).nextPageToken;
    } while (nextPageToken);

    if (googleConfig.id) {
      await supabase
        .from('integration_sync_configs')
        .update({
          last_sync_status: 'success',
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', googleConfig.id);
    }

    console.log(`[SyncManager] syncFromGoogleCalendar: created=${created}, updated=${updated}, cancelled=${cancelled}`);
    return { created, updated, cancelled };
  }

  /**
   * Sync appointment to Google Calendar
   */
  private async syncToGoogleCalendar(
    appointment: any, 
    operation: 'create' | 'update' | 'delete'
  ): Promise<void> {
    // Get Google Calendar credentials
    const { getGoogleCalendarCredentials } = await import('../credentialLoader');
    const credentials = await getGoogleCalendarCredentials(this.organizationId);

    if (!credentials || !credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
      console.log('[SyncManager] Google Calendar credentials not configured, skipping sync');
      return;
    }

    // Initialize Google Calendar service (loads credentials via organizationId)
    const calendarService = new GoogleCalendarService(this.organizationId);
    const calendarId = credentials.calendarId || 'primary';

    // Fetch patient name and org timezone
    const supabaseSync = getSupabaseAdmin();
    let patientName = 'Appointment';
    if (appointment.patient_id) {
      const { data: patient } = await supabaseSync
        .from('patients')
        .select('first_name, last_name')
        .eq('id', appointment.patient_id)
        .single();
      
      if (patient) {
        patientName = `${patient.first_name} ${patient.last_name}`;
      }
    }

    // Get org timezone for correct Google Calendar event placement
    const { data: orgData } = await supabaseSync
      .from('organizations')
      .select('timezone')
      .eq('id', this.organizationId)
      .single();
    const orgTimezone = orgData?.timezone || 'America/New_York';

    // appointment_datetime is stored as naive local time in org's timezone (e.g., "2026-02-12T16:00:00" = 4pm local)
    // We must NOT use .toISOString() which appends "Z" (UTC) - instead send naive datetime + timeZone
    const naiveDatetime = String(appointment.appointment_datetime).replace(/[Z+].*$/, '').replace(/\.\d+$/, '');
    const durationMs = (appointment.duration_minutes || 30) * 60000;
    const startMs = new Date(naiveDatetime).getTime();
    const endDate = new Date(startMs + durationMs);
    const naiveEndDatetime = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}T${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}:00`;

    console.log(`[SyncManager] GCal sync: naive start=${naiveDatetime}, end=${naiveEndDatetime}, tz=${orgTimezone}`);

    if (operation === 'create') {
      const event = await calendarService.createEvent(calendarId, {
        summary: `Appointment: ${patientName}`,
        description: `Type: ${appointment.appointment_type || 'General'}\nNotes: ${appointment.notes || ''}`,
        start: { dateTime: naiveDatetime, timeZone: orgTimezone },
        end: { dateTime: naiveEndDatetime, timeZone: orgTimezone },
        extendedProperties: {
          private: {
            appointmentId: String(appointment.id),
            patientId: String(appointment.patient_id),
            providerId: String(appointment.provider_id),
            organizationId: this.organizationId,
          }
        }
      });

      // Store Google Calendar event ID in local appointment
      if (event?.id) {
        const supabase = getSupabaseAdmin();
        await supabase
          .from('appointments')
          .update({ google_calendar_event_id: event.id })
          .eq('id', appointment.id)
          .eq('organization_id', this.organizationId);
      }
    } else if (operation === 'update' && appointment.google_calendar_event_id) {
      await calendarService.updateEvent(calendarId, appointment.google_calendar_event_id, {
        summary: `Appointment: ${patientName}`,
        description: `Type: ${appointment.appointment_type || 'General'}\nNotes: ${appointment.notes || ''}`,
        start: { dateTime: naiveDatetime, timeZone: orgTimezone },
        end: { dateTime: naiveEndDatetime, timeZone: orgTimezone },
      });
    } else if (operation === 'delete' && appointment.google_calendar_event_id) {
      await calendarService.deleteEvent(calendarId, appointment.google_calendar_event_id);
    }

    // Log successful sync
    const googleCalendarConfig = await this.getSyncConfig('google_calendar');
    if (googleCalendarConfig?.id) {
      const supabase = getSupabaseAdmin();
      await supabase
        .from('integration_sync_configs')
        .update({
          last_sync_status: 'success',
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', googleCalendarConfig.id);
    }
  }
}
