/**
 * Hallucination Prevention System
 * Helper functions for logging and tracking AI hallucinations
 */

interface ValidationSettings {
  validation_enabled: boolean;
  validate_bookings: boolean;
  validate_reschedules: boolean;
  validate_cancellations: boolean;
  validate_patient_creation: boolean;
  confidence_threshold: number;
  max_retries: number;
}

interface HallucinationLogEntry {
  session_id: string;
  conversation_id?: string;
  operation_type: string;  // 'create_appointment', 'update_appointment', etc.
  function_name: string;
  hallucination_type: 'missing_parameter' | 'invalid_value' | 'fabricated_data' | 'logic_error';
  severity: 'critical' | 'high' | 'medium' | 'low';
  original_request: any;
  validation_error: string;
  validator_reasoning?: string;
  corrected_request?: any;
  action_taken: 'blocked' | 'corrected' | 'asked_user' | 'escalated';
  primary_agent_model?: string;
  validator_model?: string;
  validation_cost_usd?: number;
  tokens_used?: number;
  prevented_error?: boolean;
  user_impact?: string;
}

// Cache validation settings (1 minute TTL)
let settingsCache: { data: ValidationSettings; timestamp: number } | null = null;
const CACHE_TTL = 60000; // 1 minute

/**
 * Load validation settings from database
 * Returns cached settings if available
 */
export async function getValidationSettings(): Promise<ValidationSettings | null> {
  // Check cache
  if (settingsCache && Date.now() - settingsCache.timestamp < CACHE_TTL) {
    return settingsCache.data;
  }

  try {
    const response = await fetch('/api/admin/validation/settings');
    if (!response.ok) throw new Error('Failed to fetch validation settings');
    
    const data = await response.json();
    const settings = data.settings;
    
    if (settings) {
      settingsCache = { data: settings, timestamp: Date.now() };
      return settings;
    }
    
    return null;
  } catch (error) {
    console.error('[Hallucination Logger] Failed to load settings:', error);
    return null;
  }
}

/**
 * Check if validation should run for a specific operation
 * @param operationType - 'create_appointment', 'update_appointment', 'create_patient', etc.
 */
export async function shouldValidate(operationType: string): Promise<boolean> {
  const settings = await getValidationSettings();
  
  if (!settings || !settings.validation_enabled) {
    return false;
  }
  
  switch (operationType) {
    case 'create_appointment':
      return settings.validate_bookings;
    case 'update_appointment':
      return settings.validate_reschedules;
    case 'break_appointment':
    case 'cancel_appointment':
      return settings.validate_cancellations;
    case 'create_patient':
      return settings.validate_patient_creation;
    default:
      return false; // Don't validate unknown operations
  }
}

/**
 * Log a hallucination to the database
 * Call this when the validator catches an AI error
 */
export async function logHallucination(entry: HallucinationLogEntry): Promise<void> {
  try {
    const response = await fetch('/api/admin/validation/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    
    if (!response.ok) {
      console.error('[Hallucination Logger] Failed to log:', await response.text());
      return;
    }
    
    const data = await response.json();
    console.log(`[Hallucination Logger] ✅ Logged ${entry.severity} ${entry.hallucination_type}: ${entry.validation_error}`);
    
    // Update settings cost counter (async, don't wait)
    updateCostCounter(entry.validation_cost_usd || 0).catch(() => {});
    
  } catch (error) {
    console.error('[Hallucination Logger] Error logging hallucination:', error);
  }
}

/**
 * Update the cost counter in validation settings
 */
async function updateCostCounter(cost: number): Promise<void> {
  if (cost <= 0) return;
  
  try {
    const settings = await getValidationSettings();
    if (!settings) return;
    
    await fetch('/api/admin/validation/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...settings,
        validation_calls_count: (settings as any).validation_calls_count + 1,
        estimated_cost_usd: parseFloat(((settings as any).estimated_cost_usd + cost).toFixed(6))
      })
    });
    
    // Clear cache to force reload
    settingsCache = null;
  } catch (error) {
    console.error('[Hallucination Logger] Failed to update cost counter:', error);
  }
}

/**
 * Helper: Estimate validation cost for OpenAI or Anthropic
 */
export function estimateValidationCost(model: string, tokens: number): number {
  // Pricing per 1M tokens (as of Dec 2024)
  const pricing: Record<string, number> = {
    'gpt-4o': 5.0,
    'gpt-4o-mini': 0.15,
    'claude-3-5-sonnet-20241022': 3.0,
    'claude-3-5-haiku': 0.8
  };
  
  const pricePerMillion = pricing[model] || 3.0; // Default to Sonnet pricing
  return (tokens / 1000000) * pricePerMillion;
}

/**
 * Clear validation settings cache (call after updating settings)
 */
export function clearValidationCache(): void {
  settingsCache = null;
}

/**
 * Helper: Classify hallucination type from error message
 */
export function classifyHallucinationType(error: string): HallucinationLogEntry['hallucination_type'] {
  const lowerError = error.toLowerCase();
  
  if (lowerError.includes('missing') || lowerError.includes('null') || lowerError.includes('undefined')) {
    return 'missing_parameter';
  }
  if (lowerError.includes('invalid') || lowerError.includes('wrong format') || lowerError.includes('malformed')) {
    return 'invalid_value';
  }
  if (lowerError.includes('does not exist') || lowerError.includes('hallucinated') || lowerError.includes('fabricated')) {
    return 'fabricated_data';
  }
  return 'logic_error';
}

/**
 * Helper: Determine severity from hallucination type and operation
 */
export function determineSeverity(
  hallucinationType: HallucinationLogEntry['hallucination_type'],
  operationType: string
): HallucinationLogEntry['severity'] {
  // Critical operations
  const criticalOps = ['create_appointment', 'update_appointment', 'create_patient'];
  
  if (criticalOps.includes(operationType)) {
    if (hallucinationType === 'fabricated_data' || hallucinationType === 'missing_parameter') {
      return 'critical';
    }
    if (hallucinationType === 'invalid_value') {
      return 'high';
    }
  }
  
  return 'medium';
}

/**
 * Example usage:
 * 
 * // Before calling API function, check if validation is enabled
 * if (await shouldValidate('create_appointment')) {
 *   // Run Sonnet validation
 *   const validationResult = await validateWithSonnet(params);
 *   
 *   if (!validationResult.valid) {
 *     // Log the hallucination
 *     await logHallucination({
 *       session_id: sessionId,
 *       operation_type: 'create_appointment',
 *       function_name: 'CreateAppointment',
 *       hallucination_type: classifyHallucinationType(validationResult.error),
 *       severity: determineSeverity('missing_parameter', 'create_appointment'),
 *       original_request: params,
 *       validation_error: validationResult.error,
 *       validator_reasoning: validationResult.reasoning,
 *       action_taken: 'blocked',
 *       primary_agent_model: 'gpt-4o',
 *       validator_model: 'claude-3-5-sonnet-20241022',
 *       validation_cost_usd: estimateValidationCost('claude-3-5-sonnet-20241022', 450),
 *       tokens_used: 450,
 *       prevented_error: true,
 *       user_impact: 'prevented_wrong_booking'
 *     });
 *     
 *     // Return error to agent
 *     return { error: validationResult.error };
 *   }
 * }
 */

































