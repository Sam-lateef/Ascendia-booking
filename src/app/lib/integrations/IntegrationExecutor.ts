/**
 * Integration Executor
 * 
 * Dynamic execution engine for external API integrations.
 * Loads configuration from database and executes API calls with parameter mapping,
 * authentication, and error handling.
 */

import { getSupabaseAdmin } from '../supabaseClient';
import { getCredentials } from '../credentialLoader';

interface ExternalIntegration {
  id: string;
  organization_id: string;
  provider_key: string;
  provider_name: string;
  provider_type: string;
  api_base_url: string;
  api_version: string | null;
  auth_type: string;
  auth_config: Record<string, any>;
  default_headers: Record<string, string>;
  timeout_ms: number;
  retry_config: {
    max_retries: number;
    backoff: string;
  };
  is_enabled: boolean;
}

interface IntegrationEndpoint {
  id: string;
  integration_id: string;
  function_name: string;
  category: string | null;
  description: string | null;
  endpoint_path: string;
  http_method: string;
  path_params: string[];
  query_params: string[];
  body_params: string[];
  required_params: string[];
  request_format: string;
  response_format: string;
  request_transform: Record<string, any> | null;
  response_transform: Record<string, any> | null;
}

interface ParameterMap {
  id: string;
  endpoint_id: string;
  internal_name: string;
  external_name: string;
  transform_type: string;
  transform_config: Record<string, any>;
  direction: string;
}

export class IntegrationExecutor {
  private integrationId: string;
  private organizationId: string;
  private integration: ExternalIntegration | null = null;

  constructor(integrationId: string, organizationId: string) {
    this.integrationId = integrationId;
    this.organizationId = organizationId;
  }

  /**
   * Execute a function call on the external integration
   */
  async execute(functionName: string, parameters: Record<string, any>): Promise<any> {
    console.log(`[IntegrationExecutor] Executing ${functionName} for integration ${this.integrationId}`);

    // 1. Load integration config
    this.integration = await this.loadIntegration();
    
    if (!this.integration.is_enabled) {
      throw new Error(`Integration ${this.integration.provider_name} is disabled`);
    }

    // 2. Load endpoint config
    const endpoint = await this.loadEndpoint(functionName);
    
    // 3. Validate required parameters
    this.validateRequiredParameters(endpoint, parameters);

    // 4. Load parameter mappings
    const mappings = await this.loadParameterMaps(endpoint.id);

    // 5. Transform parameters (internal → external)
    const mappedParams = await this.transformParameters(mappings, parameters, 'request');

    // 6. Build HTTP request
    const request = this.buildRequest(endpoint, mappedParams);

    // 7. Load auth config and credentials
    const authHeaders = await this.loadAuthHeaders();

    // 8. Execute with retry logic
    const response = await this.executeWithRetry(request, authHeaders);

    // 9. Transform response (external → internal)
    return this.transformResponse(endpoint, response, mappings);
  }

  /**
   * Load integration configuration from database
   */
  private async loadIntegration(): Promise<ExternalIntegration> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('external_integrations')
      .select('*')
      .eq('id', this.integrationId)
      .eq('organization_id', this.organizationId)
      .single();

    if (error || !data) {
      throw new Error(`Integration not found: ${error?.message || 'Unknown error'}`);
    }

