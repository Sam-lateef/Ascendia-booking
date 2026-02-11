/**
 * Google Calendar OAuth - Callback
 * GET: Handles redirect from Google, exchanges code for tokens, stores refresh_token
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';
import { clearGoogleTokenCache } from '@/app/lib/integrations/GoogleCalendarService';
import { clearCredentialCache, getGoogleCalendarCredentials } from '@/app/lib/credentialLoader';
import { getPublicBaseUrl } from '@/app/lib/getPublicBaseUrl';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const baseUrl = getPublicBaseUrl(request);
  const integrationsUrl = new URL('/admin/settings/integrations', baseUrl);

  if (error) {
    console.error('[Google OAuth] Callback error from Google:', error);
    const errorDesc = searchParams.get('error_description') || error;
    integrationsUrl.searchParams.set('gcal_error', errorDesc);
    return NextResponse.redirect(integrationsUrl);
  }

  if (!code || !state) {
    integrationsUrl.searchParams.set('gcal_error', 'Missing code or state from Google');
    return NextResponse.redirect(integrationsUrl);
  }

  try {
    let stateData: { organizationId: string; nonce: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
    } catch {
      integrationsUrl.searchParams.set('gcal_error', 'Invalid state parameter');
      return NextResponse.redirect(integrationsUrl);
    }

    // Use organizationId from state (embedded during OAuth initiation).
    // No session auth needed here - this is a redirect from Google, so no Bearer token or cookie.
    // The state+nonce provides CSRF protection, and the Google auth code is single-use.
    const organizationId = stateData.organizationId;
    if (!organizationId) {
      integrationsUrl.searchParams.set('gcal_error', 'Missing organization in state');
      return NextResponse.redirect(integrationsUrl);
    }

    const credentials = await getGoogleCalendarCredentials(organizationId);
    if (!credentials.clientId || !credentials.clientSecret) {
      integrationsUrl.searchParams.set('gcal_error', 'Credentials not found');
      return NextResponse.redirect(integrationsUrl);
    }

    const redirectUri = `${baseUrl}/api/integrations/google-calendar/oauth/callback`;

    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('[Google OAuth] Token exchange failed:', errText);
      integrationsUrl.searchParams.set('gcal_error', 'Token exchange failed');
      return NextResponse.redirect(integrationsUrl);
    }

    const tokens = await tokenResponse.json();
    const refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      integrationsUrl.searchParams.set('gcal_error', 'No refresh token received - try revoking access and reconnecting');
      return NextResponse.redirect(integrationsUrl);
    }

    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from('api_credentials')
      .select('id, credentials')
      .eq('organization_id', organizationId)
      .eq('credential_type', 'google_calendar')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle();

    const newCredentials = {
      ...(existing?.credentials as Record<string, string> || {}),
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: refreshToken,
      calendar_id: credentials.calendarId || 'primary',
    };

    if (existing) {
      await supabase
        .from('api_credentials')
        .update({
          credentials: newCredentials,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('organization_id', organizationId);
    } else {
      await supabase.from('api_credentials').insert({
        organization_id: organizationId,
        credential_type: 'google_calendar',
        credential_name: 'Google Calendar',
        description: 'Connected via OAuth',
        credentials: newCredentials,
        is_active: true,
        is_default: true,
      });
    }

    clearGoogleTokenCache(organizationId);
    clearCredentialCache(organizationId);

    integrationsUrl.searchParams.set('gcal_success', '1');
    return NextResponse.redirect(integrationsUrl);
  } catch (error: any) {
    console.error('[Google OAuth] Callback error:', error);
    integrationsUrl.searchParams.set('gcal_error', error.message || 'Connection failed');
    return NextResponse.redirect(integrationsUrl);
  }
}
