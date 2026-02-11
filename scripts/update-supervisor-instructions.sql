-- Update Supervisor Instructions with Date/Day Validation
-- Fixes the issue where AI says "Thursday 5th" when Thursday is actually the 8th

UPDATE channel_configs
SET supervisor_instructions = supervisor_instructions || E'\n\n' || E'**DATE/DAY VALIDATION:**
When patient says "Thursday the 5th":
1. get_datetime() shows today is: "2026-01-31 (Friday)"
2. If patient wants "Thursday", that''s 6 days from today = February 6, 2026
3. VERIFY: Is February 6, 2026 actually a Thursday? YES
4. If patient says "Thursday the 5th" but Thursday is the 6th → CORRECT THEM:
   "I have Thursday, February 6th available. Did you mean Thursday the 6th?"

ALWAYS match the day name with the actual date. NEVER say "Thursday the 5th" if Thursday is the 6th.

**WHEN PRESENTING AVAILABLE SLOTS:**
ALWAYS include BOTH day name AND date to avoid confusion:
GOOD: "I have Thursday, February 6th at 9 AM, 10:30 AM, or 2 PM."
BAD: "I have Thursday the 5th..." (when Thursday is actually the 6th)
The GetAvailableSlots response includes dates - USE those exact dates with correct day names.'
WHERE channel = 'twilio'
  AND organization_id = 'b445a9c7-af93-4b4a-a975-40d3f44178ec';

-- Verify the update
SELECT 
  organization_id,
  channel,
  LENGTH(supervisor_instructions) as instruction_length,
  supervisor_instructions LIKE '%DATE/DAY VALIDATION%' as has_date_validation
FROM channel_configs
WHERE channel = 'twilio'
  AND organization_id = 'b445a9c7-af93-4b4a-a975-40d3f44178ec';
