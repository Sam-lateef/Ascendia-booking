'use client';

import { useEffect } from 'react';

/**
 * Suppresses harmless React DevTools console errors
 * This is a known issue with React 19 and React DevTools extension compatibility
 */
export function SuppressDevToolsError() {
  useEffect(() => {
    const originalError = console.error;
    
    console.error = (...args: any[]) => {
      const errorMessage = args[0]?.toString() || '';
      // Suppress React DevTools version validation errors (harmless)
      if (errorMessage.includes('react_devtools_backend_compact') || 
          errorMessage.includes('Invalid argument not valid semver')) {
        return; // Suppress this specific error
      }
      originalError.apply(console, args);
    };

    // Cleanup on unmount
    return () => {
      console.error = originalError;
    };
  }, []);

  return null; // This component doesn't render anything
}






