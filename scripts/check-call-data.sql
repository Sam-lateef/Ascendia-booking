-- Check the recent call data
SELECT 
  id,
  call_id,
  organization_id,
  channel,
  from_number,
  to_number,
  duration_ms / 1000.0 as duration_seconds,
  transcript,
  call_successful,
  created_at
FROM conversations
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;

-- Check organization notification settings
SELECT 
  id,
  name,
  slug,
  notification_settings
FROM organizations
WHERE slug = 'sam-lateeff';
