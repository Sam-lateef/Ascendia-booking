-- ============================================
-- Seed Initial Workflows
-- 
-- Migrates the fallback workflows from dynamicRouter.ts
-- to the dynamic_workflows table for persistence
-- ============================================

-- Book Workflow
INSERT INTO dynamic_workflows (workflow_name, intent_triggers, definition, description, is_active)
VALUES (
  'book_appointment',
  ARRAY['book', 'schedule', 'make appointment', 'new appointment'],
  '{
    "goal": "Book a new appointment",
    "reasoning": "Standard booking flow: identify patient, collect preferences, find slots, confirm booking",
    "steps": [
      {
        "id": "confirm_phone",
        "function": "ConfirmWithUser",
        "description": "Confirm phone number",
        "inputMapping": {},
        "outputAs": "phoneConfirmed",
        "waitForUser": {
          "field": "phoneConfirmed",
          "prompt": "I have your phone number as {phone}. Is that correct?",
          "type": "confirmation"
        }
      },
      {
        "id": "lookup_patient",
        "function": "GetMultiplePatients",
        "description": "Find patient by phone",
        "inputMapping": { "Phone": "phone" },
        "outputAs": "patients"
      },
      {
        "id": "extract_patient_id",
        "function": "ExtractPatientId",
        "description": "Get patient ID from results",
        "inputMapping": { "from": "patients" },
        "outputAs": "patientId",
        "skipIf": "patientId"
      },
      {
        "id": "get_slots",
        "function": "GetAvailableSlots",
        "description": "Find available appointment slots",
        "inputMapping": { "dateStart": "preferredDate", "dateEnd": "preferredDate" },
        "outputAs": "availableSlots",
        "waitForUser": {
          "field": "selectedSlot",
          "prompt": "Here are the available times. Which works best for you?",
          "type": "selection"
        }
      },
      {
        "id": "confirm_booking",
        "function": "ConfirmWithUser",
        "description": "Confirm appointment details",
        "inputMapping": {},
        "outputAs": "appointmentConfirmed",
        "waitForUser": {
          "field": "appointmentConfirmed",
          "prompt": "Ready to book your appointment at {selectedSlot.dateTime}?",
          "type": "confirmation"
        }
      },
      {
        "id": "create_appointment",
        "function": "CreateAppointment",
        "description": "Book the appointment",
        "inputMapping": {
          "PatNum": "patientId",
          "AptDateTime": "selectedSlot.DateTimeStart",
          "ProvNum": "selectedSlot.ProvNum",
          "Op": "selectedSlot.OpNum"
        },
        "outputAs": "appointment"
      }
    ],
    "requiredUserInputs": [
      { "field": "phone", "prompt": "What is your phone number?", "validation": "phone" },
      { "field": "preferredDate", "prompt": "What date works for you?", "validation": "futureDate" }
    ],
    "successMessage": "Your appointment has been booked for {selectedSlot.dateTime}!",
    "errorMessage": "I was unable to complete the booking. Please try again or call the office."
  }'::jsonb,
  'Book a new dental appointment',
  true
)
ON CONFLICT (workflow_name) DO UPDATE SET
  definition = EXCLUDED.definition,
  intent_triggers = EXCLUDED.intent_triggers,
  updated_at = NOW();

