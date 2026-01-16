/**
 * WhatsApp Message Formatters
 * 
 * Format booking information for WhatsApp display
 * Optimized for WhatsApp's text-based format with markdown support
 */

export interface WhatsAppAppointment {
  id: string;
  date: string;
  time: string;
  provider?: string;
  service?: string;
  duration?: number;
  notes?: string;
}

export interface WhatsAppContactLink {
  label: string;
  value: string;
  type: 'email' | 'phone' | 'url';
  icon?: string;
}

/**
 * Format appointment details for WhatsApp
 */
export function formatAppointmentCard(appointment: WhatsAppAppointment): string {
  let message = `📅 *Appointment Details*\n\n`;
  
  message += `*Date:* ${appointment.date}\n`;
  message += `*Time:* ${appointment.time}\n`;
  
  if (appointment.provider) {
    message += `*Provider:* ${appointment.provider}\n`;
  }
  
  if (appointment.service) {
    message += `*Service:* ${appointment.service}\n`;
  }
  
  if (appointment.duration) {
    message += `*Duration:* ${appointment.duration} minutes\n`;
  }
  
  if (appointment.notes) {
    message += `\n*Notes:* ${appointment.notes}`;
  }
  
  return message;
}

/**
 * Format multiple appointments as a list
 */
export function formatAppointmentList(appointments: WhatsAppAppointment[]): string {
  if (appointments.length === 0) {
    return "You don't have any upcoming appointments.";
  }

  let message = `📅 *Your Appointments (${appointments.length})*\n\n`;
  
  appointments.forEach((apt, index) => {
    message += `${index + 1}. *${apt.date}* at ${apt.time}\n`;
    if (apt.provider) message += `   👨‍⚕️ ${apt.provider}\n`;
    if (apt.service) message += `   🏥 ${apt.service}\n`;
    message += `\n`;
  });

  message += `\n_Reply with the number to see details_`;
  return message;
}

/**
 * Format contact information
 */
export function formatContactInfo(title: string, links: WhatsAppContactLink[]): string {
  let message = `*${title}*\n\n`;
  
  links.forEach((link) => {
    message += `${link.icon || '•'} *${link.label}*: ${link.value}\n`;
  });
  
  return message;
}

/**
 * Format available time slots
 */
export function formatTimeSlots(date: string, slots: string[]): string {
  if (slots.length === 0) {
    return `No available time slots for ${date}.`;
  }

  let message = `*Available times for ${date}:*\n\n`;
  
  slots.forEach((slot, index) => {
    message += `${index + 1}. ${slot}\n`;
  });
  
  message += `\n_Reply with the number to book_`;
  return message;
}

/**
 * Format buttons as a numbered list (WhatsApp fallback)
 */
export function formatButtons(text: string, buttons: Array<{ id: string; text: string }>): string {
  let message = `${text}\n\n`;
  
  buttons.forEach((button, index) => {
    message += `${index + 1}. ${button.text}\n`;
  });
  
  message += `\n_Reply with the number_`;
  return message;
}

/**
 * Create WhatsApp button message structure (for Evolution API)
 */
export function createButtonMessage(text: string, buttons: Array<{ id: string; text: string }>) {
  return {
    text,
    buttons: buttons.map((btn, idx) => ({
      buttonId: btn.id || `btn_${idx}`,
      buttonText: { displayText: btn.text },
      type: 1
    }))
  };
}

/**
 * Create WhatsApp list message structure (for Evolution API)
 */
export function createListMessage(
  title: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>
) {
  return {
    title,
    buttonText,
    sections: sections.map((section) => ({
      title: section.title,
      rows: section.rows.map((row) => ({
        rowId: row.id,
        title: row.title,
        description: row.description || ''
      }))
    }))
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format rich text for WhatsApp (bold, italic, etc.)
 */
export function formatWhatsAppText(text: string): string {
  // WhatsApp markdown:
  // *bold*
  // _italic_
  // ~strikethrough~
  // ```monospace```
  
  return text
    .replace(/\*\*/g, '*') // Convert **bold** to *bold*
    .replace(/__/g, '_');  // Convert __italic__ to _italic_
}

/**
 * Format confirmation message
 */
export function formatConfirmation(
  type: 'booked' | 'cancelled' | 'rescheduled',
  details: string
): string {
  const emoji = type === 'booked' ? '✅' : type === 'cancelled' ? '❌' : '🔄';
  const action = type === 'booked' ? 'Confirmed' : type === 'cancelled' ? 'Cancelled' : 'Rescheduled';
  
  return `${emoji} *Appointment ${action}*\n\n${details}`;
}

/**
 * Format error message
 */
export function formatError(message: string): string {
  return `⚠️ *Error*\n\n${message}\n\nPlease try again or contact support if the issue persists.`;
}

/**
 * Format welcome message
 */
export function formatWelcome(organizationName: string): string {
  return `👋 *Welcome to ${organizationName}!*\n\nI'm your AI booking assistant. I can help you with:\n\n• Booking appointments\n• Checking availability\n• Rescheduling appointments\n• Answering questions\n\nHow can I help you today?`;
}
