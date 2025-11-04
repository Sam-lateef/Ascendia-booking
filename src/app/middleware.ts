import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // If accessing root path and not already at /agent-ui, redirect to agent-ui
  if (request.nextUrl.pathname === '/') {
    // Only redirect if not already on agent-ui
    return NextResponse.redirect(
      new URL('/agent-ui?agentConfig=dental', request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/',
};



