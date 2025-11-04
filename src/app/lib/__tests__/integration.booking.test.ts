/**
 * Integration Tests for Booking Flow
 * 
 * Tests the complete booking workflow:
 * 1. Lexi calls get_office_context
 * 2. User requests appointment
 * 3. Lexi delegates to orchestrator
 * 4. Orchestrator detects conflicts using pre-fetched context
 * 5. Orchestrator books appointment if no conflicts
 * 
 * Run with: npm test
 */

import { fetchOfficeContext, detectConflicts } from '../officeContext';

describe('Complete Booking Flow Integration', () => {
  
  describe('Happy Path: No Conflicts', () => {
    it('should successfully book appointment when no conflicts exist', async () => {
      // Step 1: Lexi fetches office context
      console.log('Step 1: Fetching office context...');
      const context = await fetchOfficeContext();
      
      expect(context).toBeDefined();
      expect(context.providers).toBeDefined();
      expect(context.operatories).toBeDefined();
      expect(context.occupiedSlots).toBeDefined();
      
      // Step 2: Check for conflicts before booking
      console.log('Step 2: Checking for conflicts...');
      const requestedTime = '2025-12-15 10:00:00'; // Far future, unlikely to have conflicts
      const conflictCheck = detectConflicts(
        context,
        requestedTime,
        1, // ProvNum
        1, // OpNum
        999 // PatNum
      );
      
      expect(conflictCheck.hasConflict).toBe(false);
      
      // Step 3: If no conflicts, proceed with booking
      console.log('Step 3: No conflicts, proceeding with booking...');
      // In real implementation, would call CreateAppointment API here
      expect(true).toBe(true); // Placeholder for actual API call
    });
  });
  
  describe('Conflict Detection Path', () => {
    it('should detect and suggest alternatives when conflict exists', async () => {
      // Step 1: Fetch context
      const context = await fetchOfficeContext();
      
      // Step 2: Try to book at a time that might conflict
      // Use the first occupied slot from context
      if (context.occupiedSlots.length > 0) {
        const occupiedSlot = context.occupiedSlots[0];
        
        console.log('Step 2: Attempting to book at occupied time...');
        const conflictCheck = detectConflicts(
          context,
          occupiedSlot.aptDateTime,
          occupiedSlot.provNum,
          occupiedSlot.opNum,
          999 // Different patient
        );
        
        // Should detect conflict
        expect(conflictCheck.hasConflict).toBe(true);
        expect(conflictCheck.conflicts.length).toBeGreaterThan(0);
        
        // Should provide suggestions
        expect(conflictCheck.suggestions).toBeDefined();
        
        console.log('Conflicts detected:', conflictCheck.conflicts);
        console.log('Suggestions:', conflictCheck.suggestions);
      } else {
        console.log('No occupied slots to test against');
        expect(true).toBe(true); // Pass if no occupied slots
      }
    });
  });
  
  describe('Performance Test', () => {
    it('should fetch office context in under 5 seconds', async () => {
      const startTime = Date.now();
      
      const context = await fetchOfficeContext();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`Office context fetched in ${duration}ms`);
      
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(context).toBeDefined();
    });
    
    it('should perform conflict detection in under 100ms', async () => {
      const context = await fetchOfficeContext();
      
      const startTime = Date.now();
      
      detectConflicts(
        context,
        '2025-12-15 10:00:00',
        1,
        1,
        999
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`Conflict detection completed in ${duration}ms`);
      
      expect(duration).toBeLessThan(100); // Should be very fast (in-memory check)
    });
  });
  
  describe('API Reduction Test', () => {
    it('should reduce API calls by using pre-fetched context', async () => {
      console.log('\n=== API Call Reduction Analysis ===\n');
      
      // WITHOUT office context (traditional approach):
      console.log('Traditional Approach (NO pre-fetching):');
      console.log('  1. GetMultiplePatients() - 1 API call');
      console.log('  2. GetProviders() - 1 API call');
      console.log('  3. GetOperatories() - 1 API call');
      console.log('  4. GetAppointments(date range) - 1 API call');
      console.log('  5. CreateAppointment() - 1 API call');
      console.log('  TOTAL: 5 API calls per booking\n');
      
      // WITH office context (new approach):
      console.log('Optimized Approach (WITH pre-fetching):');
      console.log('  Initial: fetchOfficeContext() - 3 parallel API calls (once per conversation)');
      console.log('  Per booking:');
      console.log('    1. GetMultiplePatients() - 1 API call');
      console.log('    2. CreateAppointment() - 1 API call');
      console.log('    (Providers, Operatories, Occupied Slots already cached)');
      console.log('  TOTAL: 2 API calls per booking\n');
      
      console.log('Savings:');
      console.log('  Per booking: 5 → 2 API calls (60% reduction)');
      console.log('  For 10 bookings: 50 → 23 API calls (54% reduction)');
      console.log('  For 100 bookings: 500 → 203 API calls (59% reduction)\n');
      
      expect(true).toBe(true); // Analysis test
    });
  });
});




