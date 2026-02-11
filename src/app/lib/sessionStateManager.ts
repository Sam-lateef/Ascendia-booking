/**
 * Generic Session State Manager
 * 
 * Maintains persistent state across conversation turns for booking operations.
 * Works with any channel (Retell, Twilio, Web Chat, etc.)
 * 
 * Key Features:
 * - Stores patient info, appointment details, selected slots
 * - Automatic expiration after inactivity
 * - Thread-safe operations
 * - Generic enough for any booking workflow
 */

// ============================================
// SESSION STATE INTERFACE
// ============================================

export interface BookingSessionState {
  // Session metadata
  sessionId: string;
  organizationId?: string;
  callId?: string;
  createdAt: number;
  lastAccessedAt: number;
  
  // Patient information
  patient?: {
    patNum?: number;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    birthdate?: string;
  };
  
  // Appointment information
  appointment?: {
    aptNum?: number;
    appointmentType?: string;
    reason?: string;
    notes?: string;
  };
  
  // Slot selection
  slots?: {
    available?: Array<{
      AptDateTime: string;
      ProvNum: number;
      Op: number;
      providerName?: string;
    }>;
    selected?: {
      AptDateTime: string;
      ProvNum: number;
      Op: number;
      providerName?: string;
    };
  };
  
  // Workflow tracking
  workflow?: {
    patientLookedUp?: boolean;
    slotsQueried?: boolean;
    slotSelected?: boolean;
    appointmentCreated?: boolean;
    currentStep?: string; // e.g., 'greeting', 'patient_lookup', 'slot_selection', 'confirmation'
  };
  
  // Custom data (for extensibility)
  customData?: Record<string, any>;
}

// ============================================
// SESSION STORE
// ============================================

class SessionStateStore {
  private sessions: Map<string, BookingSessionState> = new Map();
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  
  constructor() {
    // Auto-cleanup expired sessions
    setInterval(() => this.cleanupExpiredSessions(), this.CLEANUP_INTERVAL_MS);
  }
  
  /**
   * Get or create session state
   */
  getOrCreate(sessionId: string, organizationId?: string, callId?: string): BookingSessionState {
    const now = Date.now();
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      // Create new session
      session = {
        sessionId,
        organizationId,
        callId,
        createdAt: now,
        lastAccessedAt: now,
        patient: {},
        appointment: {},
        slots: {},
        workflow: {},
        customData: {},
      };
      this.sessions.set(sessionId, session);
      console.log(`[Session Manager] ✅ Created new session: ${sessionId}`);
    } else {
      // Update last accessed time
      session.lastAccessedAt = now;
    }
    
