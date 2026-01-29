/**
 * Global Fetch Interceptor
 * Automatically adds authentication token to all /api requests
 * This allows existing code to work without modification
 */

import { getSupabaseClient } from './supabaseClient';

let interceptorInstalled = false;

/**
 * Check if a URL is an API request that needs auth
 * Handles both relative URLs (/api/...) and absolute URLs (http://localhost:3000/api/...)
 */
function isApiRequest(url: string): boolean {
  // Relative URL starting with /api/
  if (url.startsWith('/api/')) {
    return true;
  }
  
  // Absolute URL to same origin with /api/ path
  try {
    const parsedUrl = new URL(url, window.location.origin);
    const currentOrigin = window.location.origin;
    
    // Check if same origin (or localhost variants)
    const isSameOrigin = parsedUrl.origin === currentOrigin;
    const isLocalhost = parsedUrl.hostname === 'localhost' && 
                        window.location.hostname === 'localhost';
    
    if ((isSameOrigin || isLocalhost) && parsedUrl.pathname.startsWith('/api/')) {
      return true;
    }
  } catch {
    // Invalid URL, not an API request
  }
  
  return false;
}

export function installFetchInterceptor() {
  if (interceptorInstalled || typeof window === 'undefined') {
    return;
  }
  
  const originalFetch = window.fetch;
  
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    
    // Check if this is an API request that needs auth
    if (isApiRequest(url)) {
      // Get current session token
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.access_token) {
        // Add Authorization header if not already present
        const headers = new Headers(init?.headers || {});
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${session.access_token}`);
        }
        
        // Call original fetch with modified headers
        return originalFetch(input, {
          ...init,
          headers,
        });
      }
    }
    
    // Call original fetch for non-API requests or if no session
    return originalFetch(input, init);
  };
  
  interceptorInstalled = true;
  console.log('[FetchInterceptor] Installed - all /api requests will include auth token');
}
