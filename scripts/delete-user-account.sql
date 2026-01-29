-- Delete user account: sam.lateeff@gmail.com
-- Run this in Supabase SQL Editor to completely remove the account

-- Step 1: Find the auth user ID
DO $$
DECLARE
  target_email text := 'sam.lateeff@gmail.com';
  auth_user_uuid uuid;
  public_user_uuid uuid;
  user_org_id uuid;
BEGIN
  -- Get the auth user ID
  SELECT id INTO auth_user_uuid
  FROM auth.users
  WHERE email = target_email;
  
  IF auth_user_uuid IS NULL THEN
    RAISE NOTICE 'No auth user found with email: %', target_email;
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found auth user: %', auth_user_uuid;
  
  -- Get the public user ID
  SELECT id, auth_user_id INTO public_user_uuid, auth_user_uuid
  FROM public.users
  WHERE email = target_email OR auth_user_id = auth_user_uuid;
  
  IF public_user_uuid IS NOT NULL THEN
    RAISE NOTICE 'Found public user: %', public_user_uuid;
    
    -- Get the user's organization
    SELECT organization_id INTO user_org_id
    FROM public.organization_members
    WHERE user_id = public_user_uuid
    LIMIT 1;
    
    IF user_org_id IS NOT NULL THEN
      RAISE NOTICE 'Found organization: %', user_org_id;
    END IF;
  END IF;
  
  -- Delete from organization_members first (foreign key constraint)
  IF public_user_uuid IS NOT NULL THEN
    DELETE FROM public.organization_members
    WHERE user_id = public_user_uuid;
    RAISE NOTICE 'Deleted from organization_members';
  END IF;
  
  -- Delete from public.users
  IF public_user_uuid IS NOT NULL THEN
    DELETE FROM public.users
    WHERE id = public_user_uuid;
    RAISE NOTICE 'Deleted from public.users';
  END IF;
  
  -- Optionally delete the organization if it was created for this user
  -- and no other members exist
  IF user_org_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = user_org_id) THEN
      -- Delete all related data for the organization
      DELETE FROM public.channel_configurations WHERE organization_id = user_org_id;
      DELETE FROM public.agent_configurations WHERE organization_id = user_org_id;
      DELETE FROM public.api_credentials WHERE organization_id = user_org_id;
      DELETE FROM public.external_integrations WHERE organization_id = user_org_id;
      DELETE FROM public.organizations WHERE id = user_org_id;
      RAISE NOTICE 'Deleted empty organization and related data';
    END IF;
  END IF;
  
  -- Finally, delete from auth.users
  DELETE FROM auth.users
  WHERE id = auth_user_uuid;
  RAISE NOTICE 'Deleted from auth.users';
  
  RAISE NOTICE '✅ Account completely deleted: %', target_email;
END $$;
