/**
 * OpenDental API Documentation Content
 * This is imported statically to avoid fs module issues in Next.js
 * 
 * Source: docs/API/apiDoc.md
 * Generated from: https://www.opendental.com/site/apispecification.html
 */

export const apiDocContent = `# Opendental API Documentation
## Overview
Generated from: https://www.opendental.com/site/apispecification.html
Crawled: 2025-10-26

## Authentication
Bearer token is required for all API requests.
API requests must include an Authorization header in the format: Authorization: ODFHIR {DeveloperKey}/{CustomerKey}.
All API requests require valid API key credentials.

## Endpoint Dependencies
The following endpoints have dependencies on other endpoints:

### CreatePatient
**Requires**: None
**Reason**: No dependencies required to create a new patient.

### UpdatePatient
**Requires**: GetPatient
**Reason**: Needs existing patient data to update.
**Required Data**: PatientID

### DeletePatient
**Requires**: GetPatient
**Reason**: Needs existing patient data to delete.
**Required Data**: PatientID

### CreateAppointment
**Requires**: GetPatient, GetProvider
**Reason**: Needs PatientID and ProviderID as parameters.
**Required Data**: PatientID, ProviderID

### UpdateAppointment
**Requires**: GetAppointmentById
**Reason**: Needs existing appointment data to update.
**Required Data**: AppointmentID

### DeleteAppointment
**Requires**: GetAppointmentById
**Reason**: Needs existing appointment data to delete.
**Required Data**: AppointmentID

### CreateClaim
**Requires**: GetPatient, GetInsuranceForPatient
**Reason**: Needs PatientID and Insurance information to create a claim.
**Required Data**: PatientID, InsuranceInfo

### CreateClaimPayment
**Requires**: GetSingleClaim
**Reason**: Needs existing claim data to finalize a payment.
**Required Data**: ClaimID

### CreatePatPlan
**Requires**: GetPatient
**Reason**: Needs PatientID to create a patient plan.
**Required Data**: PatientID

### UpdatePatPlan
**Requires**: GetPatPlans
**Reason**: Needs existing patient plan data to update.
**Required Data**: PatPlanID

### DeletePatPlan
**Requires**: GetPatPlans
**Reason**: Needs existing patient plan data to delete.
**Required Data**: PatPlanID

## Business Logic

### Patient Record Management
- A patient must have a first name and last name to be created.
- If a field is not included in a PUT request, it will not change the original field in the database.
- A Business Associate Agreement (BAA) must be in place before accessing patient data.

### API Key Management
- Each API request must include a Developer API Key and a Customer API Key in the Authorization header.
- Customer API Keys can be enabled or disabled by the customer but cannot change permissions.

### Aging Data Retrieval
- Ensure the Open Dental Service is running before retrieving aging data.
- Check the preference 'Automated Aging Runtime' for a time entry before proceeding.

### API Request Handling
- All API requests require a Content-Type header of 'application/json'.
- Requests must be properly formatted to avoid 400 BadRequest errors.

### Data Formatting
- Date fields default to 'yyyy-MM-dd' format.
- DateTime fields default to 'yyyy-MM-dd HH:mm:ss' format.

### Appointment Creation Rules
- PatNum and Op are required for creating an appointment.
- AptDateTime must be in 'yyyy-MM-dd HH:mm:ss' format.
- If IsNewPatient is true, patient.DateFirstVisit will be set to AptDateTime.

### Appointment Status Management
- Only appointments with AptStatus of 'Scheduled' can be broken.
- Use PUT to update appointment details, including status and time.

### Appointment Creation Rules
- An appointment must have a valid PatientId.
- The appointment date must be in the future.
- Conflicts with existing appointments must be checked before creating a new appointment.

### Cancellation Policy
- 24 hours notice required for appointment cancellations.
- Late cancellations or no-shows may result in fees.

### Insurance
- Must verify insurance coverage before procedures.
- Co-pays and deductibles due at time of service.

### Payment Rules
- Payment is due at time of service.
- Payments apply to outstanding charges in FIFO order.
- Overpayments are inserted as unearned income.

### Claim Submission
- The insurance plan specified must be associated with the patient.
- Creating a primary or secondary claim will use the patient's primary or secondary insurance respectively.
- Claims with insurance payments/checks attached cannot be deleted.
- Claims with a status of Received cannot be deleted.

### Patient Balances
- Must provide a valid PatNum to retrieve patient balances.
- Returns balances for individual patients and the entire family.

## Common Workflows

### Schedule Appointment Workflow
1. GetPatients or GetPatient (search for patient by name/DOB)
2. GetAppointments (get all appointments for the requested date to find occupied slots)
3. Find free time slot by checking which hours are NOT occupied (8am-5pm business hours)
4. CreateAppointment (book the appointment with PatientID, AptDateTime, and ProviderID)
Note: GetAvailableSlots is not used as it returns empty arrays in test databases

### Update Patient Information Workflow
1. GetPatients (search for patient to get PatientID)
2. UpdatePatient (update fields with PatientID)

### Create Insurance Claim Workflow
1. GetPatient (verify patient exists, get PatientID)
2. GetInsuranceForPatient (get patient's insurance information)
3. CreateClaim (submit claim with PatientID and insurance info)

### Payment Processing Workflow
1. GetPatient (verify patient and get balance)
2. CreatePayment (record payment)
3. Payment automatically applies to oldest charges first

### Recall Management Workflow
1. GetRecalls (check patients due for recall)
2. GetPatient (get patient contact information)
3. CreateAppointment (schedule recall appointment)

## Important Notes
- Always check dependencies before calling endpoints
- Use proper date formats (yyyy-MM-dd for dates, yyyy-MM-dd HH:mm:ss for datetime)
- Verify patient information exists before creating related records
- Follow proper authentication with ODFHIR or Bearer token format
- All API calls require valid API key credentials
- Use appropriate error handling for failed API calls`;




