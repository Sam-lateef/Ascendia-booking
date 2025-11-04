
This is a knowledge base and reference codes to use api_rigistry.json this is a complete function registry and apiDoc.md this is contains bussniss and api logic for you to refactor your agents code to follow similar fashion/design 

api_registry.json and apiDoc.md should be provided 

┌─────────────────────────────────────┐
│   1. REALTIME AGENT (Voice)        │  ← Static knowledge
│      - User-facing conversation     │
│      - Hours, policies, greeting    │
└──────────────┬──────────────────────┘
               │ Delegates complex tasks
               ↓
┌─────────────────────────────────────┐
│   2. ORCHESTRATOR AGENT (Brain)    │  ← api_registry.json + apiDoc.md
│      - Knows ALL 357 functions     │
│      - Understands dependencies     │
│      - Plans multi-step workflows   │
└──────────────┬──────────────────────┘
               │ Calls specific functions
               ↓
┌─────────────────────────────────────┐
│   3. API WORKER AGENT (Executor)   │  ← api_registry.json (endpoint details)
│      - Makes actual HTTP calls      │
│      - Returns results              │
└─────────────────────────────────────┘

Agent 1: Realtime Agent (Minimal API Knowledge)

from openai import OpenAI

# Static instructions only - NO API knowledge needed
realtime_agent_instructions = """
You are the front desk receptionist for a dental office.

Office Hours: Monday-Friday 8am-5pm, Saturday 9am-2pm
Phone: (555) 123-4567

Policies:
- Cancellations require 24 hours notice
- Insurance cards must be presented at first visit
- Payment is due at time of service

For appointments, billing, patient records, or medical questions:
USE THE delegate_to_orchestrator TOOL to hand off to the orchestrator agent.

Keep conversations friendly and professional.
"""

realtime_agent = {
    "name": "RealtimeReceptionist",
    "instructions": realtime_agent_instructions,
    "tools": [
        {
            "type": "function",
            "function": {
                "name": "delegate_to_orchestrator",
                "description": "Hand off complex tasks like appointments, billing, records to the orchestrator",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task": {"type": "string", "description": "What the user needs"},
                        "context": {"type": "string", "description": "Conversation context"}
                    }
                }
            }
        }
    ]
}



Agent 2: Orchestrator Agent (BOTH Files - Full Knowledge)

import json

# Load BOTH files
with open('output/api_registry.json') as f:
    api_registry = json.load(f)

with open('output/apiDoc.md') as f:
    api_docs = f.read()

# Convert 357 endpoints to OpenAI function definitions
tools = []
for endpoint in api_registry['endpoints']:
    # Build parameter schema
    properties = {}
    required = []
    
    for param_name, param_info in endpoint.get('parameters', {}).items():
        properties[param_name] = {
            'type': param_info.get('type', 'string'),
            'description': param_info.get('description', '')
        }
        if param_info.get('required', False):
            required.append(param_name)
    
    # Create function definition
    tool = {
        'type': 'function',
        'function': {
            'name': endpoint['function_name'],
            'description': endpoint['description'],
            'parameters': {
                'type': 'object',
                'properties': properties,
                'required': required
            }
        }
    }
    tools.append(tool)

# Orchestrator instructions with FULL context
orchestrator_instructions = f"""
You are the intelligent orchestrator for OpenDental API operations.

=== COMPLETE API DOCUMENTATION ===
{api_docs}

=== YOUR ROLE ===
1. Understand what the user wants to accomplish
2. Check the "Endpoint Dependencies" section above
3. Call functions in the CORRECT ORDER based on dependencies
4. Handle errors and retry as needed
5. Return clear, structured results

=== CRITICAL RULES ===
• ALWAYS check dependencies before calling functions
• Example: To UpdatePatient, you MUST call GetPatient first to get the PatientID
• Example: To CreateAppointment, you MUST call GetPatient AND GetProvider first
• Follow the workflows documented above
• If an endpoint requires data from another endpoint, call them in sequence

=== AVAILABLE FUNCTIONS ===
You have {len(tools)} functions available (all endpoints from the API).
Use the function descriptions and the documentation above to make intelligent decisions.
"""

orchestrator_agent = {
    "name": "OpenDentalOrchestrator",
    "model": "gpt-4o",  # or "gpt-4o-mini" for cost savings
    "instructions": orchestrator_instructions,
    "tools": tools  # All 357 functions!
}


Agent 3: API Worker (api_registry.json Only)

import requests

