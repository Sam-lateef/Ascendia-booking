import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // If accessing root path, redirect to landing page
  if (request.nextUrl.pathname === '/') {
    return NextResponse.redirect(
      new URL('/landing', request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/',
};



