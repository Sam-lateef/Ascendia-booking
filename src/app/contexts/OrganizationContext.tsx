'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  plan?: string;
  logo_url?: string;
  primary_color?: string;
  is_system_org?: boolean;
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  setCurrentOrganization: (org: Organization) => void;
  loading: boolean;
  refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  const loadUserOrganizations = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (loadingRef.current) {
      console.log('[OrganizationContext] Already loading, skipping...');
      return;
    }
    
    if (!user) {
      console.log('[OrganizationContext] No user, clearing organizations');
      setOrganizations([]);
      setCurrentOrganizationState(null);
      setLoading(false);
      lastUserIdRef.current = null;
      return;
    }
    
    // Only load if user has changed
    if (lastUserIdRef.current === user.id) {
      console.log('[OrganizationContext] Same user, skipping load');
      setLoading(false);
      return;
    }
    
    loadingRef.current = true;
    lastUserIdRef.current = user.id;

    try {
      // Get session token for API authentication
      const { getSupabaseClient } = await import('@/app/lib/supabaseClient');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('[OrganizationContext] Session check:', {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        user: user?.email,
      });
      
      if (!session || !session.access_token) {
        console.log('[OrganizationContext] No active session, will retry');
        // Don't throw error, just return - the auth listener will trigger a retry
        setLoading(false);
        return;
      }

      console.log('[OrganizationContext] Calling API with token length:', session.access_token.length);
      
      let response;
      try {
        response = await fetch('/api/user/organizations', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
      } catch (fetchError: any) {
        console.error('[OrganizationContext] Network error during fetch:', fetchError);
        // Network error - just return silently, will retry on next auth state change
        setLoading(false);
        return;
      }
      
      console.log('[OrganizationContext] API response status:', response.status);
      
      if (!response.ok) {
        let errorData: any = {};
        let errorText = '';
        
        try {
          errorText = await response.text();
          if (errorText) {
            errorData = JSON.parse(errorText);
          }
        } catch (e) {
          console.error('[OrganizationContext] Failed to parse error response:', e);
          console.error('[OrganizationContext] Raw error text:', errorText);
        }
        
        console.error('[OrganizationContext] API error details:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          rawText: errorText.substring(0, 200) // First 200 chars
        });
        
        // If token is invalid, sign out
        if (response.status === 401) {
          console.log('[OrganizationContext] Unauthorized - signing out');
          await supabase.auth.signOut();
          window.location.href = '/login';
          return;
        }
        
        // Don't throw error, just set loading to false
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      const orgs = data.organizations || [];
      console.log('[OrganizationContext] Loaded organizations:', orgs.length);
      setOrganizations(orgs);
      
      // Set current organization from localStorage or use first one
      const savedOrgId = localStorage.getItem('currentOrgId');
      const currentOrg = orgs.find((o: Organization) => o.id === savedOrgId) || orgs[0];
      
      if (currentOrg) {
        console.log('[OrganizationContext] Setting current org:', currentOrg.name);
        setCurrentOrganizationState(currentOrg);
        localStorage.setItem('currentOrgId', currentOrg.id);
        
        // Set cookie for server-side middleware
        document.cookie = `currentOrgId=${currentOrg.id}; path=/; max-age=${60 * 60 * 24 * 30}`; // 30 days
      }
    } catch (error) {
      console.error('[OrganizationContext] Failed to load organizations:', error);
      setOrganizations([]);
      setCurrentOrganizationState(null);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    loadUserOrganizations();
  }, [loadUserOrganizations]);

  const handleSetCurrentOrganization = (org: Organization) => {
    setCurrentOrganizationState(org);
    localStorage.setItem('currentOrgId', org.id);
    
    // Set cookie for server-side middleware
    document.cookie = `currentOrgId=${org.id}; path=/; max-age=${60 * 60 * 24 * 30}`; // 30 days
    
    // Reload the page to apply new organization context
    window.location.reload();
  };

  return (
    <OrganizationContext.Provider value={{
      currentOrganization,
      organizations,
      setCurrentOrganization: handleSetCurrentOrganization,
      loading,
      refetch: loadUserOrganizations,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
}
