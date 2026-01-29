/**
 * API Client Helper
 * Automatically includes authentication token in all API requests
 */

import { getSupabaseClient } from './supabaseClient';

export interface ApiRequest {
  functionName: string;
  parameters?: Record<string, any>;
}

/**
 * Make an authenticated API request
 */
export async function apiRequest(endpoint: string, body: ApiRequest): Promise<Response> {
  // Get current session token
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('No active session. Please log in.');
  }
  
  // Make request with auth token
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Make an authenticated booking API request
 */
export async function bookingRequest(functionName: string, parameters?: Record<string, any>): Promise<any> {
  const response = await apiRequest('/api/booking', {
    functionName,
    parameters: parameters || {},
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || `Request failed with status ${response.status}`);
  }
  
  return response.json();
}
