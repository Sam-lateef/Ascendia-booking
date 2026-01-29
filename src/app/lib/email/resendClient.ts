/**
 * Resend Email Client
 * Singleton instance for sending emails via Resend API
 */

import { Resend } from 'resend';

let resendClient: Resend | null = null;

/**
 * Get or create Resend client instance
 */
export function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    
    resendClient = new Resend(apiKey);
    console.log('[Resend] Client initialized');
  }
  
  return resendClient;
}

/**
 * Get default FROM email address
 */
export function getDefaultFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
}

/**
 * Get app base URL
 */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}
