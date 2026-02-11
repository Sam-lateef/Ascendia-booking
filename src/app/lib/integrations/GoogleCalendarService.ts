/**
 * Google Calendar Service
 * 
 * Handles Google Calendar API calls with OAuth2 token refresh.
 * Supports bidirectional sync between local appointments and Google Calendar events.
 */

import { getGoogleCalendarCredentials } from '../credentialLoader';

interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  status?: 'confirmed' | 'tentative' | 'cancelled';
  colorId?: string;
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
}

interface FreeBusyRequest {
  timeMin: string;
  timeMax: string;
  timeZone?: string;
  items: Array<{ id: string }>;
}

interface FreeBusyResponse {
  kind: string;
  timeMin: string;
  timeMax: string;
  calendars: Record<string, {
    busy: Array<{ start: string; end: string }>;
    errors?: Array<{ domain: string; reason: string }>;
  }>;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  refresh_token?: string;
}

// Token cache to avoid refreshing on every request
const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

export class GoogleCalendarService {
  private organizationId: string;
  private baseUrl = 'https://www.googleapis.com/calendar/v3';
  private oauthUrl = 'https://oauth2.googleapis.com/token';

  constructor(organizationId: string) {
    this.organizationId = organizationId;
  }

  /**
   * Get a valid access token (refresh if needed)
   */
  private async getAccessToken(): Promise<string> {
    // Check cache first
    const cached = tokenCache.get(this.organizationId);
    if (cached && cached.expiresAt > Date.now() + 60000) {
      // Token is still valid (with 1 minute buffer)
      return cached.accessToken;
    }

    // Load credentials and refresh token
    const credentials = await getGoogleCalendarCredentials(this.organizationId);
    
    if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
      throw new Error('Google Calendar credentials not configured');
    }

