/**
 * Resolve the public base URL for redirects and OAuth callbacks.
 * On Fly.io/production, request.nextUrl.origin can be 0.0.0.0 - unusable in browser.
 * Prefer explicit BASE_URL, then Host header from request.
 */

import { NextRequest } from 'next/server';

export function getPublicBaseUrl(request: NextRequest): string {
  const envUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (envUrl) return envUrl;

  const origin = request.nextUrl.origin;
  if (!origin.includes('0.0.0.0')) return origin;

  const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  if (host && !host.includes('0.0.0.0')) {
    return `${proto === 'https' ? 'https' : 'http'}://${host}`;
  }

  return 'http://localhost:3000';
}