# Load registry for endpoint details
with open('output/api_registry.json') as f:
    api_registry = json.load(f)

# Create lookup dictionary
endpoint_lookup = {
    ep['function_name']: ep
    for ep in api_registry['endpoints']
}

def execute_api_call(function_name, parameters):
    """
    Executes the actual HTTP call to OpenDental API
    
    Args:
        function_name: Name of the function (e.g., "GetPatients")
        parameters: Dict of parameters
        
    Returns:
        API response
    """
    # Look up endpoint details
    endpoint_info = endpoint_lookup.get(function_name)
    
    if not endpoint_info:
        return {"error": f"Unknown function: {function_name}"}
    
    # Build the request
    method = endpoint_info['method']
    endpoint = endpoint_info['endpoint']
    
    # Replace path parameters (e.g., /patients/{id} -> /patients/123)
    for param_name, param_value in parameters.items():
        endpoint = endpoint.replace(f'{{{param_name}}}', str(param_value))
    
    # Make the actual API call
    url = f"https://your-opendental-api.com{endpoint}"
    headers = {
        'Authorization': f'Bearer {YOUR_API_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            json=parameters if method in ['POST', 'PUT'] else None,
            params=parameters if method == 'GET' else None
        )
        
        response.raise_for_status()
        return response.json()
        
    except Exception as e:
        return {
            "error": str(e),
            "endpoint": endpoint,
            "method": method
        }
Complete Flow Example
User Says: "Schedule an appointment for John Doe tomorrow at 2pm"
1. Realtime Agent receives the request

# Recognizes this needs orchestrator
delegate_to_orchestrator(
    task="Schedule appointment for John Doe tomorrow at 2pm",
    context="User wants to book appointment"
)

2. Orchestrator Agent plans the workflow:


# Reads apiDoc.md and sees:
# "CreateAppointment requires: GetPatient, GetProvider"

# Step 1: Search for patient
result1 = GetPatients(last_name="Doe", first_name="John")
patient_id = result1['patients'][0]['patient_id']

# Step 2: Get available providers
result2 = GetProviders()
provider_id = result2['providers'][0]['provider_id']

# Step 3: Create appointment
result3 = CreateAppointment(
    patient_id=patient_id,
    provider_id=provider_id,
    appointment_date="2025-10-27",
    appointment_time="14:00"
)

# Returns to realtime agent
return "Appointment scheduled for John Doe on Oct 27 at 2pm with Dr. Smith"


3. API Worker executes each function call:


# For each function call from orchestrator:
execute_api_call("GetPatients", {"last_name": "Doe", "first_name": "John"})
# → Makes HTTP GET to /api/patients?last_name=Doe&first_name=John

execute_api_call("GetProviders", {})
# → Makes HTTP GET to /api/providers

execute_api_call("CreateAppointment", {...})
# → Makes HTTP POST to /api/appointments


 Code Structure


# agent_config.py
import json

class AgentConfig:
    def __init__(self):
        # Load the scraped data
        with open('output/api_registry.json') as f:
            self.registry = json.load(f)
        
        with open('output/apiDoc.md') as f:
            self.docs = f.read()
    
    def get_realtime_agent_config(self):
        """Returns config for realtime voice agent"""
        return {
            "instructions": self._get_static_instructions(),
            "tools": [self._get_delegation_tool()]
        }
    
    def get_orchestrator_config(self):
        """Returns config for orchestrator with ALL functions"""
        return {
            "instructions": self._build_orchestrator_instructions(),
            "tools": self._convert_endpoints_to_tools()
        }
    
    def get_worker_config(self):
        """Returns endpoint lookup for API worker"""
        return {
            ep['function_name']: ep
            for ep in self.registry['endpoints']
        }
    
    def _convert_endpoints_to_tools(self):
        """Converts 357 endpoints to OpenAI function format"""
        # ... (code shown above)
    
    def _build_orchestrator_instructions(self):
        """Combines apiDoc.md with instructions"""
        return f"""
        {self.docs}
        
        You are the orchestrator. Use the dependencies above to call functions in correct order.
        """

Key Takeaways
Agent	Uses	What For
Realtime	None (static instructions)	Greeting, hours, policies only
Orchestrator	api_registry.json + apiDoc.md	ALL 357 functions + dependencies + workflows
Worker	api_registry.json	Endpoint details (URL, method, params)
The magic: Orchestrator has the FULL documentation in its instructions, so it knows:
Which functions exist
What parameters they need
Which functions must be called before others
Business logic rules
This makes it intelligent enough to plan multi-step operations automatically!