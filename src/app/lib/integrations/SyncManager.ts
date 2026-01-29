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
   * Sync appointment to Google Calendar
   */
  private async syncToGoogleCalendar(
    appointment: any, 
    operation: 'create' | 'update' | 'delete'
  ): Promise<void> {
    // Get Google Calendar credentials
    const { getGoogleCalendarCredentials } = await import('../credentialLoader');
    const credentials = await getGoogleCalendarCredentials(this.organizationId);

    if (!credentials || !credentials.client_id || !credentials.client_secret || !credentials.refresh_token) {
      console.log('[SyncManager] Google Calendar credentials not configured, skipping sync');
      return;
    }

    // Initialize Google Calendar service
    const calendarService = new GoogleCalendarService({
      clientId: credentials.client_id,
      clientSecret: credentials.client_secret,
      refreshToken: credentials.refresh_token,
    });

    const calendarId = credentials.calendar_id || 'primary';

    // Fetch patient name for event title
    let patientName = 'Appointment';
    if (appointment.patient_id) {
      const supabase = getSupabaseAdmin();
      const { data: patient } = await supabase
        .from('patients')
        .select('first_name, last_name')
        .eq('id', appointment.patient_id)
        .single();
      
      if (patient) {
        patientName = `${patient.first_name} ${patient.last_name}`;
      }
    }

    // Format datetime
    const startTime = new Date(appointment.appointment_datetime);
    const endTime = new Date(startTime.getTime() + (appointment.duration_minutes || 30) * 60000);

    if (operation === 'create') {
      const event = await calendarService.createEvent(calendarId, {
        summary: `Appointment: ${patientName}`,
        description: `Type: ${appointment.appointment_type || 'General'}\nNotes: ${appointment.notes || ''}`,
        start: { dateTime: startTime.toISOString() },
        end: { dateTime: endTime.toISOString() },
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
        start: { dateTime: startTime.toISOString() },
        end: { dateTime: endTime.toISOString() },
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
