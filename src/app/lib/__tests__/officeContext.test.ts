/**
 * Unit Tests for Office Context and Conflict Detection
 * 
 * Run with: npm test
 * or: npx jest src/app/lib/__tests__/officeContext.test.ts
 */

import { detectConflicts, isContextExpired } from '../officeContext';
import type { OfficeContext, OccupiedSlot } from '../officeContext';

describe('Office Context', () => {
  
  describe('isContextExpired', () => {
    it('should return false for fresh context', () => {
      const context: OfficeContext = {
        providers: [],
        operatories: [],
        occupiedSlots: [],
        officeHours: {} as any,
        defaults: {} as any,
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 300000).toISOString() // 5 minutes from now
      };
      
      expect(isContextExpired(context)).toBe(false);
    });
    
    it('should return true for expired context', () => {
      const context: OfficeContext = {
        providers: [],
        operatories: [],
        occupiedSlots: [],
        officeHours: {} as any,
        defaults: {} as any,
        fetchedAt: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
        expiresAt: new Date(Date.now() - 300000).toISOString() // 5 minutes ago
      };
      
      expect(isContextExpired(context)).toBe(true);
    });
  });
  
  describe('detectConflicts', () => {
    const mockContext: OfficeContext = {
      providers: [
        { provNum: 1, name: 'Dr. Smith', firstName: 'John', lastName: 'Smith', abbr: 'JS', specialty: 'General', isAvailable: true, isHidden: false },
        { provNum: 2, name: 'Dr. Jones', firstName: 'Jane', lastName: 'Jones', abbr: 'JJ', specialty: 'Hygiene', isAvailable: true, isHidden: false }
      ],
      operatories: [
        { opNum: 1, name: 'Op 1', abbrev: 'Op1', isHygiene: false, isAvailable: true, isHidden: false },
        { opNum: 2, name: 'Op 2', abbrev: 'Op2', isHygiene: true, isAvailable: true, isHidden: false }
      ],
      occupiedSlots: [
        {
          aptNum: 100,
          aptDateTime: '2025-10-30 14:00:00',
          patNum: 46,
          provNum: 1,
          opNum: 1,
          duration: 30
        },
        {
          aptNum: 101,
          aptDateTime: '2025-10-30 15:00:00',
          patNum: 52,
          provNum: 2,
          opNum: 2,
          duration: 30
        }
      ],
      officeHours: {} as any,
      defaults: { provNum: 1, opNum: 1, clinicNum: null, appointmentLength: 30, bufferBetweenAppointments: 15 },
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 300000).toISOString()
    };
    
    it('should detect patient conflict (same patient, same time)', () => {
      const result = detectConflicts(
        mockContext,
        '2025-10-30 14:00:00',
        1,
        1,
        46 // Same patient
      );
      
      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toContain(expect.stringContaining('Patient already has an appointment'));
    });
    
    it('should detect operatory conflict (different patient, same operatory)', () => {
      const result = detectConflicts(
        mockContext,
        '2025-10-30 14:00:00',
        1,
        1, // Same operatory as occupied slot
        99 // Different patient
      );
      
      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toContain(expect.stringContaining('Operatory 1 is occupied'));
    });
    
    it('should detect provider conflict (different operatory, same provider)', () => {
      const result = detectConflicts(
        mockContext,
        '2025-10-30 14:00:00',
        1, // Same provider
        3, // Different operatory
        99 // Different patient
      );
      
      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toContain(expect.stringContaining('Provider 1 is busy'));
    });
    
    it('should NOT detect conflict for different time slot', () => {
      const result = detectConflicts(
        mockContext,
        '2025-10-30 10:00:00', // Morning slot (occupied slots are 2pm and 3pm)
        1,
        1,
        99
      );
      
      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });
    
    it('should NOT detect conflict for different provider and operatory', () => {
      const result = detectConflicts(
        mockContext,
        '2025-10-30 14:00:00',
        2, // Different provider
        2, // Different operatory
        99 // Different patient
      );
      
      // Provider 2 and Op 2 are occupied at 3pm, not 2pm
      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });
    
    it('should provide suggestions when conflicts found', () => {
      const result = detectConflicts(
        mockContext,
        '2025-10-30 14:00:00',
        1,
        1,
        99
      );
      
      expect(result.hasConflict).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
    
    it('should handle edge case: appointment ending right as new one starts', () => {
      const result = detectConflicts(
        mockContext,
        '2025-10-30 14:30:00', // Starts when first appointment ends
        1,
        1,
        99
      );
      
      // Should NOT conflict (first appointment ends at 14:30, new one starts at 14:30)
      expect(result.hasConflict).toBe(false);
    });
    
    it('should detect conflict within 30-minute window', () => {
      const result = detectConflicts(
        mockContext,
        '2025-10-30 14:15:00', // 15 minutes after occupied slot starts
        1,
        1,
        99
      );
      
      // Should conflict (within occupied appointment time)
      expect(result.hasConflict).toBe(true);
    });
  });
});




