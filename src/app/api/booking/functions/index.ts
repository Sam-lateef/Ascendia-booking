/**
 * Booking System API Functions
 * 
 * All functions match OpenDental API naming and response structure
 * for seamless integration with orchestrator agent.
 */

export { GetAllPatients } from './patients';
export { GetMultiplePatients } from './patients';
export { GetPatient } from './patients';
export { CreatePatient } from './patients';
export { UpdatePatient } from './patients';
export { DeletePatient } from './patients';

export { GetProviders } from './providers';
export { GetProvider } from './providers';
export { CreateProvider } from './providers';
export { UpdateProvider } from './providers';
export { DeleteProvider } from './providers';

export { GetOperatories } from './operatories';
export { GetOperatory } from './operatories';
export { CreateOperatory } from './operatories';
export { UpdateOperatory } from './operatories';
export { DeleteOperatory } from './operatories';

export { GetAppointments } from './appointments';
export { GetAvailableSlots } from './appointments';
export { CreateAppointment } from './appointments';
export { UpdateAppointment } from './appointments';
export { BreakAppointment } from './appointments';
export { DeleteAppointment } from './appointments';

export { GetSchedules } from './schedules';
export { GetSchedule } from './schedules';
export { GetProviderSchedules } from './schedules';
export { CreateSchedule } from './schedules';
export { UpdateSchedule } from './schedules';
export { DeleteSchedule } from './schedules';
export { CreateDefaultSchedules } from './schedules';
export { CheckScheduleConflicts } from './schedules';