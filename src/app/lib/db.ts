/**
 * Database Client for Embedded Booking System
 * Uses Supabase client for PostgreSQL connection
 */

import { createClient } from '@supabase/supabase-js';

// Database types (matching our schema)
export interface Database {
  public: {
    Tables: {
      providers: {
        Row: {
          id: number;
          first_name: string;
          last_name: string;
          specialty_tags: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          first_name: string;
          last_name: string;
          specialty_tags?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          first_name?: string;
          last_name?: string;
          specialty_tags?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      operatories: {
        Row: {
          id: number;
          name: string;
          tags: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          tags?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          tags?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      provider_schedules: {
        Row: {
          id: number;
          provider_id: number;
          day_of_week: number;
          start_time: string;
          end_time: string;
          operatory_ids: number[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          provider_id: number;
          day_of_week: number;
          start_time: string;
          end_time: string;
          operatory_ids?: number[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          provider_id?: number;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          operatory_ids?: number[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      patients: {
        Row: {
          id: number;
          first_name: string;
          last_name: string;
          phone: string | null;
          email: string | null;
          date_of_birth: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          first_name: string;
          last_name: string;
          phone?: string | null;
          email?: string | null;
          date_of_birth?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          first_name?: string;
          last_name?: string;
          phone?: string | null;
          email?: string | null;
          date_of_birth?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      appointments: {
        Row: {
          id: number;
          patient_id: number;
          provider_id: number | null;
          operatory_id: number | null;
          appointment_datetime: string;
          duration_minutes: number;
          appointment_type: string | null;
          status: 'Scheduled' | 'Completed' | 'Cancelled' | 'No-Show' | 'Broken';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          patient_id: number;
          provider_id?: number | null;
          operatory_id?: number | null;
          appointment_datetime: string;
          duration_minutes?: number;
          appointment_type?: string | null;
          status?: 'Scheduled' | 'Completed' | 'Cancelled' | 'No-Show' | 'Broken';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          patient_id?: number;
          provider_id?: number | null;
          operatory_id?: number | null;
          appointment_datetime?: string;
          duration_minutes?: number;
          appointment_type?: string | null;
          status?: 'Scheduled' | 'Completed' | 'Cancelled' | 'No-Show' | 'Broken';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

// Create Supabase client singleton
let supabaseClient: ReturnType<typeof createClient<Database>> | null = null;

// Track if we've already warned about missing env vars
let warnedAboutMissingEnv = false;

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Only warn once to avoid spamming logs
    if (!warnedAboutMissingEnv) {
      console.warn('[DB] ⚠️  Supabase env vars not set - database features disabled');
      console.warn('[DB] Set SUPABASE_URL and SUPABASE_ANON_KEY to enable call logging');
      warnedAboutMissingEnv = true;
    }
    // Return a mock client that does nothing instead of crashing
    return createMockClient();
  }

  supabaseClient = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });

  return supabaseClient;
}

// Mock client that does nothing (prevents crashes when Supabase is not configured)
function createMockClient(): any {
  const mockResponse = { data: null, error: { message: 'Supabase not configured' } };
  const chainableMock: any = () => chainableMock;
  chainableMock.select = chainableMock;
  chainableMock.insert = chainableMock;
  chainableMock.update = chainableMock;
  chainableMock.delete = chainableMock;
  chainableMock.eq = chainableMock;
  chainableMock.gte = chainableMock;
  chainableMock.lte = chainableMock;
  chainableMock.order = chainableMock;
  chainableMock.limit = chainableMock;
  chainableMock.single = () => Promise.resolve(mockResponse);
  chainableMock.then = (resolve: any) => Promise.resolve(mockResponse).then(resolve);
  
  return {
    from: () => chainableMock,
  };
}

// Export typed client - lazy initialization (only created when accessed)
// This prevents errors when env vars aren't loaded yet (e.g., in standalone scripts)
let dbInstance: ReturnType<typeof getSupabaseClient> | null = null;

function getDbInstance(): ReturnType<typeof getSupabaseClient> {
  if (!dbInstance) {
    dbInstance = getSupabaseClient();
  }
  return dbInstance;
}

// Lazy proxy that forwards all property access and method calls to the actual client
export const db = new Proxy({} as ReturnType<typeof getSupabaseClient>, {
  get(_target, prop) {
    const instance = getDbInstance();
    const value = (instance as any)[prop];
    // Bind functions to maintain 'this' context
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