-- Reschedule Workflow
INSERT INTO dynamic_workflows (workflow_name, intent_triggers, definition, description, is_active)
VALUES (
  'reschedule_appointment',
  ARRAY['reschedule', 'change appointment', 'move appointment', 'different time'],
  '{
    "goal": "Reschedule an existing appointment",
    "reasoning": "Find patient, show appointments, select one to reschedule, find new slot, update",
    "steps": [
      {
        "id": "confirm_phone",
        "function": "ConfirmWithUser",
        "description": "Confirm phone number",
        "inputMapping": {},
        "outputAs": "phoneConfirmed",
        "waitForUser": {
          "field": "phoneConfirmed",
          "prompt": "I have your phone number as {phone}. Is that correct?",
          "type": "confirmation"
        }
      },
      {
        "id": "lookup_patient",
        "function": "GetMultiplePatients",
        "description": "Find patient by phone",
        "inputMapping": { "Phone": "phone" },
        "outputAs": "patients"
      },
      {
        "id": "extract_patient_id",
        "function": "ExtractPatientId",
        "description": "Get patient ID",
        "inputMapping": { "from": "patients" },
        "outputAs": "patientId"
      },
      {
        "id": "get_appointments",
        "function": "GetAppointments",
        "description": "Get existing appointments",
        "inputMapping": { 
          "PatNum": "patientId",
          "DateStart": "today",
          "DateEnd": "threeMonthsFromNow"
        },
        "outputAs": "appointments",
        "waitForUser": {
          "field": "appointmentToReschedule",
          "prompt": "Which appointment would you like to reschedule?",
          "type": "selection"
        }
      },
      {
        "id": "get_new_slots",
        "function": "GetAvailableSlots",
        "description": "Find new available slots",
        "inputMapping": { "dateStart": "preferredDate", "dateEnd": "preferredDate" },
        "outputAs": "availableSlots",
        "waitForUser": {
          "field": "selectedSlot",
          "prompt": "Here are the available times. Which works best?",
          "type": "selection"
        }
      },
      {
        "id": "confirm_reschedule",
        "function": "ConfirmWithUser",
        "description": "Confirm reschedule",
        "inputMapping": {},
        "outputAs": "rescheduleConfirmed",
        "waitForUser": {
          "field": "rescheduleConfirmed",
          "prompt": "Ready to reschedule to {selectedSlot.dateTime}?",
          "type": "confirmation"
        }
      },
      {
        "id": "update_appointment",
        "function": "UpdateAppointment",
        "description": "Update the appointment",
        "inputMapping": {
          "AptNum": "appointmentToReschedule.AptNum",
          "AptDateTime": "selectedSlot.DateTimeStart",
          "ProvNum": "selectedSlot.ProvNum",
          "Op": "selectedSlot.OpNum"
        },
        "outputAs": "updatedAppointment"
      }
    ],
    "requiredUserInputs": [
      { "field": "phone", "prompt": "What is your phone number?", "validation": "phone" },
      { "field": "preferredDate", "prompt": "What date would you like to reschedule to?", "validation": "futureDate" }
    ],
    "successMessage": "Your appointment has been rescheduled to {selectedSlot.dateTime}!",
    "errorMessage": "I was unable to reschedule. Please try again or call the office."
  }'::jsonb,
  'Reschedule an existing appointment',
  true
)
ON CONFLICT (workflow_name) DO UPDATE SET
  definition = EXCLUDED.definition,
  intent_triggers = EXCLUDED.intent_triggers,
  updated_at = NOW();

-- Cancel Workflow
INSERT INTO dynamic_workflows (workflow_name, intent_triggers, definition, description, is_active)
VALUES (
  'cancel_appointment',
  ARRAY['cancel', 'cancel appointment', 'remove appointment', 'delete appointment'],
  '{
    "goal": "Cancel an existing appointment",
    "reasoning": "Find patient, show appointments, select one, confirm, cancel",
    "steps": [
      {
        "id": "confirm_phone",
        "function": "ConfirmWithUser",
        "description": "Confirm phone number",
        "inputMapping": {},
        "outputAs": "phoneConfirmed",
        "waitForUser": {
          "field": "phoneConfirmed",
          "prompt": "I have your phone number as {phone}. Is that correct?",
          "type": "confirmation"
        }
      },
      {
        "id": "lookup_patient",
        "function": "GetMultiplePatients",
        "description": "Find patient by phone",
        "inputMapping": { "Phone": "phone" },
        "outputAs": "patients"
      },
      {
        "id": "extract_patient_id",
        "function": "ExtractPatientId",
        "description": "Get patient ID",
        "inputMapping": { "from": "patients" },
        "outputAs": "patientId"
      },
      {
        "id": "get_appointments",
        "function": "GetAppointments",
        "description": "Get existing appointments",
        "inputMapping": { 
          "PatNum": "patientId",
          "DateStart": "today",
          "DateEnd": "threeMonthsFromNow"
        },
        "outputAs": "appointments",
        "waitForUser": {
          "field": "appointmentToCancel",
          "prompt": "Which appointment would you like to cancel?",
          "type": "selection"
        }
      },
      {
        "id": "confirm_cancel",
        "function": "ConfirmWithUser",
        "description": "Confirm cancellation",
        "inputMapping": {},
        "outputAs": "cancelConfirmed",
        "waitForUser": {
          "field": "cancelConfirmed",
          "prompt": "Are you sure you want to cancel this appointment?",
          "type": "confirmation"
        }
      },
      {
        "id": "cancel_appointment",
        "function": "BreakAppointment",
        "description": "Cancel the appointment",
        "inputMapping": { "AptNum": "appointmentToCancel.AptNum" },
        "outputAs": "cancellationResult"
      }
    ],
    "requiredUserInputs": [
      { "field": "phone", "prompt": "What is your phone number?", "validation": "phone" }
    ],
    "successMessage": "Your appointment has been cancelled.",
    "errorMessage": "I was unable to cancel. Please try again or call the office."
  }'::jsonb,
  'Cancel an existing appointment',
  true
)
ON CONFLICT (workflow_name) DO UPDATE SET
  definition = EXCLUDED.definition,
  intent_triggers = EXCLUDED.intent_triggers,
  updated_at = NOW();

