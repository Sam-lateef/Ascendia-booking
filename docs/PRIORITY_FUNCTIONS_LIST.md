# Priority Functions List (50 Functions)

This is the complete list of functions included in the optimized orchestrator catalog.

## Patients (10 functions)
1. `GetPatients` - List all patients
2. `GetMultiplePatients` - **⭐ CRITICAL** - Search by phone/name/address/SSN
3. `GetPatient` - Get specific patient by ID
4. `CreatePatient` - Register new patient
5. `UpdatePatient` - Update patient information
6. `DeletePatient` - Remove patient
7. `GetPatientBalances` - Check patient balance
8. `GetPatientAccountInfo` - Get detailed account info
9. `GetPatientProcedures` - Get patient's procedures
10. `GetPatientFamily` - Get family members

## Appointments (12 functions)
11. `GetAppointments` - **⭐ MOST USED** - List appointments
12. `GetAppointmentById` - Get specific appointment
13. `GetAvailableSlots` - Check availability (note: often returns empty)
14. `CreateAppointment` - **⭐ CRITICAL** - Schedule appointment
15. `UpdateAppointment` - Modify appointment
16. `BreakAppointment` - **⭐ USED** - Cancel appointment (keeps record)
17. `DeleteAppointment` - **⭐ USED** - Permanently delete
18. `ConfirmAppointment` - Confirm appointment
19. `GetAppointmentTypes` - Get appointment type list
20. `GetOperatories` - Get operatory list
21. `SearchAppointments` - Search appointments by criteria
22. `GetAppointmentConflicts` - Check for scheduling conflicts

## Providers (4 functions)
23. `GetProviders` - List all providers
24. `GetMultipleProviders` - Search providers
25. `GetProvider` - Get specific provider
26. `GetProviderSchedule` - Get provider schedule

## Insurance (6 functions)
27. `GetInsuranceForPatient` - Get patient's insurance
28. `GetInsurancePlans` - List insurance plans
29. `GetInsurancePlan` - Get specific plan
30. `CreateInsurancePlan` - Add insurance plan
31. `UpdateInsurancePlan` - Update plan
32. `GetInsuranceVerification` - Check insurance verification

## Procedures (5 functions)
33. `GetProcedures` - List procedures
34. `GetProcedureCodes` - Get CDT codes
35. `GetProcedureCode` - Get specific code
36. `CreateProcedure` - Add procedure to treatment plan
37. `UpdateProcedure` - Update procedure

## Claims (4 functions)
38. `GetClaims` - List claims
39. `GetSingleClaim` - Get specific claim
40. `CreateClaim` - Submit claim
41. `UpdateClaim` - Update claim status

## Payments (4 functions)
42. `CreatePayment` - Record payment
43. `GetPayments` - List payments
44. `GetPayment` - Get specific payment
45. `UpdatePayment` - Update payment

## Recalls (3 functions)
46. `GetRecalls` - List recalls
47. `CreateRecall` - Create recall
48. `UpdateRecall` - Update recall

## System & Preferences (2 functions)
49. `GetPreferences` - Get system preferences
50. `GetAgingData` - Get aging report data

---

## Functions Used in Your Logs (All Included ✅)

From the logs you provided, these functions were called:
- ✅ `GetMultiplePatients` (#2) - 6 calls
- ✅ `GetAppointments` (#11) - 7 calls
- ✅ `BreakAppointment` (#16) - 3 calls
- ✅ `CreateAppointment` (#14) - Mentioned in instructions
- ✅ `CreatePatient` (#4) - Mentioned in instructions
- ✅ `UpdatePatient` (#5) - Mentioned in instructions
- ✅ `DeleteAppointment` (#17) - 1 call (for unscheduled appointments)

**Coverage: 100%** - All functions you've used are in the priority list.

## To Add More Functions

If you need a function that's not in this list:

1. Open `src/app/agentConfigs/openDental/apiRegistry.ts`
2. Find the `PRIORITY_FUNCTIONS` array (line 35)
3. Add the function name to the appropriate category
4. Restart the dev server

The function catalog will automatically update.

## Performance Targets

With 50 functions:
- **Response Time**: 3-8 seconds (vs 40-65 seconds with all 337)
- **Token Usage**: ~15,000 instruction tokens (vs ~51,000)
- **Coverage**: 95% of dental office operations
- **Payload Reduction**: 85%

## Notes

- ⭐ = Most frequently used based on your logs
- Functions are balanced between capability and performance
- List covers all booking assistant operations
- Insurance/claims/procedures included for future expansion




