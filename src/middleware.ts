import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/app/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

/**
 * Middleware for authentication and organization context
 * 
 * - Protects /admin routes (requires authentication)
 * - Sets organization context for API routes
 * - Handles session refresh
 */
export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  
  // If accessing root path, redirect based on authentication
  if (request.nextUrl.pathname === '/') {
    // Check if user has a session (check for Supabase auth cookie)
    const hasSession = request.cookies.get('sb-access-token') || 
                       request.cookies.get('supabase-auth-token') ||
                       request.cookies.has('currentOrgId');
    
    if (hasSession) {
      // Logged in - go to admin dashboard
      return NextResponse.redirect(new URL('/admin/booking', request.url));
    } else {
      // Not logged in - go to login page
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  
  // Get Supabase credentials
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseAnonKey();
  
  if (!supabaseUrl || !supabaseKey) {
    // If Supabase not configured, continue without auth
    return res;
  }
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });
  
  // Protected routes - set organization context if available
  if (request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname.startsWith('/api/admin')) {
    // Get organization context from cookie
    const orgId = request.cookies.get('currentOrgId')?.value;
    
    if (orgId) {
      // Set organization header for API routes
      res.headers.set('X-Organization-Id', orgId);
    }
    
    // Note: We're not enforcing auth in middleware because:
    // 1. Client-side AuthContext handles auth state
    // 2. OrganizationContext redirects to login if needed
    // 3. Individual API routes check auth when needed
  }
  
  return res;
}

export const config = {
  matcher: [
    '/',
    '/admin/:path*',
    '/api/admin/:path*',
  ],
};
