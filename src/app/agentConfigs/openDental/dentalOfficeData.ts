/**
 * Static dental office information
 * This data is embedded in the Tier 1 Realtime Agent's instructions
 */

export const dentalOfficeInfo = {
  name: 'Barton Dental',
  phone: '(555) 123-4567', // Update with real number
  address: '123 Main Street, Suite 100, Anytown, ST 12345', // Update with real address
  hours: {
    weekdays: 'Monday-Friday: 8:00 AM - 5:00 PM',
    saturday: 'Closed',
    sunday: 'Closed',
  },
  services: [
    'Routine Cleanings & Exams',
    'Digital X-Rays',
    'Fillings & Restorations',
    'Root Canal Therapy',
    'Crowns & Bridges',
    'Teeth Whitening',
    'Dental Implants',
    'Emergency Dental Care',
    'Periodontal Care',
    'Cosmetic Dentistry',
  ],
  policies: {
    cancellation: '24-hour notice required for cancellations to avoid a fee',
    newPatients: 'New patients welcome! Please arrive 15 minutes early for paperwork. You will complete full registration on-premise.',
    insurance: 'We accept most major insurance plans',
    weekends: 'Appointments available on weekdays only. No weekend bookings.',
    emergencies: 'For dental emergencies, please call our office or go to the nearest emergency room.',
  },
  providers: [
    'Dr. Pearl - General Dentist',
    // Add other providers as needed
  ],
};
