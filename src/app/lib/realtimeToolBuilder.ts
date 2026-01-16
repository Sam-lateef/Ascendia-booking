/**
 * Dynamic Realtime Tool Builder
 * Converts database tool definitions to OpenAI Realtime SDK tools
 */

import { z } from 'zod';
import { tool } from '@openai/agents/realtime';
import { AgentTool } from './agentConfigDynamic';

/**
 * Build a Zod schema from database parameter definition
 */
function buildZodSchema(parameters: Record<string, any>): z.ZodObject<any> {
  const schemaFields: Record<string, any> = {};

  for (const [paramName, paramConfig] of Object.entries(parameters)) {
    const config = paramConfig as any;
    
    let fieldSchema: any;
    
    // Map type to Zod
    switch (config.type) {
      case 'string':
        fieldSchema = z.string();
        break;
      case 'number':
        fieldSchema = z.number();
        break;
      case 'boolean':
        fieldSchema = z.boolean();
        break;
      case 'array':
        fieldSchema = z.array(z.any());
        break;
      case 'object':
        fieldSchema = z.object({});
        break;
      default:
        fieldSchema = z.string();
    }

    // Add nullable if specified (required by Realtime API)
    if (config.nullable) {
      fieldSchema = fieldSchema.nullable();
    }

    // Add optional if not required
    if (!config.required) {
      fieldSchema = fieldSchema.optional();
    }

    // Add description
    if (config.description) {
      fieldSchema = fieldSchema.describe(config.description);
    }

    schemaFields[paramName] = fieldSchema;
  }

  return z.object(schemaFields);
}

/**
 * Create a Realtime SDK tool from database tool definition
 */
export function createRealtimeTool(toolDef: AgentTool) {
  const zodSchema = buildZodSchema(toolDef.parameters);

  return tool({
    name: toolDef.name,
    description: toolDef.description,
    parameters: zodSchema,
    execute: async (params: any) => {
      try {
        console.log(`[Realtime Tool] Executing ${toolDef.name}:`, params);

        // Call the API endpoint
        const response = await fetch(toolDef.api_route, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            function: toolDef.name,
            ...params,
          }),
        });

        // ✅ Check for HTTP errors
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ 
            error: true, 
            message: `Server error: ${response.statusText}` 
          }));
          console.log(`[Realtime Tool] ❌ ${toolDef.name} HTTP error:`, errorData);
          return JSON.stringify({
            error: true,
            message: errorData.message || `Failed to execute ${toolDef.name}`,
            status: response.status
          });
        }

        const result = await response.json();

        // ✅ Log warnings for validation errors
        if (result.error) {
          console.log(`[Realtime Tool] ⚠️ ${toolDef.name} returned error:`, result.message);
        } else {
          console.log(`[Realtime Tool] ✅ ${toolDef.name} result:`, result);
        }

        return JSON.stringify(result);
      } catch (error) {
        console.error(`[Realtime Tool] ❌ ${toolDef.name} exception:`, error);
        return JSON.stringify({
          error: true,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
}

/**
 * Create all Realtime tools from database tool definitions
 */
export function createAllRealtimeTools(tools: AgentTool[]) {
  return tools
    .filter((t) => t.is_active)
    .map((t) => createRealtimeTool(t));
}





























