-- Migration: Auto-create organization and user record on signup
-- This ensures new signups get their own organization automatically

-- Function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  new_user_id uuid;
  new_org_slug text;
  user_email text;
  org_name text;
BEGIN
  -- Get user email from auth.users
  user_email := NEW.email;
  
  -- Extract organization name from email (before @)
  org_name := split_part(user_email, '@', 1) || '''s Organization';
  
  -- Generate unique slug from email
  new_org_slug := regexp_replace(lower(split_part(user_email, '@', 1)), '[^a-z0-9]', '-', 'g');
  
  -- Ensure slug is unique by appending random suffix if needed
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = new_org_slug) THEN
    new_org_slug := new_org_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
  END IF;
  
  -- Create organization
  INSERT INTO public.organizations (
    id,
    name,
    slug,
    plan,
    status,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    org_name,
    new_org_slug,
    'free',
    'active',
    NOW(),
    NOW()
  )
  RETURNING id INTO new_org_id;
  
  -- Check if user record already exists (from invitation)
  SELECT id INTO new_user_id
  FROM public.users
  WHERE email = user_email AND auth_user_id IS NULL;
  
  IF new_user_id IS NOT NULL THEN
    -- User was invited - update existing record with auth_user_id
    UPDATE public.users
    SET 
      auth_user_id = NEW.id,
      first_name = COALESCE(NEW.raw_user_meta_data->>'first_name', first_name, split_part(user_email, '@', 1)),
      last_name = COALESCE(NEW.raw_user_meta_data->>'last_name', last_name, ''),
      is_active = true,
      email_verified = true,
      updated_at = NOW()
    WHERE id = new_user_id;
    
    -- Update organization membership to active status
    UPDATE public.organization_members
    SET 
      status = 'active',
      joined_at = NOW()
    WHERE user_id = new_user_id AND status = 'invited';
    
    RAISE NOTICE 'Linked invited user to auth: %', user_email;
    RETURN NEW;
  END IF;
  
  -- No existing invitation - create new user record and organization
  INSERT INTO public.users (
    auth_user_id,
    email,
    first_name,
    last_name,
    is_active,
    email_verified,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    user_email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(user_email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    true,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW()
  RETURNING id INTO new_user_id;
  
  -- Link user to organization as owner
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role,
    created_at
  ) VALUES (
    new_org_id,
    new_user_id,
    'owner',
    NOW()
  )
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users for new signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();

-- Also handle the existing user that just signed up
-- This will create org for sam.lateeff@gmail.com
DO $$
DECLARE
  user_record record;
  new_org_id uuid;
  new_user_id uuid;
  new_org_slug text;
  org_name text;
BEGIN
  -- Find users in auth.users that don't have organizations
  FOR user_record IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.users u ON au.id = u.auth_user_id
    WHERE u.auth_user_id IS NULL
    AND au.email IS NOT NULL
  LOOP
    -- Check if user was invited (has a user record without auth_user_id)
    SELECT id INTO new_user_id
    FROM public.users
    WHERE email = user_record.email AND auth_user_id IS NULL;
    
    IF new_user_id IS NOT NULL THEN
      -- User was invited - link to auth user
      UPDATE public.users
      SET 
        auth_user_id = user_record.id,
        first_name = COALESCE(user_record.raw_user_meta_data->>'first_name', first_name),
        last_name = COALESCE(user_record.raw_user_meta_data->>'last_name', last_name),
        is_active = true,
        email_verified = true,
        updated_at = NOW()
      WHERE id = new_user_id;
      
      -- Update membership status
      UPDATE public.organization_members
      SET 
        status = 'active',
        joined_at = NOW()
      WHERE user_id = new_user_id AND status = 'invited';
      
      RAISE NOTICE 'Linked invited user to auth: %', user_record.email;
      CONTINUE;
    END IF;
    
    -- No invitation - create new organization
    -- Extract organization name from email
    org_name := split_part(user_record.email, '@', 1) || '''s Organization';
    
    -- Generate unique slug
    new_org_slug := regexp_replace(lower(split_part(user_record.email, '@', 1)), '[^a-z0-9]', '-', 'g');
    
    -- Ensure slug is unique
    IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = new_org_slug) THEN
      new_org_slug := new_org_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
    END IF;
    
    -- Create organization
    INSERT INTO public.organizations (
      id,
      name,
      slug,
      plan,
      status,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      org_name,
      new_org_slug,
      'free',
      'active',
      NOW(),
      NOW()
    )
    RETURNING id INTO new_org_id;
    
    -- Create user record
    INSERT INTO public.users (
      auth_user_id,
      email,
      first_name,
      last_name,
      is_active,
      email_verified,
      created_at,
      updated_at
    ) VALUES (
      user_record.id,
      user_record.email,
      COALESCE(user_record.raw_user_meta_data->>'first_name', split_part(user_record.email, '@', 1)),
      COALESCE(user_record.raw_user_meta_data->>'last_name', ''),
      true,
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO new_user_id;
    
    -- Link user to organization as owner
    INSERT INTO public.organization_members (
      organization_id,
      user_id,
      role,
      created_at
    ) VALUES (
      new_org_id,
      new_user_id,
      'owner',
      NOW()
    );
    
    RAISE NOTICE 'Created organization for user: %', user_record.email;
  END LOOP;
END $$;