    return data as ExternalIntegration;
  }

  /**
   * Load endpoint configuration
   */
  private async loadEndpoint(functionName: string): Promise<IntegrationEndpoint> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('integration_endpoints')
      .select('*')
      .eq('integration_id', this.integrationId)
      .eq('function_name', functionName)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new Error(`Endpoint not found for function: ${functionName}`);
    }

    return data as IntegrationEndpoint;
  }

  /**
   * Load parameter mappings for an endpoint
   */
  private async loadParameterMaps(endpointId: string): Promise<ParameterMap[]> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('integration_parameter_maps')
      .select('*')
      .eq('endpoint_id', endpointId)
      .eq('is_active', true);

    if (error) {
      console.warn('[IntegrationExecutor] Error loading parameter maps:', error);
      return [];
    }

    return (data as ParameterMap[]) || [];
  }

  /**
   * Validate required parameters
   */
  private validateRequiredParameters(
    endpoint: IntegrationEndpoint,
    parameters: Record<string, any>
  ): void {
    const missing: string[] = [];

    for (const param of endpoint.required_params) {
      if (parameters[param] === undefined || parameters[param] === null || parameters[param] === '') {
        missing.push(param);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing required parameters for ${endpoint.function_name}: ${missing.join(', ')}`
      );
    }
  }

  /**
   * Transform parameters using mappings
   */
  private async transformParameters(
    mappings: ParameterMap[],
    parameters: Record<string, any>,
    direction: 'request' | 'response'
  ): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    // First, apply mappings
    const relevantMappings = mappings.filter(
      m => m.direction === direction || m.direction === 'both'
    );

    for (const [key, value] of Object.entries(parameters)) {
      const mapping = relevantMappings.find(m => m.internal_name === key);

      if (mapping) {
        // Apply transformation
        const transformedValue = await this.applyTransform(
          value,
          mapping.transform_type,
          mapping.transform_config
        );
        result[mapping.external_name] = transformedValue;
      } else {
        // No mapping, keep original
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Apply a single transformation
   */
  private async applyTransform(
    value: any,
    transformType: string,
    config: Record<string, any>
  ): Promise<any> {
    if (value === null || value === undefined) {
      return value;
    }

    switch (transformType) {
      case 'rename':
        // Just rename, no transformation
        return value;

      case 'format_date':
        return this.formatDate(value, config);

      case 'clean_phone':
        return this.cleanPhone(value);

      case 'case_transform':
        return this.transformCase(value, config);

      case 'default_value':
        return value || config.value;

      case 'custom':
        // For custom transforms, config should contain transformation logic
        // This could be enhanced with a safe eval or predefined functions
        console.warn('[IntegrationExecutor] Custom transforms not yet implemented');
        return value;

      default:
        return value;
    }
  }

  /**
   * Format date according to configuration
   */
  private formatDate(value: string, config: Record<string, any>): string {
    if (!value) return value;

    const toFormat = config.to || 'YYYY-MM-DD';

    // Parse the date
    let date: Date;
    if (value.includes('T')) {
      // ISO format
      date = new Date(value);
    } else if (value.includes(' ')) {
      // YYYY-MM-DD HH:mm:ss format
      date = new Date(value.replace(' ', 'T'));
    } else {
      // YYYY-MM-DD format
      date = new Date(value);
    }

    // Format according to toFormat
    if (toFormat === 'YYYY-MM-DD') {
      return date.toISOString().split('T')[0];
    } else if (toFormat === 'YYYY-MM-DD HH:mm:ss') {
      const isoString = date.toISOString();
      return isoString.replace('T', ' ').substring(0, 19);
    }

    return value;
  }

  /**
   * Clean phone number (remove formatting)
   */
  private cleanPhone(value: string): string {
    if (!value) return value;
    return value.replace(/\D/g, '');
  }

  /**
   * Transform string case
   */
  private transformCase(value: string, config: Record<string, any>): string {
    if (!value) return value;

    const to = config.to || 'lowercase';

    switch (to) {
      case 'lowercase':
        return value.toLowerCase();
      case 'uppercase':
        return value.toUpperCase();
      case 'title_case':
        return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      default:
        return value;
    }
  }

  /**
   * Build HTTP request
   */
  private buildRequest(
    endpoint: IntegrationEndpoint,
    parameters: Record<string, any>
  ): {
    url: string;
    method: string;
    body?: any;
  } {
    if (!this.integration) {
      throw new Error('Integration not loaded');
    }

    let url = this.integration.api_base_url.replace(/\/$/, '');
    let path = endpoint.endpoint_path;

    // Replace path parameters
    for (const param of endpoint.path_params) {
      if (parameters[param] !== undefined) {
        path = path.replace(`{${param}}`, String(parameters[param]));
      }
    }

    url += path;

    // Add query parameters
    const queryParams: string[] = [];
    for (const param of endpoint.query_params) {
      if (parameters[param] !== undefined && parameters[param] !== null && parameters[param] !== '') {
        queryParams.push(`${encodeURIComponent(param)}=${encodeURIComponent(String(parameters[param]))}`);
      }
    }

    if (queryParams.length > 0) {
      url += '?' + queryParams.join('&');
    }

    // Build request body
    let body: any = undefined;
    if (endpoint.http_method === 'POST' || endpoint.http_method === 'PUT' || endpoint.http_method === 'PATCH') {
      if (endpoint.body_params.length > 0) {
        body = {};
        for (const param of endpoint.body_params) {
          if (parameters[param] !== undefined) {
            body[param] = parameters[param];
          }
        }
      } else {
        // If no body_params specified, use all non-path/query params
        body = {};
        const usedParams = new Set([...endpoint.path_params, ...endpoint.query_params]);
        for (const [key, value] of Object.entries(parameters)) {
          if (!usedParams.has(key) && value !== undefined) {
            body[key] = value;
          }
        }
      }
    }

    return { url, method: endpoint.http_method, body };
  }

  /**
   * Load authentication headers
   */
  private async loadAuthHeaders(): Promise<Record<string, string>> {
    if (!this.integration) {
      throw new Error('Integration not loaded');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.integration.default_headers,
    };

    const { auth_type, auth_config } = this.integration;

    switch (auth_type) {
      case 'api_key':
        await this.addApiKeyAuth(headers, auth_config);
        break;

      case 'bearer':
        await this.addBearerAuth(headers, auth_config);
        break;

      case 'basic':
        await this.addBasicAuth(headers, auth_config);
        break;

      case 'oauth2':
        await this.addOAuth2Auth(headers, auth_config);
        break;

      case 'custom':
        // Custom auth handled by auth_config directly
        if (auth_config.headers) {
          Object.assign(headers, auth_config.headers);
        }
        break;

      default:
        console.warn(`[IntegrationExecutor] Unknown auth type: ${auth_type}`);
    }

    return headers;
  }

  /**
   * Add API key authentication
   */
  private async addApiKeyAuth(headers: Record<string, string>, config: Record<string, any>): Promise<void> {
    const credentialType = config.credential_type || 'other';
    const credentialKey = config.credential_key || 'api_key';
    const headerName = config.header_name || 'Authorization';
    const prefix = config.prefix || '';

    // Load credentials from api_credentials table
    const credentials = await getCredentials(this.organizationId, credentialType);
    const apiKey = credentials[credentialKey];

    if (!apiKey) {
      throw new Error(`API key not found in credentials: ${credentialKey}`);
    }

    headers[headerName] = prefix + apiKey;
  }

  /**
   * Add Bearer token authentication
   */
  private async addBearerAuth(headers: Record<string, string>, config: Record<string, any>): Promise<void> {
    const credentialType = config.credential_type || 'other';
    const credentialKey = config.credential_key || 'api_key';

    const credentials = await getCredentials(this.organizationId, credentialType);
    const token = credentials[credentialKey];

    if (!token) {
      throw new Error(`Bearer token not found in credentials: ${credentialKey}`);
    }

    headers['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Add Basic authentication
   */
  private async addBasicAuth(headers: Record<string, string>, config: Record<string, any>): Promise<void> {
    const credentialType = config.credential_type || 'other';
    const usernameKey = config.username_key || 'username';
    const passwordKey = config.password_key || 'password';

    const credentials = await getCredentials(this.organizationId, credentialType);
    const username = credentials[usernameKey];
    const password = credentials[passwordKey];

    if (!username || !password) {
      throw new Error('Basic auth credentials not found');
    }

    const encoded = Buffer.from(`${username}:${password}`).toString('base64');
    headers['Authorization'] = `Basic ${encoded}`;
  }

  /**
   * Add OAuth2 authentication
   */
  private async addOAuth2Auth(headers: Record<string, string>, config: Record<string, any>): Promise<void> {
    // OAuth2 is more complex - typically requires token refresh logic
    // For now, assume token is already available in credentials
    const credentialType = config.credential_type || 'other';
    const tokenKey = config.token_key || 'access_token';

    const credentials = await getCredentials(this.organizationId, credentialType);
    const accessToken = credentials[tokenKey];

    if (!accessToken) {
      throw new Error('OAuth2 access token not found');
    }

    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry(
    request: { url: string; method: string; body?: any },
    headers: Record<string, string>
  ): Promise<any> {
    if (!this.integration) {
      throw new Error('Integration not loaded');
    }

    const { max_retries = 3, backoff = 'exponential' } = this.integration.retry_config;
    let lastError: any;

    for (let attempt = 0; attempt < max_retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.integration!.timeout_ms);

        const options: RequestInit = {
          method: request.method,
          headers,
          signal: controller.signal,
        };

        if (request.body && Object.keys(request.body).length > 0) {
          options.body = JSON.stringify(request.body);
        }

        console.log(`[IntegrationExecutor] ${request.method} ${request.url}`);
        
        const response = await fetch(request.url, options);
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = errorText;
          }

          throw {
            status: response.status,
            message: `HTTP ${response.status}: ${response.statusText}`,
            details: errorData,
          };
        }

        // Parse response
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }

        return { success: true };

      } catch (error: any) {
        lastError = error;

        // Don't retry on client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }

        // Wait before retrying (with exponential backoff)
        if (attempt < max_retries - 1) {
          const delay = backoff === 'exponential' 
            ? 1000 * Math.pow(2, attempt) 
            : 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          console.log(`[IntegrationExecutor] Retry attempt ${attempt + 2}/${max_retries}`);
        }
      }
    }

    throw lastError;
  }

  /**
   * Transform response
   */
  private transformResponse(
    endpoint: IntegrationEndpoint,
    response: any,
    mappings: ParameterMap[]
  ): any {
    // If response_transform is specified, apply it
    if (endpoint.response_transform) {
      // Custom response transformation logic would go here
      console.warn('[IntegrationExecutor] Custom response transforms not yet implemented');
    }

    // Apply reverse parameter mappings if needed
    // This would map external field names back to internal names
    // For now, return response as-is
    return response;
  }
}

/**
 * Helper function to get integration by provider key
 */
export async function getIntegrationByProvider(
  organizationId: string,
  providerKey: string
): Promise<ExternalIntegration | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('external_integrations')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('provider_key', providerKey)
    .eq('is_enabled', true)
    .maybeSingle();

  if (error) {
    console.error('[getIntegrationByProvider] Error:', error);
    return null;
  }

  return data as ExternalIntegration | null;
}