    return session;
  }
  
  /**
   * Get existing session (returns undefined if not found)
   */
  get(sessionId: string): BookingSessionState | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessedAt = Date.now();
    }
    return session;
  }
  
  /**
   * Update session state (partial update)
   */
  update(sessionId: string, updates: Partial<BookingSessionState>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Deep merge
      if (updates.patient) {
        session.patient = { ...session.patient, ...updates.patient };
      }
      if (updates.appointment) {
        session.appointment = { ...session.appointment, ...updates.appointment };
      }
      if (updates.slots) {
        session.slots = { ...session.slots, ...updates.slots };
      }
      if (updates.workflow) {
        session.workflow = { ...session.workflow, ...updates.workflow };
      }
      if (updates.customData) {
        session.customData = { ...session.customData, ...updates.customData };
      }
      
      session.lastAccessedAt = Date.now();
      console.log(`[Session Manager] 📝 Updated session: ${sessionId}`);
    } else {
      console.warn(`[Session Manager] ⚠️ Attempted to update non-existent session: ${sessionId}`);
    }
  }
  
  /**
   * Delete session
   */
  delete(sessionId: string): void {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      console.log(`[Session Manager] 🗑️  Deleted session: ${sessionId}`);
    }
  }
  
  /**
   * Clear all sessions (for testing/debugging)
   */
  clear(): void {
    this.sessions.clear();
    console.log('[Session Manager] 🧹 Cleared all sessions');
  }
  
  /**
   * Get session count
   */
  getCount(): number {
    return this.sessions.size;
  }
  
  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastAccessedAt > this.SESSION_TIMEOUT_MS) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[Session Manager] 🧹 Cleaned up ${cleanedCount} expired sessions`);
    }
  }
  
  /**
   * Export session state as a context string for LLM
   */
  exportAsContext(sessionId: string): string {
    const session = this.get(sessionId);
    if (!session) {
      return 'No session state available.';
    }
    
    const parts: string[] = [];
    
    // Patient info
    if (session.patient && Object.keys(session.patient).length > 0) {
      const p = session.patient;
      parts.push('**Patient Information:**');
      if (p.patNum) parts.push(`- Patient ID: ${p.patNum}`);
      if (p.firstName || p.lastName) parts.push(`- Name: ${p.firstName || ''} ${p.lastName || ''}`.trim());
      if (p.phone) parts.push(`- Phone: ${p.phone}`);
      if (p.email) parts.push(`- Email: ${p.email}`);
      if (p.birthdate) parts.push(`- Birthdate: ${p.birthdate}`);
    }
    
    // Appointment info
    if (session.appointment && Object.keys(session.appointment).length > 0) {
      const a = session.appointment;
      parts.push('\n**Appointment Information:**');
      if (a.aptNum) parts.push(`- Appointment ID: ${a.aptNum}`);
      if (a.appointmentType) parts.push(`- Type: ${a.appointmentType}`);
      if (a.reason) parts.push(`- Reason: ${a.reason}`);
    }
    
    // Selected slot
    if (session.slots?.selected) {
      const s = session.slots.selected;
      parts.push('\n**Selected Time Slot:**');
      parts.push(`- Date/Time: ${s.AptDateTime}`);
      if (s.providerName) parts.push(`- Provider: ${s.providerName}`);
    } else if (session.slots?.available && session.slots.available.length > 0) {
      parts.push(`\n**Available Slots:** ${session.slots.available.length} options queried (not yet selected)`);
    }
    
    // Workflow status
    if (session.workflow && Object.keys(session.workflow).length > 0) {
      const w = session.workflow;
      parts.push('\n**Workflow Status:**');
      if (w.currentStep) parts.push(`- Current Step: ${w.currentStep}`);
      if (w.patientLookedUp) parts.push('- Patient lookup: ✅ Completed');
      if (w.slotsQueried) parts.push('- Slots queried: ✅ Completed');
      if (w.slotSelected) parts.push('- Slot selected: ✅ Completed');
      if (w.appointmentCreated) parts.push('- Appointment created: ✅ Completed');
    }
    
    return parts.length > 0 ? parts.join('\n') : 'No active booking state.';
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let sessionStore: SessionStateStore | null = null;

export function getSessionStore(): SessionStateStore {
  if (!sessionStore) {
    sessionStore = new SessionStateStore();
    console.log('[Session Manager] 🚀 Initialized session store');
  }
  return sessionStore;
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Get or create session state
 */
export function getOrCreateSession(sessionId: string, organizationId?: string, callId?: string): BookingSessionState {
  return getSessionStore().getOrCreate(sessionId, organizationId, callId);
}

/**
 * Get session state
 */
export function getSession(sessionId: string): BookingSessionState | undefined {
  return getSessionStore().get(sessionId);
}

/**
 * Update session state
 */
export function updateSession(sessionId: string, updates: Partial<BookingSessionState>): void {
  getSessionStore().update(sessionId, updates);
}

/**
 * Delete session
 */
export function deleteSession(sessionId: string): void {
  getSessionStore().delete(sessionId);
}

/**
 * Export session as LLM context
 */
export function getSessionContext(sessionId: string): string {
  return getSessionStore().exportAsContext(sessionId);
}
