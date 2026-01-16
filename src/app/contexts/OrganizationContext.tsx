'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  plan?: string;
  logo_url?: string;
  primary_color?: string;
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

  const loadUserOrganizations = async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrganizationState(null);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/user/organizations', {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to load organizations');
      }
      
      const data = await response.json();
      const orgs = data.organizations || [];
      setOrganizations(orgs);
      
      // Set current organization from localStorage or use first one
      const savedOrgId = localStorage.getItem('currentOrgId');
      const currentOrg = orgs.find((o: Organization) => o.id === savedOrgId) || orgs[0];
      
      if (currentOrg) {
        setCurrentOrganizationState(currentOrg);
        localStorage.setItem('currentOrgId', currentOrg.id);
        
        // Set cookie for server-side middleware
        document.cookie = `currentOrgId=${currentOrg.id}; path=/; max-age=${60 * 60 * 24 * 30}`; // 30 days
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
      setOrganizations([]);
      setCurrentOrganizationState(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserOrganizations();
  }, [user]);

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
