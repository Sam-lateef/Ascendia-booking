# Environment Variables Check

## Required Variables for Embedded Booking System

Your `.env` file needs these variables:

```bash
# Supabase Database (REQUIRED for embedded booking)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...

# OpenAI (already in your .env)
OPENAI_API_KEY=sk-...
```

## How to Get Supabase Credentials

1. **Go to Supabase Dashboard**: https://app.supabase.com
2. **Select your project** (or create a new one)
3. **Go to Settings → API**
4. **Copy these values**:
   - **Project URL** → This is your `SUPABASE_URL`
   - **anon public** key → This is your `SUPABASE_ANON_KEY`

## Verify Your .env File

Make sure your `.env` file has:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important**: 
- No quotes around the values (unless they contain special characters)
- No trailing spaces
- Each variable on its own line

## Test the Connection

After adding the variables, try running the seed script again:

```bash
npm run seed:booking
```

If you still get errors, check:
1. ✅ Variables are spelled correctly (case-sensitive!)
2. ✅ No extra spaces or quotes
3. ✅ Restart your terminal/editor after changing .env