    // Refresh the access token
    const response = await fetch(this.oauthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh Google token: ${error}`);
    }

    const tokenData: TokenResponse = await response.json();

    // Cache the new token
    tokenCache.set(this.organizationId, {
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
    });

    console.log(`[GoogleCalendar] Token refreshed for org ${this.organizationId}`);
    return tokenData.access_token;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
    body?: any
  ): Promise<T> {
    const accessToken = await this.getAccessToken();
    
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    console.log(`[GoogleCalendar] ${method} ${url}`);
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = errorText;
      }
      throw {
        status: response.status,
        message: `Google Calendar API error: ${response.status}`,
        details: errorData,
      };
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /**
   * List calendars
   */
  async listCalendars(): Promise<any[]> {
    const result = await this.request<{ items: any[] }>('/users/me/calendarList');
    return result.items || [];
  }

  /**
   * Get calendar details
   */
  async getCalendar(calendarId: string = 'primary'): Promise<any> {
    return this.request(`/calendars/${encodeURIComponent(calendarId)}`);
  }

  /**
   * List events in a calendar
   * @param options.pageToken - For pagination, pass the token from previous response
   * @returns events array; if more pages exist, (result as any).nextPageToken is set
   */
  async listEvents(
    calendarId: string = 'primary',
    options: {
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      singleEvents?: boolean;
      orderBy?: 'startTime' | 'updated';
      q?: string;
      pageToken?: string;
    } = {}
  ): Promise<GoogleCalendarEvent[] & { nextPageToken?: string }> {
    const params = new URLSearchParams();
    
    if (options.timeMin) params.set('timeMin', options.timeMin);
    if (options.timeMax) params.set('timeMax', options.timeMax);
    if (options.maxResults) params.set('maxResults', String(options.maxResults));
    if (options.singleEvents !== undefined) params.set('singleEvents', String(options.singleEvents));
    if (options.orderBy) params.set('orderBy', options.orderBy);
    if (options.q) params.set('q', options.q);
    if (options.pageToken) params.set('pageToken', options.pageToken);

    const queryString = params.toString();
    const endpoint = `/calendars/${encodeURIComponent(calendarId)}/events${queryString ? '?' + queryString : ''}`;
    
    const result = await this.request<{ items: GoogleCalendarEvent[]; nextPageToken?: string }>(endpoint);
    const items = result.items || [];
    (items as any).nextPageToken = result.nextPageToken;
    return items as GoogleCalendarEvent[] & { nextPageToken?: string };
  }

  /**
   * Get a specific event
   */
  async getEvent(calendarId: string = 'primary', eventId: string): Promise<GoogleCalendarEvent> {
    return this.request(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
  }

  /**
   * Create an event
   */
  async createEvent(
    calendarId: string = 'primary',
    event: GoogleCalendarEvent
  ): Promise<GoogleCalendarEvent> {
    return this.request(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      'POST',
      event
    );
  }

  /**
   * Update an event
   */
  async updateEvent(
    calendarId: string = 'primary',
    eventId: string,
    event: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent> {
    return this.request(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      'PUT',
      event
    );
  }

  /**
   * Patch an event (partial update)
   */
  async patchEvent(
    calendarId: string = 'primary',
    eventId: string,
    event: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent> {
    return this.request(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      'PATCH',
      event
    );
  }

  /**
   * Delete an event
   */
  async deleteEvent(calendarId: string = 'primary', eventId: string): Promise<void> {
    await this.request(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      'DELETE'
    );
  }

  /**
   * Check free/busy availability
   */
  async getFreeBusy(request: FreeBusyRequest): Promise<FreeBusyResponse> {
    return this.request('/freeBusy', 'POST', request);
  }

  /**
   * Get available slots for a date range
   */
  async getAvailableSlots(
    calendarId: string = 'primary',
    startDate: string,
    endDate: string,
    slotDurationMinutes: number = 30,
    workingHoursStart: number = 9,
    workingHoursEnd: number = 17
  ): Promise<Array<{ start: string; end: string }>> {
    // Get busy times
    const freeBusy = await this.getFreeBusy({
      timeMin: startDate,
      timeMax: endDate,
      items: [{ id: calendarId }],
    });

    const busyTimes = freeBusy.calendars[calendarId]?.busy || [];

    // Generate all possible slots
    const slots: Array<{ start: string; end: string }> = [];
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    // For each day in the range
    const currentDay = new Date(startDateTime);
    currentDay.setHours(0, 0, 0, 0);

    while (currentDay < endDateTime) {
      // Skip weekends (optional - could be configurable)
      const dayOfWeek = currentDay.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Generate slots for working hours
        const dayStart = new Date(currentDay);
        dayStart.setHours(workingHoursStart, 0, 0, 0);

        const dayEnd = new Date(currentDay);
        dayEnd.setHours(workingHoursEnd, 0, 0, 0);

        let slotStart = new Date(dayStart);
        
        while (slotStart < dayEnd) {
          const slotEnd = new Date(slotStart.getTime() + slotDurationMinutes * 60000);
          
          if (slotEnd <= dayEnd) {
            // Check if this slot overlaps with any busy time
            const isAvailable = !busyTimes.some(busy => {
              const busyStart = new Date(busy.start);
              const busyEnd = new Date(busy.end);
              return slotStart < busyEnd && slotEnd > busyStart;
            });

            if (isAvailable) {
              slots.push({
                start: slotStart.toISOString(),
                end: slotEnd.toISOString(),
              });
            }
          }

          slotStart = new Date(slotStart.getTime() + slotDurationMinutes * 60000);
        }
      }

      currentDay.setDate(currentDay.getDate() + 1);
    }

    return slots;
  }

  /**
   * Convert local appointment to Google Calendar event
   */
  static appointmentToEvent(appointment: {
    id: string;
    patient_name?: string;
    provider_name?: string;
    appointment_date: string;
    duration_minutes?: number;
    notes?: string;
    status?: string;
  }, timezone: string = 'America/New_York'): GoogleCalendarEvent {
    const startTime = new Date(appointment.appointment_date);
    const endTime = new Date(startTime.getTime() + (appointment.duration_minutes || 30) * 60000);

    return {
      summary: appointment.patient_name 
        ? `Appointment: ${appointment.patient_name}` 
        : 'Appointment',
      description: [
        appointment.provider_name && `Provider: ${appointment.provider_name}`,
        appointment.notes,
      ].filter(Boolean).join('\n'),
      start: {
        dateTime: startTime.toISOString(),
        timeZone: timezone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: timezone,
      },
      extendedProperties: {
        private: {
          localAppointmentId: appointment.id,
          source: 'agent0',
        },
      },
      status: appointment.status === 'cancelled' ? 'cancelled' : 'confirmed',
    };
  }

  /**
   * Convert Google Calendar event to local appointment format
   */
  static eventToAppointment(event: GoogleCalendarEvent): {
    external_id: string;
    title: string;
    start_time: string;
    end_time: string;
    description?: string;
    location?: string;
    status: string;
  } {
    return {
      external_id: event.id || '',
      title: event.summary || 'Untitled Event',
      start_time: event.start.dateTime || event.start.date || '',
      end_time: event.end.dateTime || event.end.date || '',
      description: event.description,
      location: event.location,
      status: event.status || 'confirmed',
    };
  }
}

/**
 * Clear token cache for an organization
 */
export function clearGoogleTokenCache(organizationId?: string): void {
  if (organizationId) {
    tokenCache.delete(organizationId);
  } else {
    tokenCache.clear();
  }
}
