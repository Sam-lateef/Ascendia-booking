/**
 * Google Calendar OAuth App Status
 * GET: Returns whether the system-level OAuth app (client_id, client_secret) is configured.
 * Used by Integrations page to enable Connect button for non-system-org users who don't
 * receive system credentials from the API.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getGoogleCalendarCredentials } from '@/app/lib/credentialLoader';

export async function GET(request: NextRequest) {
  try {
    const context = await getCurrentOrganization(request);
    const creds = await getGoogleCalendarCredentials(context.organizationId);
    const configured = !!(creds.clientId && creds.clientSecret);

    return NextResponse.json({ configured, success: true });
  } catch {
    return NextResponse.json({ configured: false, success: true });
  }
}