-- Check Appointments Workflow
INSERT INTO dynamic_workflows (workflow_name, intent_triggers, definition, description, is_active)
VALUES (
  'check_appointments',
  ARRAY['check', 'check appointments', 'view appointments', 'my appointments', 'when is my appointment'],
  '{
    "goal": "Check upcoming appointments",
    "reasoning": "Find patient, show their appointments",
    "steps": [
      {
        "id": "confirm_phone",
        "function": "ConfirmWithUser",
        "description": "Confirm phone number",
        "inputMapping": {},
        "outputAs": "phoneConfirmed",
        "waitForUser": {
          "field": "phoneConfirmed",
          "prompt": "I have your phone number as {phone}. Is that correct?",
          "type": "confirmation"
        }
      },
      {
        "id": "lookup_patient",
        "function": "GetMultiplePatients",
        "description": "Find patient by phone",
        "inputMapping": { "Phone": "phone" },
        "outputAs": "patients"
      },
      {
        "id": "extract_patient_id",
        "function": "ExtractPatientId",
        "description": "Get patient ID",
        "inputMapping": { "from": "patients" },
        "outputAs": "patientId"
      },
      {
        "id": "get_appointments",
        "function": "GetAppointments",
        "description": "Get upcoming appointments",
        "inputMapping": { 
          "PatNum": "patientId",
          "DateStart": "today",
          "DateEnd": "threeMonthsFromNow"
        },
        "outputAs": "appointments"
      }
    ],
    "requiredUserInputs": [
      { "field": "phone", "prompt": "What is your phone number?", "validation": "phone" }
    ],
    "successMessage": "Here are your upcoming appointments: {appointmentsList}",
    "errorMessage": "I was unable to find your appointments. Please try again."
  }'::jsonb,
  'Check upcoming appointments',
  true
)
ON CONFLICT (workflow_name) DO UPDATE SET
  definition = EXCLUDED.definition,
  intent_triggers = EXCLUDED.intent_triggers,
  updated_at = NOW();

-- Add increment_workflow_usage function if not exists
CREATE OR REPLACE FUNCTION increment_workflow_usage(
  workflow_id UUID,
  was_successful BOOLEAN
) RETURNS VOID AS $$
BEGIN
  UPDATE dynamic_workflows
  SET 
    times_used = times_used + 1,
    success_rate = CASE 
      WHEN times_used = 0 THEN (CASE WHEN was_successful THEN 1.0 ELSE 0.0 END)
      ELSE (success_rate * times_used + (CASE WHEN was_successful THEN 1 ELSE 0 END)) / (times_used + 1)
    END,
    last_used_at = NOW(),
    updated_at = NOW()
  WHERE id = workflow_id;
END;
$$ LANGUAGE plpgsql;

