/**
 * Google Calendar Integration API
 * 
 * Provides REST endpoints for Google Calendar operations:
 * - GET: List events or check availability
 * - POST: Create event or sync appointments
 * - PUT: Update event
 * - DELETE: Delete event
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { GoogleCalendarService, clearGoogleTokenCache } from '@/app/lib/integrations/GoogleCalendarService';

/**
 * GET /api/integrations/google-calendar
 * 
 * Query params:
 * - action: 'events' | 'calendars' | 'availability' | 'freeBusy'
 * - calendarId: Calendar ID (default: 'primary')
 * - timeMin: ISO date string
 * - timeMax: ISO date string
 * - maxResults: Number
 */
export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await getCurrentOrganization(request);
    const { searchParams } = new URL(request.url);
    
    const action = searchParams.get('action') || 'events';
    const calendarId = searchParams.get('calendarId') || 'primary';
    
    const service = new GoogleCalendarService(organizationId);

    switch (action) {
      case 'calendars': {
        const calendars = await service.listCalendars();
        return NextResponse.json({ success: true, calendars });
      }

      case 'calendar': {
        const calendar = await service.getCalendar(calendarId);
        return NextResponse.json({ success: true, calendar });
      }

      case 'events': {
        const events = await service.listEvents(calendarId, {
          timeMin: searchParams.get('timeMin') || undefined,
          timeMax: searchParams.get('timeMax') || undefined,
          maxResults: searchParams.get('maxResults') ? parseInt(searchParams.get('maxResults')!) : 50,
          singleEvents: true,
          orderBy: 'startTime',
          q: searchParams.get('q') || undefined,
        });
        return NextResponse.json({ success: true, events });
      }

      case 'event': {
        const eventId = searchParams.get('eventId');
        if (!eventId) {
          return NextResponse.json(
            { success: false, error: 'eventId is required' },
            { status: 400 }
          );
        }
        const event = await service.getEvent(calendarId, eventId);
        return NextResponse.json({ success: true, event });
      }

      case 'availability': {
        const timeMin = searchParams.get('timeMin');
        const timeMax = searchParams.get('timeMax');
        const duration = parseInt(searchParams.get('duration') || '30');
        
        if (!timeMin || !timeMax) {
          return NextResponse.json(
            { success: false, error: 'timeMin and timeMax are required' },
            { status: 400 }
          );
        }

        const slots = await service.getAvailableSlots(
          calendarId,
          timeMin,
          timeMax,
          duration
        );
        return NextResponse.json({ success: true, slots });
      }

      case 'freeBusy': {
        const timeMin = searchParams.get('timeMin');
        const timeMax = searchParams.get('timeMax');
        
        if (!timeMin || !timeMax) {
          return NextResponse.json(
            { success: false, error: 'timeMin and timeMax are required' },
            { status: 400 }
          );
        }

        const freeBusy = await service.getFreeBusy({
          timeMin,
          timeMax,
          items: [{ id: calendarId }],
        });
        return NextResponse.json({ success: true, freeBusy });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[GoogleCalendar API] GET error:', error);
    
    // Check if it's a credential error
    if (error.message?.includes('credentials not configured')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Google Calendar not configured. Please add credentials in Settings > Credentials.',
          code: 'CREDENTIALS_MISSING'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch data' },
      { status: error.status || 500 }
    );
  }
}

