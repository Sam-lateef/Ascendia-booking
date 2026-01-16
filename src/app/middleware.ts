import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // If accessing root path, redirect to booking system login
  if (request.nextUrl.pathname === '/') {
    return NextResponse.redirect(
      new URL('/admin/booking', request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/',
};



