# Demo Landing Page Feature

## Overview
Added live booking widget and email registration to landing page for demo organization.

## What Was Built

### 1. Database (Migration 059)
- **`demo_emails` table**: Stores visitor emails for notifications and marketing
- **`call_analysis` column**: Added to `conversations` table to store structured booking data

### 2. API Endpoints

#### POST `/api/demo/register-email`
- Registers visitor email for demo notifications
- Tracks IP and user agent
- Updates `last_used_at` if email already exists

#### GET `/api/demo/recent-bookings`
- Returns last 5 bookings for an organization
- Extracts data from `call_analysis` field
- Public endpoint (no auth required)

#### DELETE `/api/demo/delete-booking`
- Allows users to delete their booking from public display
- Requires booking ID and organization ID

### 3. Email Routing Logic
Modified `sendCallEndedEmail.ts`:
- Checks if organization is demo org (slug='demo' or name='Demo')
- If demo org: sends to all registered demo emails from last 2 hours
- Falls back to standard recipients if no demo emails found

### 4. Landing Page Components
- **Email Input Form**: Visitors enter email to receive booking notifications
- **Live Bookings Widget**: Shows last 5 bookings, updates every 10 seconds
- **Booking Display**: Shows name, phone, date/time, provider with delete button
- **Auto-refresh**: Polls for new bookings every 10 seconds

## Setup Required

### 1. Run Migrations
```sql
-- Run in Supabase SQL Editor:
-- 1. First: d:\Dev\Agent0\supabase\migrations\059_demo_emails.sql
-- 2. Then: d:\Dev\Agent0\scripts\setup-demo-org.sql (sets slug='demo')
```

### 2. Populate call_analysis Field
The `call_analysis` field needs to be populated when bookings are created. This requires adding logic to extract booking data from supervisor responses and store it in the conversation record.

**TODO**: Add call_analysis update logic in supervisor agent after successful CreateAppointment calls.

Example structure for `call_analysis`:
```json
{
  "booking_completed": true,
  "patient_first_name": "John",
  "patient_last_name": "Doe",
  "patient_phone": "+1234567890",
  "appointment_date": "2026-02-15",
  "appointment_time": "10:00 AM",
  "provider_name": "Dr. Smith",
  "appointment_type": "Cleaning"
}
```

## Demo Organization ID
```
b445a9c7-af93-4b4a-a975-40d3f44178ec
```

## Testing
1. Run migrations
2. Visit landing page
3. Enter email in "Email Notification Demo" section
4. Call +1 (850) 403-6622
5. Complete a booking
6. Watch it appear in "Recent Live Bookings" widget
7. Check email for notification

## Files Modified
- `src/app/landing/page.tsx` - Added live widget and email form
- `src/app/lib/email/sendCallEndedEmail.ts` - Added demo email routing
- `scripts/setup-demo-org.sql` - Added slug='demo' to org update
- `supabase/migrations/059_demo_emails.sql` - New migration

## Files Created
- `src/app/api/demo/register-email/route.ts`
- `src/app/api/demo/recent-bookings/route.ts`
- `src/app/api/demo/delete-booking/route.ts`
