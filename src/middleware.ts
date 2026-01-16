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
  
  // If accessing root path, redirect to booking system
  if (request.nextUrl.pathname === '/') {
    return NextResponse.redirect(
      new URL('/admin/booking', request.url)
    );
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
  
  // Get session from request
  const authHeader = request.headers.get('Authorization');
  let session = null;
  
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data } = await supabase.auth.getUser(token);
    if (data.user) {
      session = { user: data.user };
    }
  }
  
  // Protected routes (require authentication)
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      // Redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    // Get organization context from cookie
    const orgId = request.cookies.get('currentOrgId')?.value;
    
    // If no org context, allow the request to continue
    // The OrganizationContext will handle loading orgs
    if (orgId) {
      // Set organization header for API routes
      res.headers.set('X-Organization-Id', orgId);
    }
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
