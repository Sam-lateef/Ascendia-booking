'use client';

import { useEffect } from 'react';
import { installFetchInterceptor } from '../lib/fetchInterceptor';

/**
 * Component to initialize the fetch interceptor
 * Must be rendered once in the root layout
 */
export function FetchInterceptorInit() {
  useEffect(() => {
    installFetchInterceptor();
  }, []);
  
  return null;
}