/**
 * POST /api/integrations/google-calendar
 * 
 * Body:
 * - action: 'create' | 'sync' | 'clearCache'
 * - calendarId: Calendar ID (default: 'primary')
 * - event: Event data (for create)
 * - appointments: Array of appointments (for sync)
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await getCurrentOrganization(request);
    const body = await request.json();
    
    const { action = 'create', calendarId = 'primary', event, appointments } = body;
    
    const service = new GoogleCalendarService(organizationId);

    switch (action) {
      case 'create': {
        if (!event) {
          return NextResponse.json(
            { success: false, error: 'event data is required' },
            { status: 400 }
          );
        }

        // Validate required fields
        if (!event.summary || !event.start || !event.end) {
          return NextResponse.json(
            { success: false, error: 'Event must have summary, start, and end' },
            { status: 400 }
          );
        }

        const createdEvent = await service.createEvent(calendarId, event);
        return NextResponse.json({ success: true, event: createdEvent });
      }

      case 'syncAppointment': {
        // Convert appointment to calendar event and create
        const { appointment, timezone = 'America/New_York' } = body;
        
        if (!appointment) {
          return NextResponse.json(
            { success: false, error: 'appointment data is required' },
            { status: 400 }
          );
        }

        const calendarEvent = GoogleCalendarService.appointmentToEvent(appointment, timezone);
        const created = await service.createEvent(calendarId, calendarEvent);
        
        return NextResponse.json({ 
          success: true, 
          event: created,
          externalId: created.id 
        });
      }

      case 'syncBatch': {
        // Sync multiple appointments to Google Calendar
        if (!appointments || !Array.isArray(appointments)) {
          return NextResponse.json(
            { success: false, error: 'appointments array is required' },
            { status: 400 }
          );
        }

        const results = [];
        const errors = [];

        for (const apt of appointments) {
          try {
            const calendarEvent = GoogleCalendarService.appointmentToEvent(apt, body.timezone);
            const created = await service.createEvent(calendarId, calendarEvent);
            results.push({ appointmentId: apt.id, eventId: created.id, success: true });
          } catch (error: any) {
            errors.push({ appointmentId: apt.id, error: error.message });
          }
        }

        return NextResponse.json({ 
          success: true, 
          synced: results.length,
          failed: errors.length,
          results,
          errors: errors.length > 0 ? errors : undefined
        });
      }

      case 'clearCache': {
        clearGoogleTokenCache(organizationId);
        return NextResponse.json({ success: true, message: 'Cache cleared' });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[GoogleCalendar API] POST error:', error);
    
    if (error.message?.includes('credentials not configured')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Google Calendar not configured',
          code: 'CREDENTIALS_MISSING'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create event' },
      { status: error.status || 500 }
    );
  }
}

/**
 * PUT /api/integrations/google-calendar
 * 
 * Body:
 * - calendarId: Calendar ID (default: 'primary')
 * - eventId: Event ID to update
 * - event: Updated event data
 */
export async function PUT(request: NextRequest) {
  try {
    const { organizationId } = await getCurrentOrganization(request);
    const body = await request.json();
    
    const { calendarId = 'primary', eventId, event, patch = false } = body;
    
    if (!eventId || !event) {
      return NextResponse.json(
        { success: false, error: 'eventId and event data are required' },
        { status: 400 }
      );
    }

    const service = new GoogleCalendarService(organizationId);
    
    const updatedEvent = patch 
      ? await service.patchEvent(calendarId, eventId, event)
      : await service.updateEvent(calendarId, eventId, event);
    
    return NextResponse.json({ success: true, event: updatedEvent });
  } catch (error: any) {
    console.error('[GoogleCalendar API] PUT error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update event' },
      { status: error.status || 500 }
    );
  }
}

/**
 * DELETE /api/integrations/google-calendar
 * 
 * Query params:
 * - calendarId: Calendar ID (default: 'primary')
 * - eventId: Event ID to delete
 */
export async function DELETE(request: NextRequest) {
  try {
    const { organizationId } = await getCurrentOrganization(request);
    const { searchParams } = new URL(request.url);
    
    const calendarId = searchParams.get('calendarId') || 'primary';
    const eventId = searchParams.get('eventId');
    
    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'eventId is required' },
        { status: 400 }
      );
    }

    const service = new GoogleCalendarService(organizationId);
    await service.deleteEvent(calendarId, eventId);
    
    return NextResponse.json({ success: true, message: 'Event deleted' });
  } catch (error: any) {
    console.error('[GoogleCalendar API] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete event' },
      { status: error.status || 500 }
    );
  }
}
