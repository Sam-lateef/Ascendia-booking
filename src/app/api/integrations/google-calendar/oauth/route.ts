/**
 * Google Calendar OAuth - Initiate
 * GET: Redirects user to Google consent screen
 * Requires: Client ID and Client Secret already in api_credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getGoogleCalendarCredentials } from '@/app/lib/credentialLoader';
import { getPublicBaseUrl } from '@/app/lib/getPublicBaseUrl';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

/**
 * Build the Google OAuth consent URL for a given org.
 * Shared by GET (browser redirect) and POST (fetch-then-redirect).
 */
async function buildGoogleAuthUrl(request: NextRequest): Promise<{ authUrl: string; error?: never } | { authUrl?: never; error: string; status: number }> {
  const context = await getCurrentOrganization(request);

  if (!['owner', 'admin'].includes(context.role)) {
    return { error: 'Only owners and admins can connect Google Calendar', status: 403 };
  }

  const credentials = await getGoogleCalendarCredentials(context.organizationId);
  if (!credentials.clientId || !credentials.clientSecret) {
    return { error: 'Configure Google Calendar (OAuth App) in System Settings first', status: 400 };
  }

  const baseUrl = getPublicBaseUrl(request);
  const redirectUri = `${baseUrl}/api/integrations/google-calendar/oauth/callback`;

  const state = Buffer.from(
    JSON.stringify({
      organizationId: context.organizationId,
      nonce: crypto.randomUUID(),
    })
  ).toString('base64url');

  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return { authUrl: `${GOOGLE_AUTH_URL}?${params.toString()}` };
}

/**
 * GET - Browser redirect flow (works when auth cookie is available)
 */
export async function GET(request: NextRequest) {
  try {
    const result = await buildGoogleAuthUrl(request);
    if (result.error) {
      return NextResponse.json({ error: result.error, success: false }, { status: result.status });
    }
    return NextResponse.redirect(result.authUrl);
  } catch (error: any) {
    console.error('[Google OAuth] GET error:', error);
    if (error.message?.includes('Unauthorized')) {
      const baseUrl = getPublicBaseUrl(request);
      const loginUrl = new URL('/login', baseUrl);
      loginUrl.searchParams.set('redirect', `${baseUrl}/api/integrations/google-calendar/oauth`);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.json({ error: error.message || 'Failed to initiate OAuth', success: false }, { status: 500 });
  }
}

/**
 * POST - Returns the Google auth URL as JSON so the client can redirect via fetch().
 * This works with the FetchInterceptor which adds the Bearer token automatically.
 */
export async function POST(request: NextRequest) {
  try {
    const result = await buildGoogleAuthUrl(request);
    if (result.error) {
      return NextResponse.json({ error: result.error, success: false }, { status: result.status });
    }
    return NextResponse.json({ authUrl: result.authUrl, success: true });
  } catch (error: any) {
    console.error('[Google OAuth] POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to initiate OAuth', success: false }, { status: 500 });
  }
}
